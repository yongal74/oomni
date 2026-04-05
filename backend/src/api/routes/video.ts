/**
 * video.ts — Short-Form Video API Routes
 */
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import {
  generateScript,
  saveVrewScript,
  getVideoList,
  renderVideo,
  VIDEO_DIR,
  VREW_DIR,
  type ShortFormScript,
} from '../../services/videoService'
import { logger } from '../../logger'

// In-memory script store (replace with DB in production)
const scriptStore = new Map<string, ShortFormScript>()

const generateScriptSchema = z.object({
  topic: z.string().min(1).max(200),
  type: z.enum(['content', 'growth']),
})

const renderSchema = z.object({
  script_id: z.string().uuid(),
  variant_index: z.number().int().min(0).max(2).default(0),
})

// Helper: get param as string
function param(req: Request, key: string): string {
  const val = req.params[key]
  return Array.isArray(val) ? val[0] : (val ?? '')
}

export function videoRouter(): Router {
  const router = Router()

  // POST /api/video/script — Generate script
  router.post('/script', async (req: Request, res: Response) => {
    try {
      const { topic, type } = generateScriptSchema.parse(req.body)

      logger.info(`[Video] Generating script: topic="${topic}", type="${type}"`)
      const script = await generateScript(topic, type)

      // Store script in memory
      scriptStore.set(script.id, script)

      res.json({ success: true, script })
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: '잘못된 요청', details: err.errors })
        return
      }
      logger.error('[Video] Script generation failed', err)
      res.status(500).json({ error: '스크립트 생성 실패', detail: (err as Error).message })
    }
  })

  // GET /api/video/scripts — List saved scripts
  router.get('/scripts', (_req: Request, res: Response) => {
    const scripts = Array.from(scriptStore.values()).map(s => ({
      id: s.id,
      title: s.title,
      topic: s.topic,
      type: s.type,
      variant_count: s.variants.length,
      created_at: s.created_at,
    }))

    res.json({ success: true, scripts })
  })

  // GET /api/video/scripts/:id — Get single script
  router.get('/scripts/:id', (req: Request, res: Response) => {
    const script = scriptStore.get(param(req, 'id'))
    if (!script) {
      res.status(404).json({ error: '스크립트를 찾을 수 없습니다' })
      return
    }
    res.json({ success: true, script })
  })

  // POST /api/video/render — Render Remotion video
  router.post('/render', async (req: Request, res: Response) => {
    try {
      const { script_id, variant_index } = renderSchema.parse(req.body)

      const script = scriptStore.get(script_id)
      if (!script) {
        res.status(404).json({ error: '스크립트를 찾을 수 없습니다' })
        return
      }

      const variant = script.variants[variant_index]
      if (!variant) {
        res.status(400).json({ error: '해당 변형이 없습니다' })
        return
      }

      logger.info(`[Video] Starting render: script_id=${script_id}, variant=${variant_index}`)

      // Render asynchronously
      const renderPromise = renderVideo(script_id, variant)
      renderPromise
        .then(outputPath => {
          logger.info(`[Video] Render complete: ${outputPath}`)
        })
        .catch(err => {
          logger.error('[Video] Render failed', err)
        })

      res.json({
        success: true,
        message: '렌더링이 시작되었습니다',
        script_id,
        variant_index,
        output_path: path.join(VIDEO_DIR, `${script_id}.mp4`),
      })
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: '잘못된 요청', details: err.errors })
        return
      }
      logger.error('[Video] Render request failed', err)
      res.status(500).json({ error: '렌더링 요청 실패', detail: (err as Error).message })
    }
  })

  // GET /api/video/list — List rendered videos
  router.get('/list', async (_req: Request, res: Response) => {
    try {
      const videos = await getVideoList()
      res.json({ success: true, videos })
    } catch (err) {
      logger.error('[Video] List failed', err)
      res.status(500).json({ error: '목록 조회 실패' })
    }
  })

  // GET /api/video/download/:id — Download MP4
  router.get('/download/:id', (req: Request, res: Response) => {
    const id = param(req, 'id')
    // Sanitize id to prevent path traversal
    const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '')
    const filePath = path.join(VIDEO_DIR, `${safeId}.mp4`)

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: '파일을 찾을 수 없습니다' })
      return
    }

    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Disposition', `attachment; filename="${safeId}.mp4"`)
    res.sendFile(path.resolve(filePath))
  })

  // POST /api/video/vrew-export/:id — Export Vrew txt
  router.post('/vrew-export/:id', async (req: Request, res: Response) => {
    const id = param(req, 'id')
    const script = scriptStore.get(id)

    if (!script) {
      res.status(404).json({ error: '스크립트를 찾을 수 없습니다' })
      return
    }

    try {
      const filePath = await saveVrewScript(script)
      res.json({
        success: true,
        message: 'Vrew 스크립트가 저장되었습니다',
        file_path: filePath,
      })
    } catch (err) {
      logger.error('[Video] Vrew export failed', err)
      res.status(500).json({ error: 'Vrew 내보내기 실패', detail: (err as Error).message })
    }
  })

  // GET /api/video/vrew/:id — Download Vrew txt file
  router.get('/vrew/:id', (req: Request, res: Response) => {
    const id = param(req, 'id')
    const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '')
    const filePath = path.join(VREW_DIR, `${safeId}.txt`)

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Vrew 파일을 찾을 수 없습니다' })
      return
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${safeId}.txt"`)
    res.send(content)
  })

  return router
}
