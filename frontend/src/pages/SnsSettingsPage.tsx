/**
 * SnsSettingsPage.tsx — SNS & AI 미디어 설정
 * v5.2.0
 *
 * - Ideogram API 키 (이미지 생성)
 * - Gemini API 키 (Veo 영상 생성)
 * - n8n 웹훅 URL (Instagram, TikTok 자동 업로드)
 * - SNS OAuth 자격증명 (X, YouTube, LinkedIn, Naver Blog)
 */
import { useState, useEffect, type ReactNode } from 'react'
import { Key, CheckCircle, AlertTriangle, Loader2, Eye, EyeOff, ExternalLink, Link2 } from 'lucide-react'
import { settingsApi, type SnsStatus } from '../lib/api'

// ── 공통 컴포넌트 ─────────────────────────────────────────────────────────────

function SectionCard({ children }: { children: ReactNode }) {
  return <div className="bg-surface border border-border rounded-xl p-5 mb-4">{children}</div>
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-muted">{icon}</span>
      <h2 className="text-base font-semibold text-text">{title}</h2>
    </div>
  )
}

type MsgState = { type: 'success' | 'error'; text: string }

function MsgBox({ msg }: { msg: MsgState }) {
  return (
    <div className={`flex items-center gap-2 mt-4 p-3 rounded-lg text-[13px] ${
      msg.type === 'success'
        ? 'bg-green-900/20 border border-green-800/30 text-green-400'
        : 'bg-red-900/20 border border-red-800/30 text-red-400'
    }`}>
      {msg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
      {msg.text}
    </div>
  )
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg border mb-4 ${
      ok ? 'bg-green-900/10 border-green-800/30' : 'bg-yellow-900/10 border-yellow-800/30'
    }`}>
      {ok
        ? <><CheckCircle size={14} className="text-green-400" /><span className="text-[13px] text-green-400">{label} 설정됨</span></>
        : <><AlertTriangle size={14} className="text-yellow-400" /><span className="text-[13px] text-yellow-400">{label} 미설정</span></>
      }
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────────────────

export default function SnsSettingsPage() {
  const [snsStatus, setSnsStatus] = useState<SnsStatus | null>(null)

  // Ideogram
  const [ideogramKey,     setIdeogramKey]     = useState('')
  const [showIdeogramKey, setShowIdeogramKey] = useState(false)
  const [ideogramMsg,     setIdeogramMsg]     = useState<MsgState | null>(null)
  const [ideogramSaving,  setIdeogramSaving]  = useState(false)

  // Gemini (Veo)
  const [geminiKey,     setGeminiKey]     = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [geminiMsg,     setGeminiMsg]     = useState<MsgState | null>(null)
  const [geminiSaving,  setGeminiSaving]  = useState(false)

  // n8n webhooks
  const [instagramHook, setInstagramHook] = useState('')
  const [tiktokHook,    setTiktokHook]    = useState('')
  const [n8nMsg,        setN8nMsg]        = useState<MsgState | null>(null)
  const [n8nSaving,     setN8nSaving]     = useState(false)

  // OAuth credentials (X, YouTube, LinkedIn, Naver)
  const [xClientId,         setXClientId]         = useState('')
  const [xClientSecret,     setXClientSecret]     = useState('')
  const [ytClientId,        setYtClientId]        = useState('')
  const [ytClientSecret,    setYtClientSecret]    = useState('')
  const [liClientId,        setLiClientId]        = useState('')
  const [liClientSecret,    setLiClientSecret]    = useState('')
  const [naverClientId,     setNaverClientId]     = useState('')
  const [naverClientSecret, setNaverClientSecret] = useState('')
  const [oauthMsg,          setOauthMsg]          = useState<MsgState | null>(null)
  const [oauthSaving,       setOauthSaving]       = useState(false)

  useEffect(() => {
    settingsApi.getSnsStatus().then(s => {
      setSnsStatus(s)
      setInstagramHook(s.n8n_instagram_webhook ?? '')
      setTiktokHook(s.n8n_tiktok_webhook ?? '')
    }).catch(() => {})
  }, [])

  const reload = () => {
    settingsApi.getSnsStatus().then(setSnsStatus).catch(() => {})
  }

  const handleIdeogramSave = async () => {
    if (!ideogramKey.trim()) { setIdeogramMsg({ type: 'error', text: 'API 키를 입력하세요' }); return }
    setIdeogramSaving(true); setIdeogramMsg(null)
    try {
      await settingsApi.setIdeogramKey(ideogramKey.trim())
      setIdeogramKey('')
      setIdeogramMsg({ type: 'success', text: 'Ideogram API 키가 저장되었습니다' })
      reload()
    } catch { setIdeogramMsg({ type: 'error', text: '저장 실패' }) }
    finally { setIdeogramSaving(false) }
  }

  const handleGeminiSave = async () => {
    if (!geminiKey.trim()) { setGeminiMsg({ type: 'error', text: 'API 키를 입력하세요' }); return }
    setGeminiSaving(true); setGeminiMsg(null)
    try {
      await settingsApi.setGeminiKey(geminiKey.trim())
      setGeminiKey('')
      setGeminiMsg({ type: 'success', text: 'Gemini API 키가 저장되었습니다' })
      reload()
    } catch { setGeminiMsg({ type: 'error', text: '저장 실패' }) }
    finally { setGeminiSaving(false) }
  }

  const handleN8nSave = async () => {
    setN8nSaving(true); setN8nMsg(null)
    try {
      await settingsApi.setN8nWebhooks({
        instagram: instagramHook.trim() || undefined,
        tiktok:    tiktokHook.trim()    || undefined,
      })
      setN8nMsg({ type: 'success', text: 'n8n 웹훅 URL이 저장되었습니다' })
      reload()
    } catch { setN8nMsg({ type: 'error', text: '저장 실패' }) }
    finally { setN8nSaving(false) }
  }

  const handleOAuthSave = async () => {
    setOauthSaving(true); setOauthMsg(null)
    try {
      await settingsApi.setSnsOAuth({
        x_client_id:          xClientId        || undefined,
        x_client_secret:      xClientSecret    || undefined,
        youtube_client_id:    ytClientId       || undefined,
        youtube_client_secret: ytClientSecret  || undefined,
        linkedin_client_id:   liClientId       || undefined,
        linkedin_client_secret: liClientSecret || undefined,
        naver_client_id:      naverClientId    || undefined,
        naver_client_secret:  naverClientSecret || undefined,
      })
      setOauthMsg({ type: 'success', text: 'OAuth 자격증명이 저장되었습니다' })
      setXClientId(''); setXClientSecret('')
      setYtClientId(''); setYtClientSecret('')
      setLiClientId(''); setLiClientSecret('')
      setNaverClientId(''); setNaverClientSecret('')
    } catch { setOauthMsg({ type: 'error', text: '저장 실패' }) }
    finally { setOauthSaving(false) }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-text mb-6">SNS &amp; AI 설정</h1>

      {/* ── Ideogram (이미지) ─────────────────────────────────── */}
      <SectionCard>
        <SectionTitle icon={<Key size={16} />} title="Ideogram API Key (이미지 생성)" />
        <p className="text-muted text-sm mb-4">
          마케팅 이미지 자동 생성 (Ideogram v2).{' '}
          <a href="https://ideogram.ai/manage-api" target="_blank" rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1">
            ideogram.ai/manage-api <ExternalLink size={11} />
          </a>
        </p>
        <StatusBadge ok={!!snsStatus?.ideogram_configured} label="Ideogram API 키" />
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showIdeogramKey ? 'text' : 'password'}
              value={ideogramKey}
              onChange={e => setIdeogramKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleIdeogramSave()}
              placeholder="ideogram API key..."
              className="w-full px-3 py-2 pr-9 bg-bg border border-border rounded-lg text-[13px] text-text placeholder:text-muted font-mono focus:outline-none focus:border-primary"
            />
            <button onClick={() => setShowIdeogramKey(v => !v)} tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text">
              {showIdeogramKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button onClick={handleIdeogramSave} disabled={ideogramSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-medium disabled:opacity-50 shrink-0">
            {ideogramSaving ? <Loader2 size={13} className="animate-spin" /> : null}저장
          </button>
        </div>
        {ideogramMsg && <MsgBox msg={ideogramMsg} />}
      </SectionCard>

      {/* ── Gemini / Veo (영상) ──────────────────────────────── */}
      <SectionCard>
        <SectionTitle icon={<Key size={16} />} title="Google Gemini API Key (Veo 영상 생성)" />
        <p className="text-muted text-sm mb-4">
          숏폼 영상 자동 생성 (Veo 3.1 Lite).{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1">
            aistudio.google.com <ExternalLink size={11} />
          </a>
        </p>
        <StatusBadge ok={!!snsStatus?.gemini_configured} label="Gemini API 키 (Veo)" />
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showGeminiKey ? 'text' : 'password'}
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGeminiSave()}
              placeholder="AIza..."
              className="w-full px-3 py-2 pr-9 bg-bg border border-border rounded-lg text-[13px] text-text placeholder:text-muted font-mono focus:outline-none focus:border-primary"
            />
            <button onClick={() => setShowGeminiKey(v => !v)} tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text">
              {showGeminiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button onClick={handleGeminiSave} disabled={geminiSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-[13px] font-medium disabled:opacity-50 shrink-0">
            {geminiSaving ? <Loader2 size={13} className="animate-spin" /> : null}저장
          </button>
        </div>
        {geminiMsg && <MsgBox msg={geminiMsg} />}
      </SectionCard>

      {/* ── n8n 웹훅 (Instagram, TikTok) ─────────────────────── */}
      <SectionCard>
        <SectionTitle icon={<Link2 size={16} />} title="n8n 웹훅 자동화 (Instagram · TikTok)" />
        <p className="text-muted text-sm mb-4">
          기존 n8n 자동화의 웹훅 URL을 입력하면, OOMNI에서 발사 시 n8n을 통해 자동 업로드됩니다.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-[12px] text-muted mb-1">
              Instagram Webhook URL
              {snsStatus?.n8n_instagram_webhook && (
                <span className="ml-2 text-green-400 text-[10px]">✓ 설정됨</span>
              )}
            </label>
            <input
              value={instagramHook}
              onChange={e => setInstagramHook(e.target.value)}
              placeholder="https://your-n8n.com/webhook/instagram"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/60"
            />
          </div>
          <div>
            <label className="block text-[12px] text-muted mb-1">
              TikTok Webhook URL
              {snsStatus?.n8n_tiktok_webhook && (
                <span className="ml-2 text-green-400 text-[10px]">✓ 설정됨</span>
              )}
            </label>
            <input
              value={tiktokHook}
              onChange={e => setTiktokHook(e.target.value)}
              placeholder="https://your-n8n.com/webhook/tiktok"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/60"
            />
          </div>
          <button onClick={handleN8nSave} disabled={n8nSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-[13px] font-medium disabled:opacity-40">
            {n8nSaving ? <Loader2 size={13} className="animate-spin" /> : null}저장
          </button>
        </div>
        {n8nMsg && <MsgBox msg={n8nMsg} />}
      </SectionCard>

      {/* ── SNS OAuth (X, YouTube, LinkedIn, Naver) ──────────── */}
      <SectionCard>
        <SectionTitle icon={<Key size={16} />} title="SNS OAuth 자격증명 (X · YouTube · LinkedIn · 네이버)" />
        <p className="text-muted text-sm mb-4">
          각 플랫폼 Developer Console에서 발급한 Client ID / Secret을 입력하세요.
        </p>
        <div className="space-y-3">
          {[
            { label: 'X (Twitter)',  idState: xClientId,     setId: setXClientId,     secretState: xClientSecret,     setSecret: setXClientSecret,     ok: snsStatus?.x_configured },
            { label: 'YouTube',      idState: ytClientId,    setId: setYtClientId,    secretState: ytClientSecret,    setSecret: setYtClientSecret,    ok: snsStatus?.youtube_configured },
            { label: 'LinkedIn',     idState: liClientId,    setId: setLiClientId,    secretState: liClientSecret,    setSecret: setLiClientSecret,    ok: snsStatus?.linkedin_configured },
            { label: '네이버 블로그', idState: naverClientId, setId: setNaverClientId, secretState: naverClientSecret, setSecret: setNaverClientSecret, ok: snsStatus?.naver_configured },
          ].map(p => (
            <div key={p.label} className="p-3 bg-bg border border-border rounded-lg">
              <p className="text-[12px] font-medium text-text mb-2 flex items-center gap-2">
                {p.label}
                {p.ok && <span className="text-green-400 text-[10px]">✓ 설정됨</span>}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input value={p.idState} onChange={e => p.setId(e.target.value)}
                  placeholder="Client ID"
                  className="bg-surface border border-border rounded-lg px-3 py-2 text-[12px] text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/60" />
                <input type="password" value={p.secretState} onChange={e => p.setSecret(e.target.value)}
                  placeholder="Client Secret"
                  className="bg-surface border border-border rounded-lg px-3 py-2 text-[12px] text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/60" />
              </div>
            </div>
          ))}
          <button onClick={handleOAuthSave} disabled={oauthSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-[13px] font-medium disabled:opacity-40">
            {oauthSaving ? <Loader2 size={13} className="animate-spin" /> : null}OAuth 자격증명 저장
          </button>
        </div>
        {oauthMsg && <MsgBox msg={oauthMsg} />}
      </SectionCard>
    </div>
  )
}
