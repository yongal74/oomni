/**
 * seedResearchSources.ts
 * 앱 최초 실행 시 research_sources 테이블에 기본 소스 삽입
 * 이미 데이터가 있으면 스킵 (멱등성 보장)
 */
import { v4 as uuidv4 } from 'uuid'
import { getRawDb } from './client'

interface SourceDef {
  name: string
  url: string
  type: 'rss' | 'youtube' | 'x' | 'special'
  category: string
}

const DEFAULT_SOURCES: SourceDef[] = [
  // ── 🇰🇷 한국 AI/IT 뉴스 ───────────────────────────────
  { name: '🇰🇷 AI타임스',       url: 'https://www.aitimes.com/rss/allArticle.xml',       type: 'rss', category: 'kr_ai' },
  { name: '🇰🇷 전자신문 IT',    url: 'https://www.etnews.com/rss/section014.xml',        type: 'rss', category: 'kr_ai' },
  { name: '🇰🇷 디지털데일리',   url: 'https://ddaily.co.kr/rss/rss.xml',                type: 'rss', category: 'kr_ai' },
  { name: '🇰🇷 ZDNet Korea',   url: 'https://zdnet.co.kr/rss/latest.xml',               type: 'rss', category: 'kr_ai' },
  { name: '🇰🇷 매일경제 IT',    url: 'https://www.mk.co.kr/rss/30200030/',              type: 'rss', category: 'kr_ai' },
  { name: '🇰🇷 조선비즈',       url: 'https://biz.chosun.com/feed/rss/',                type: 'rss', category: 'kr_ai' },
  { name: '🇰🇷 한국경제 IT',    url: 'https://www.hankyung.com/feed/it',                type: 'rss', category: 'kr_ai' },
  { name: '🇰🇷 뉴스1 IT/과학',  url: 'https://news1.kr/rss/articles/?cId=105',          type: 'rss', category: 'kr_ai' },
  { name: '🇰🇷 연합뉴스 IT',    url: 'https://www.yonhapnewstv.co.kr/RSS/news.xml',     type: 'rss', category: 'kr_ai' },
  { name: '🇰🇷 매일경제 증권',   url: 'https://www.mk.co.kr/rss/30100041/',              type: 'rss', category: 'kr_finance' },
  { name: '🇰🇷 한국경제 금융',   url: 'https://www.hankyung.com/feed/finance',           type: 'rss', category: 'kr_finance' },
  { name: '🇰🇷 조선비즈 금융',   url: 'https://biz.chosun.com/feed/rss/finance/',        type: 'rss', category: 'kr_finance' },

  // ── 🇺🇸 미국 AI 전문 뉴스 ─────────────────────────────
  { name: '🇺🇸 TechCrunch AI',  url: 'https://techcrunch.com/category/artificial-intelligence/feed/', type: 'rss', category: 'us_ai' },
  { name: '🇺🇸 The Verge AI',   url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', type: 'rss', category: 'us_ai' },
  { name: '🇺🇸 VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/',        type: 'rss', category: 'us_ai' },
  { name: '🇺🇸 Wired AI',       url: 'https://www.wired.com/feed/tag/artificial-intelligence/rss', type: 'rss', category: 'us_ai' },
  { name: '🇺🇸 MIT Tech Review', url: 'https://www.technologyreview.com/feed/',           type: 'rss', category: 'us_ai' },
  { name: '🇺🇸 Ars Technica',   url: 'https://arstechnica.com/feed/',                    type: 'rss', category: 'us_ai' },
  { name: '🇺🇸 ZDNet AI',       url: 'https://www.zdnet.com/topic/artificial-intelligence/rss.xml', type: 'rss', category: 'us_ai' },
  { name: '🇺🇸 NVIDIA Blog',    url: 'https://feeds.feedburner.com/nvidiablog',           type: 'rss', category: 'us_ai' },
  { name: '🇺🇸 ML Mastery',     url: 'https://machinelearningmastery.com/feed/',          type: 'rss', category: 'us_ai' },
  { name: '🇺🇸 Towards Data Science', url: 'https://towardsdatascience.com/feed',         type: 'rss', category: 'us_ai' },

  // ── 🌐 AI 공식 블로그 ─────────────────────────────────
  { name: '🌐 OpenAI Blog',     url: 'https://openai.com/blog/rss.xml',                  type: 'rss', category: 'global_ai' },
  { name: '🌐 Anthropic Blog',  url: 'https://www.anthropic.com/rss.xml',                type: 'rss', category: 'global_ai' },
  { name: '🌐 Google DeepMind', url: 'https://deepmind.google/blog/rss.xml',             type: 'rss', category: 'global_ai' },
  { name: '🌐 Meta AI Blog',    url: 'https://ai.meta.com/blog/rss/',                    type: 'rss', category: 'global_ai' },
  { name: '🌐 Microsoft AI',    url: 'https://blogs.microsoft.com/ai/feed/',             type: 'rss', category: 'global_ai' },
  { name: '🌐 Google Research', url: 'https://research.google/blog/rss/',                type: 'rss', category: 'global_ai' },
  { name: '🌐 HuggingFace',     url: 'https://huggingface.co/blog/feed.xml',             type: 'rss', category: 'global_ai' },
  { name: '🌐 Stability AI',    url: 'https://stability.ai/blog/rss.xml',                type: 'rss', category: 'global_ai' },
  { name: '🌐 Mistral AI',      url: 'https://mistral.ai/news/rss.xml',                  type: 'rss', category: 'global_ai' },
  { name: '🌐 Reuters AI',      url: 'https://www.reuters.com/technology/artificial-intelligence/rss/', type: 'rss', category: 'global_ai' },
  { name: '🌐 AP News AI',      url: 'https://apnews.com/artificial-intelligence.rss',   type: 'rss', category: 'global_ai' },

  // ── ⛓ 블록체인/크립토 ────────────────────────────────
  { name: '⛓ CoinDesk',        url: 'https://coindesk.com/arc/outboundfeeds/rss/',       type: 'rss', category: 'crypto' },
  { name: '⛓ CoinTelegraph',   url: 'https://cointelegraph.com/rss',                     type: 'rss', category: 'crypto' },
  { name: '⛓ Decrypt',         url: 'https://decrypt.co/feed',                           type: 'rss', category: 'crypto' },
  { name: '⛓ The Block',       url: 'https://www.theblock.co/rss.xml',                   type: 'rss', category: 'crypto' },
  { name: '⛓ Blockworks',      url: 'https://blockworks.co/feed',                        type: 'rss', category: 'crypto' },
  { name: '⛓ DL News',         url: 'https://www.dlnews.com/rss.xml',                    type: 'rss', category: 'crypto' },
  { name: '⛓ CT Stablecoins',  url: 'https://cointelegraph.com/tags/stablecoins/rss',    type: 'rss', category: 'crypto' },
  { name: '🇰🇷 토큰포스트',      url: 'https://www.tokenpost.kr/rss/all',                  type: 'rss', category: 'crypto' },
  { name: '🟠 Reddit/Crypto',   url: 'https://www.reddit.com/r/CryptoCurrency/.rss',      type: 'rss', category: 'crypto' },
  { name: '🟠 Reddit/Ethereum', url: 'https://www.reddit.com/r/ethereum/.rss',            type: 'rss', category: 'crypto' },
  { name: '🟠 Reddit/Bitcoin',  url: 'https://www.reddit.com/r/Bitcoin/.rss',             type: 'rss', category: 'crypto' },
  { name: '🟠 Reddit/DeFi',     url: 'https://www.reddit.com/r/defi/.rss',                type: 'rss', category: 'crypto' },
  { name: '🟠 Reddit/Stablecoin', url: 'https://www.reddit.com/r/StablecoinEconomy/.rss', type: 'rss', category: 'crypto' },
  { name: '🟠 Reddit/Web3',     url: 'https://www.reddit.com/r/web3/.rss',                type: 'rss', category: 'crypto' },

  // ── 💰 금융/시장 ────────────────────────────────────
  { name: '💹 Bloomberg Tech',  url: 'https://feeds.bloomberg.com/technology/news.rss',   type: 'rss', category: 'finance' },
  { name: '💹 MarketWatch',     url: 'https://feeds.marketwatch.com/marketwatch/topstories/', type: 'rss', category: 'finance' },
  { name: '💹 Yahoo Finance',   url: 'https://finance.yahoo.com/news/rssindex',            type: 'rss', category: 'finance' },
  { name: '💹 Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews',    type: 'rss', category: 'finance' },
  { name: '💹 FT Technology',   url: 'https://www.ft.com/technology?format=rss',          type: 'rss', category: 'finance' },
  { name: '💹 Investing.com',   url: 'https://www.investing.com/rss/news.rss',             type: 'rss', category: 'finance' },
  { name: '💹 Seeking Alpha',   url: 'https://seekingalpha.com/feed.xml',                  type: 'rss', category: 'finance' },
  { name: '🟠 Reddit/Investing', url: 'https://www.reddit.com/r/investing/.rss',           type: 'rss', category: 'finance' },
  { name: '🟠 Reddit/Stocks',   url: 'https://www.reddit.com/r/stocks/.rss',               type: 'rss', category: 'finance' },
  { name: '🟠 Reddit/VC',       url: 'https://www.reddit.com/r/venturecapital/.rss',       type: 'rss', category: 'finance' },

  // ── 💻 테크 종합 ─────────────────────────────────────
  { name: '💻 TechCrunch',      url: 'https://techcrunch.com/feed/',                       type: 'rss', category: 'tech' },
  { name: '💻 The Verge',       url: 'https://www.theverge.com/rss/index.xml',             type: 'rss', category: 'tech' },
  { name: '💻 Wired',           url: 'https://www.wired.com/feed/rss',                     type: 'rss', category: 'tech' },
  { name: '💻 Engadget',        url: 'https://www.engadget.com/rss.xml',                   type: 'rss', category: 'tech' },
  { name: '💻 DEV.to',          url: 'https://dev.to/feed/',                               type: 'rss', category: 'tech' },
  { name: '💻 Reuters Tech',    url: 'https://feeds.reuters.com/reuters/technologyNews',   type: 'rss', category: 'tech' },
  { name: '💻 BBC Technology',  url: 'https://www.bbc.com/news/technology/rss.xml',        type: 'rss', category: 'tech' },
  { name: '🟠 Reddit/Technology', url: 'https://www.reddit.com/r/technology/.rss',         type: 'rss', category: 'tech' },
  { name: '🟠 Reddit/Futurology', url: 'https://www.reddit.com/r/Futurology/.rss',         type: 'rss', category: 'tech' },
  { name: '🟠 Reddit/Programming', url: 'https://www.reddit.com/r/programming/.rss',       type: 'rss', category: 'tech' },

  // ── 🔬 연구/커뮤니티 ─────────────────────────────────
  { name: '🔬 arXiv AI/ML',     url: 'special://arxiv',                                    type: 'special', category: 'research' },
  { name: '🐙 GitHub Trending', url: 'special://github_trending',                           type: 'special', category: 'research' },
  { name: '🔶 Hacker News',     url: 'special://hackernews',                                type: 'special', category: 'research' },
  { name: '🔬 Nature',          url: 'https://www.nature.com/nature.rss',                   type: 'rss', category: 'research' },
  { name: '🔬 ScienceDaily AI', url: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml', type: 'rss', category: 'research' },
  { name: '🟠 Reddit/ML',       url: 'https://www.reddit.com/r/MachineLearning/.rss',       type: 'rss', category: 'research' },
  { name: '🟠 Reddit/AI',       url: 'https://www.reddit.com/r/artificial/.rss',            type: 'rss', category: 'research' },
  { name: '🟠 Reddit/LocalLLaMA', url: 'https://www.reddit.com/r/LocalLLaMA/.rss',          type: 'rss', category: 'research' },
  { name: '🟠 Reddit/ChatGPT',  url: 'https://www.reddit.com/r/ChatGPT/.rss',               type: 'rss', category: 'research' },
  { name: '🟠 Reddit/Singularity', url: 'https://www.reddit.com/r/singularity/.rss',        type: 'rss', category: 'research' },
  { name: '🟠 Reddit/SaaS',     url: 'https://www.reddit.com/r/SaaS/.rss',                  type: 'rss', category: 'research' },
  { name: '🟠 Reddit/Startups', url: 'https://www.reddit.com/r/startups/.rss',              type: 'rss', category: 'research' },

  // ── 📺 YouTube AI/ML ─────────────────────────────────
  { name: '📺 Lex Fridman',     url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCnUYZLuoy1rq1aVMwx4aTzw', type: 'youtube', category: 'youtube_ai' },
  { name: '📺 Two Minute Papers', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg', type: 'youtube', category: 'youtube_ai' },
  { name: '📺 Yannic Kilcher',  url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCZHmQk67mSJgfCCTn7xBfew', type: 'youtube', category: 'youtube_ai' },
  { name: '📺 3Blue1Brown',     url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw', type: 'youtube', category: 'youtube_ai' },
  { name: '📺 Fireship',        url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA', type: 'youtube', category: 'youtube_ai' },
  { name: '📺 Sentdex',         url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCfzlCWGWYyiqLiNez2Ms42A', type: 'youtube', category: 'youtube_ai' },
  { name: '📺 AI Explained',    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCiT9RITQ9PW6BhXK0y2jaeg', type: 'youtube', category: 'youtube_ai' },
  { name: '📺 Google DeepMind', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCP7jMXSY2xbc3KCAE0MHQ-A', type: 'youtube', category: 'youtube_ai' },
  { name: '📺 OpenAI',          url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXZCJLdBC09xxP5ZkILRSjQ', type: 'youtube', category: 'youtube_ai' },
  { name: '📺 Matt Wolfe AI',   url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCEBb1b_L6zDS3xTUrIALZOw', type: 'youtube', category: 'youtube_ai' },
  { name: '📺 Andrej Karpathy', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCVhsj1E2osy-04YFZ2GnN9Q', type: 'youtube', category: 'youtube_ai' },

  // ── 📺 YouTube 크립토/금융 ───────────────────────────
  { name: '📺 Coin Bureau',     url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCqK_GSMbpiV8spgD3ZGloSw', type: 'youtube', category: 'youtube_crypto' },
  { name: '📺 Benjamin Cowen',  url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCRvqjQPSeaWn-uEx-w0XLIg', type: 'youtube', category: 'youtube_crypto' },
  { name: '📺 Altcoin Daily',   url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCphTMF_MJYdGFmcl0SDLKZQ', type: 'youtube', category: 'youtube_crypto' },

  // ── 📺 YouTube 테크 ──────────────────────────────────
  { name: '📺 MKBHD',           url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCVLZmDKeT-mV4H3ToYqIFZg', type: 'youtube', category: 'youtube_tech' },
  { name: '📺 TechCrunch',      url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCCjyq_K1Xwfg8Lndy7lKMpA', type: 'youtube', category: 'youtube_tech' },
  { name: '📺 Bloomberg Tech',  url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCuhZNX72wiEx-XArL2LaSDg', type: 'youtube', category: 'youtube_tech' },

  // ── 🐦 X (Twitter) ───────────────────────────────────
  { name: '🐦 X/@sama',         url: 'x://sama',             type: 'x', category: 'x_ai' },
  { name: '🐦 X/@karpathy',     url: 'x://karpathy',         type: 'x', category: 'x_ai' },
  { name: '🐦 X/@naval',        url: 'x://naval',            type: 'x', category: 'x_ai' },
  { name: '🐦 X/@benedictevans', url: 'x://benedictevans',   type: 'x', category: 'x_ai' },
  { name: '🐦 X/@ylecun',       url: 'x://ylecun',           type: 'x', category: 'x_ai' },
  { name: '🐦 X/@AndrewYNg',    url: 'x://AndrewYNg',        type: 'x', category: 'x_ai' },
  { name: '🐦 X/@VitalikButerin', url: 'x://VitalikButerin', type: 'x', category: 'x_crypto' },
  { name: '🐦 X/@balajis',      url: 'x://balajis',          type: 'x', category: 'x_crypto' },

  // ── 🌐 Google News ───────────────────────────────────
  { name: '🌐 Google뉴스 AI 한국어', url: 'https://news.google.com/rss/search?q=인공지능+AI&hl=ko&gl=KR&ceid=KR:ko', type: 'rss', category: 'google_news' },
  { name: '🌐 Google뉴스 크립토 KR', url: 'https://news.google.com/rss/search?q=블록체인+스테이블코인&hl=ko&gl=KR&ceid=KR:ko', type: 'rss', category: 'google_news' },
  { name: '🌐 Google News AI US', url: 'https://news.google.com/rss/search?q=artificial+intelligence&hl=en-US&gl=US&ceid=US:en', type: 'rss', category: 'google_news' },
  { name: '🌐 Google News Stablecoin', url: 'https://news.google.com/rss/search?q=stablecoin+blockchain&hl=en-US&gl=US&ceid=US:en', type: 'rss', category: 'google_news' },
]

export const CATEGORY_LABELS: Record<string, string> = {
  kr_ai:         '🇰🇷 한국 AI/IT',
  kr_finance:    '🇰🇷 한국 금융',
  us_ai:         '🇺🇸 미국 AI',
  global_ai:     '🌐 글로벌 AI 블로그',
  crypto:        '⛓ 블록체인/크립토',
  finance:       '💰 금융/시장',
  tech:          '💻 테크 종합',
  research:      '🔬 연구/커뮤니티',
  youtube_ai:    '📺 YouTube AI',
  youtube_crypto:'📺 YouTube 크립토',
  youtube_tech:  '📺 YouTube 테크',
  x_ai:          '🐦 X AI 인플루언서',
  x_crypto:      '🐦 X 크립토 인플루언서',
  google_news:   '🌐 Google News',
}

export function seedResearchSources(): void {
  try {
    const db = getRawDb()
    const count = (db.prepare('SELECT COUNT(*) as c FROM research_sources').get() as { c: number }).c
    if (count > 0) return // 이미 시드됨

    const insert = db.prepare(
      `INSERT INTO research_sources (id, name, url, type, category, is_active, is_custom)
       VALUES (?, ?, ?, ?, ?, 1, 0)`
    )
    const insertMany = db.transaction((sources: SourceDef[]) => {
      for (const s of sources) {
        insert.run(uuidv4(), s.name, s.url, s.type, s.category)
      }
    })
    insertMany(DEFAULT_SOURCES)
    console.log(`[Research] ${DEFAULT_SOURCES.length}개 기본 소스 시드 완료`)
  } catch (err) {
    console.error('[Research] 소스 시드 오류:', err)
  }
}
