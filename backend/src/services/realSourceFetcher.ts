/**
 * realSourceFetcher.ts — 실제 외부 소스에서 기사/논문/트렌드 수집
 * API 키 불필요한 공개 RSS/API만 사용
 */

export interface FetchedItem {
  title: string
  summary: string
  url: string
  source: string
  published_at: string
  author?: string
}

// ── 날짜 헬퍼 ────────────────────────────────────────────

function cutoffDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

/** task 문자열에서 기간(days) 파싱 */
export function parseDaysFromTask(task: string): number {
  if (/오늘|today/i.test(task)) return 1
  if (/어제|yesterday/i.test(task)) return 2
  if (/최근\s*(\d+)\s*일|지난\s*(\d+)\s*일|past\s*(\d+)\s*day/i.test(task)) {
    const m = task.match(/최근\s*(\d+)\s*일|지난\s*(\d+)\s*일|past\s*(\d+)\s*day/i)
    const n = parseInt(m?.[1] ?? m?.[2] ?? m?.[3] ?? '3')
    return isNaN(n) ? 3 : Math.min(n, 30)
  }
  if (/이번\s*주|지난\s*주|this\s*week|last\s*week/i.test(task)) return 7
  if (/이번\s*달|지난\s*달|this\s*month|last\s*month/i.test(task)) return 30
  return 3 // 기본값: 최근 3일
}

// ── RSS XML 파서 (의존성 없이 regex 기반) ─────────────────

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function parseRssItems(xml: string, sourceName: string, cutoff: Date): FetchedItem[] {
  const items: FetchedItem[] = []
  const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]

    const titleRaw = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? ''
    const title = decodeHtmlEntities(titleRaw.replace(/<[^>]+>/g, ''))
    if (!title) continue

    // link: RSS 2.0 or Atom
    const linkRss = block.match(/<link>([^<]+)<\/link>/)?.[1]?.trim()
    const linkAtom = block.match(/<link[^>]+href="([^"]+)"/)?.[1]?.trim()
    const link = linkRss ?? linkAtom ?? ''

    // description / summary / content
    const descRaw = (
      block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] ??
      block.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/)?.[1] ??
      ''
    ).replace(/<[^>]+>/g, '').trim()
    const summary = decodeHtmlEntities(descRaw).slice(0, 400)

    // date
    const pubRaw = (
      block.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ??
      block.match(/<published>([^<]+)<\/published>/)?.[1] ??
      block.match(/<updated>([^<]+)<\/updated>/)?.[1] ??
      ''
    ).trim()
    const pub = pubRaw ? new Date(pubRaw) : new Date()
    if (isNaN(pub.getTime()) || pub < cutoff) continue

    items.push({ title, summary, url: link, source: sourceName, published_at: pub.toISOString() })
  }
  return items
}

// ── arXiv API (논문) ─────────────────────────────────────

async function fetchArxiv(query: string, days: number): Promise<FetchedItem[]> {
  try {
    const cutoff = cutoffDate(days)
    const q = encodeURIComponent(query || 'artificial intelligence')
    const url = `https://export.arxiv.org/api/query?search_query=all:${q}&sortBy=submittedDate&sortOrder=descending&max_results=20`
    const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'OOMNI-Research/4.1' } })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRssItems(xml, '📄 arXiv', cutoff)
  } catch { return [] }
}

// ── Hacker News (Algolia API) ────────────────────────────

async function fetchHackerNews(days: number): Promise<FetchedItem[]> {
  try {
    const cutoff = cutoffDate(days)
    const ts = Math.floor(cutoff.getTime() / 1000)
    const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>${ts},points>10&hitsPerPage=30`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json() as {
      hits: Array<{ title: string; url?: string; points: number; created_at: string; story_text?: string }>
    }
    return (data.hits ?? [])
      .filter(h => h.url && h.title)
      .map(h => ({
        title: h.title,
        summary: (h.story_text ?? '').replace(/<[^>]+>/g, '').slice(0, 300),
        url: h.url!,
        source: '🔶 Hacker News',
        published_at: h.created_at,
      }))
  } catch { return [] }
}

// ── GitHub Trending (GitHub Search API) ─────────────────

async function fetchGithubTrending(days: number): Promise<FetchedItem[]> {
  try {
    const cutoff = cutoffDate(days)
    const dateStr = cutoff.toISOString().slice(0, 10)
    const url = `https://api.github.com/search/repositories?q=stars:>100+created:>${dateStr}&sort=stars&order=desc&per_page=10`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'OOMNI-Research/4.1' },
    })
    if (!res.ok) return []
    const data = await res.json() as { items: Array<{ name: string; full_name: string; description: string; html_url: string; created_at: string; stargazers_count: number }> }
    return (data.items ?? []).map(r => ({
      title: `[GitHub] ${r.full_name} ⭐${r.stargazers_count}`,
      summary: r.description ?? '',
      url: r.html_url,
      source: '🐙 GitHub Trending',
      published_at: r.created_at,
    }))
  } catch { return [] }
}

// ── Generic RSS 피드 ─────────────────────────────────────

async function fetchRss(feedUrl: string, sourceName: string, days: number): Promise<FetchedItem[]> {
  try {
    const cutoff = cutoffDate(days)
    const res = await fetch(feedUrl, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'OOMNI-Research/4.1', 'Accept': 'application/rss+xml, application/atom+xml, text/xml, */*' },
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRssItems(xml, sourceName, cutoff)
  } catch { return [] }
}

// ── 소스 정의 ────────────────────────────────────────────

interface RssSource { url: string; name: string }

// ── X(Twitter) RSS via nitter 미러 ──────────────────────
// nitter 공개 인스턴스 (무작위 선택으로 부하 분산)
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.1d4.us',
]

async function fetchXRss(handle: string, days: number): Promise<FetchedItem[]> {
  const cutoff = cutoffDate(days)
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}/${handle}/rss`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'OOMNI-Research/4.1' },
      })
      if (!res.ok) continue
      const xml = await res.text()
      const items = parseRssItems(xml, `🐦 X/@${handle}`, cutoff)
      if (items.length > 0) return items
    } catch { continue }
  }
  return []
}

// ── 🇰🇷 한국 AI/IT 뉴스 ──────────────────────────────────
const SOURCES_KR_AI: RssSource[] = [
  { url: 'https://www.aitimes.com/rss/allArticle.xml',       name: '🇰🇷 AI타임스' },
  { url: 'https://www.etnews.com/rss/section014.xml',        name: '🇰🇷 전자신문 IT' },
  { url: 'https://ddaily.co.kr/rss/rss.xml',                name: '🇰🇷 디지털데일리' },
  { url: 'https://zdnet.co.kr/rss/latest.xml',              name: '🇰🇷 ZDNet Korea' },
  { url: 'https://www.mk.co.kr/rss/30200030/',              name: '🇰🇷 매일경제 IT' },
  { url: 'https://biz.chosun.com/feed/rss/',                name: '🇰🇷 조선비즈' },
  { url: 'https://www.hankyung.com/feed/it',                name: '🇰🇷 한국경제 IT' },
  { url: 'https://news1.kr/rss/articles/?cId=105',          name: '🇰🇷 뉴스1 IT/과학' },
  { url: 'https://www.yonhapnewstv.co.kr/RSS/news.xml',     name: '🇰🇷 연합뉴스 IT' },
]

// ── 🇺🇸 미국 AI 전문 뉴스 ────────────────────────────────
const SOURCES_US_AI: RssSource[] = [
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', name: '🇺🇸 TechCrunch AI' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', name: '🇺🇸 The Verge AI' },
  { url: 'https://venturebeat.com/category/ai/feed/', name: '🇺🇸 VentureBeat AI' },
  { url: 'https://www.wired.com/feed/tag/artificial-intelligence/rss', name: '🇺🇸 Wired AI' },
  { url: 'https://www.technologyreview.com/feed/', name: '🇺🇸 MIT Tech Review' },
  { url: 'https://arstechnica.com/feed/', name: '🇺🇸 Ars Technica' },
  { url: 'https://www.zdnet.com/topic/artificial-intelligence/rss.xml', name: '🇺🇸 ZDNet AI' },
  { url: 'https://feeds.feedburner.com/nvidiablog', name: '🇺🇸 NVIDIA Blog' },
  { url: 'https://machinelearningmastery.com/feed/', name: '🇺🇸 ML Mastery' },
  { url: 'https://towardsdatascience.com/feed', name: '🇺🇸 Towards Data Science' },
]

// ── 🌐 글로벌 AI 기업/연구소 공식 블로그 ─────────────────
const SOURCES_GLOBAL_AI: RssSource[] = [
  { url: 'https://openai.com/blog/rss.xml',                        name: '🌐 OpenAI Blog' },
  { url: 'https://www.anthropic.com/rss.xml',                      name: '🌐 Anthropic Blog' },
  { url: 'https://deepmind.google/blog/rss.xml',                   name: '🌐 Google DeepMind' },
  { url: 'https://ai.meta.com/blog/rss/',                          name: '🌐 Meta AI Blog' },
  { url: 'https://blogs.microsoft.com/ai/feed/',                   name: '🌐 Microsoft AI' },
  { url: 'https://research.google/blog/rss/',                      name: '🌐 Google Research' },
  { url: 'https://huggingface.co/blog/feed.xml',                   name: '🌐 HuggingFace Blog' },
  { url: 'https://stability.ai/blog/rss.xml',                      name: '🌐 Stability AI' },
  { url: 'https://mistral.ai/news/rss.xml',                        name: '🌐 Mistral AI' },
  { url: 'https://www.reuters.com/technology/artificial-intelligence/rss/', name: '🌐 Reuters AI' },
  { url: 'https://apnews.com/artificial-intelligence.rss',          name: '🌐 AP News AI' },
  { url: 'https://www.bbc.com/news/technology/rss.xml',            name: '🌐 BBC Technology' },
]

// ── 📺 YouTube 채널 RSS (API 키 불필요) ──────────────────
// 형식: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID

interface YtChannel { id: string; name: string }

const YT_AI_CHANNELS: YtChannel[] = [
  { id: 'UCnUYZLuoy1rq1aVMwx4aTzw', name: '📺 Lex Fridman' },
  { id: 'UCbfYPyITQ-7l4upoX8nvctg', name: '📺 Two Minute Papers' },
  { id: 'UCZHmQk67mSJgfCCTn7xBfew', name: '📺 Yannic Kilcher' },
  { id: 'UCYO_jab_esuFRV4b17AJtAw', name: '📺 3Blue1Brown' },
  { id: 'UCsBjURrPoezykLs9EqgamOA', name: '📺 Fireship' },
  { id: 'UCfzlCWGWYyiqLiNez2Ms42A', name: '📺 Sentdex' },
  { id: 'UCiT9RITQ9PW6BhXK0y2jaeg', name: '📺 AI Explained' },
  { id: 'UCP7jMXSY2xbc3KCAE0MHQ-A', name: '📺 Google DeepMind' },
  { id: 'UCXZCJLdBC09xxP5ZkILRSjQ', name: '📺 OpenAI' },
  { id: 'UCEBb1b_L6zDS3xTUrIALZOw', name: '📺 Matt Wolfe AI' },
  { id: 'UCVhsj1E2osy-04YFZ2GnN9Q', name: '📺 Andrej Karpathy' },
  { id: 'UC0uTPqBCFIpZxlz_Lv1tk_g', name: '📺 Practical AI' },
]

const YT_CRYPTO_CHANNELS: YtChannel[] = [
  { id: 'UCqK_GSMbpiV8spgD3ZGloSw', name: '📺 Coin Bureau' },
  { id: 'UCRvqjQPSeaWn-uEx-w0XLIg', name: '📺 Benjamin Cowen' },
  { id: 'UCvJJ_dzjViJCoLf5uKUTwoA', name: '📺 CNBC Crypto' },
  { id: 'UCphTMF_MJYdGFmcl0SDLKZQ', name: '📺 Altcoin Daily' },
  { id: 'UC4nXWTjZqK4bv7feoRntSog', name: '📺 Crypto Banter' },
]

const YT_TECH_CHANNELS: YtChannel[] = [
  { id: 'UCVLZmDKeT-mV4H3ToYqIFZg', name: '📺 Marques Brownlee' },
  { id: 'UCddiUEpeqJcYeBxX1IVBKvQ', name: '📺 The Verge' },
  { id: 'UCBcRF18a7Qf58cCRy5xuWwQ', name: '📺 TechCrunch' },
  { id: 'UCuhZNX72wiEx-XArL2LaSDg', name: '📺 Bloomberg Technology' },
]

function ytUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
}

async function fetchYouTubeChannels(channels: YtChannel[], days: number): Promise<FetchedItem[]> {
  const results = await Promise.allSettled(
    channels.map(ch => fetchRss(ytUrl(ch.id), ch.name, days))
  )
  const all: FetchedItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }
  return all
}

// ── ⛓ 블록체인/크립토 뉴스 ──────────────────────────────
const SOURCES_CRYPTO: RssSource[] = [
  { url: 'https://coindesk.com/arc/outboundfeeds/rss/',              name: '⛓ CoinDesk' },
  { url: 'https://cointelegraph.com/rss',                            name: '⛓ CoinTelegraph' },
  { url: 'https://decrypt.co/feed',                                  name: '⛓ Decrypt' },
  { url: 'https://www.theblock.co/rss.xml',                          name: '⛓ The Block' },
  { url: 'https://blockworks.co/feed',                               name: '⛓ Blockworks' },
  { url: 'https://www.dlnews.com/rss.xml',                           name: '⛓ DL News' },
  { url: 'https://www.reddit.com/r/CryptoCurrency/.rss',             name: '🟠 Reddit/Crypto' },
  { url: 'https://www.reddit.com/r/ethereum/.rss',                   name: '🟠 Reddit/Ethereum' },
  { url: 'https://www.reddit.com/r/Bitcoin/.rss',                    name: '🟠 Reddit/Bitcoin' },
  { url: 'https://www.reddit.com/r/web3/.rss',                       name: '🟠 Reddit/Web3' },
  // 국내 크립토
  { url: 'https://www.tokenpost.kr/rss/all',                         name: '🇰🇷 토큰포스트' },
  { url: 'https://cobak.co.kr/rss',                                  name: '🇰🇷 코박' },
]

// ── 💰 금융/스테이블코인/매크로 뉴스 ────────────────────
const SOURCES_FINANCE: RssSource[] = [
  // 스테이블코인 전문
  { url: 'https://cointelegraph.com/tags/stablecoins/rss',           name: '💵 CT Stablecoins' },
  { url: 'https://coindesk.com/tag/stablecoins/arc/outboundfeeds/rss/', name: '💵 CD Stablecoins' },
  // 금융 매크로
  { url: 'https://feeds.bloomberg.com/technology/news.rss',          name: '💹 Bloomberg Tech' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/',    name: '💹 MarketWatch' },
  { url: 'https://finance.yahoo.com/news/rssindex',                  name: '💹 Yahoo Finance' },
  { url: 'https://feeds.reuters.com/reuters/businessNews',           name: '💹 Reuters Business' },
  { url: 'https://www.ft.com/technology?format=rss',                 name: '💹 FT Technology' },
  { url: 'https://www.investing.com/rss/news.rss',                   name: '💹 Investing.com' },
  { url: 'https://seekingalpha.com/feed.xml',                        name: '💹 Seeking Alpha' },
  // 국내 금융
  { url: 'https://www.mk.co.kr/rss/30100041/',                       name: '🇰🇷 매일경제 증권' },
  { url: 'https://www.hankyung.com/feed/finance',                    name: '🇰🇷 한국경제 금융' },
  { url: 'https://biz.chosun.com/feed/rss/finance/',                 name: '🇰🇷 조선비즈 금융' },
  { url: 'https://www.reddit.com/r/StablecoinEconomy/.rss',          name: '🟠 Reddit/Stablecoin' },
  { url: 'https://www.reddit.com/r/defi/.rss',                       name: '🟠 Reddit/DeFi' },
]

// ── 💻 테크 뉴스 (AI 외 종합) ────────────────────────────
const SOURCES_TECH: RssSource[] = [
  { url: 'https://techcrunch.com/feed/',                             name: '💻 TechCrunch' },
  { url: 'https://www.theverge.com/rss/index.xml',                   name: '💻 The Verge' },
  { url: 'https://arstechnica.com/feed/',                            name: '💻 Ars Technica' },
  { url: 'https://www.wired.com/feed/rss',                           name: '💻 Wired' },
  { url: 'https://www.engadget.com/rss.xml',                         name: '💻 Engadget' },
  { url: 'https://9to5mac.com/feed/',                                name: '💻 9to5Mac' },
  { url: 'https://www.androidauthority.com/feed/',                   name: '💻 Android Authority' },
  { url: 'https://www.reddit.com/r/technology/.rss',                 name: '🟠 Reddit/Technology' },
  { url: 'https://www.reddit.com/r/Futurology/.rss',                 name: '🟠 Reddit/Futurology' },
  { url: 'https://www.reddit.com/r/programming/.rss',                name: '🟠 Reddit/Programming' },
]

const SOURCES_COMMON: RssSource[] = [
  ...SOURCES_US_AI.slice(0, 4),
  { url: 'https://hnrss.org/frontpage', name: '🔶 HN Frontpage' },
  { url: 'https://feeds.reuters.com/reuters/technologyNews', name: '📰 Reuters Technology' },
]

const SOURCES_BUSINESS: RssSource[] = [
  // 스타트업/VC
  { url: 'https://techcrunch.com/category/startups/feed/', name: '🔵 TechCrunch Startups' },
  { url: 'https://techcrunch.com/category/venture/feed/', name: '🔵 TechCrunch VC' },
  { url: 'https://www.producthunt.com/feed', name: '🚀 Product Hunt' },
  // 금융/시장
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', name: '📈 MarketWatch' },
  { url: 'https://finance.yahoo.com/news/rssindex', name: '📈 Yahoo Finance' },
  { url: 'https://feeds.reuters.com/reuters/businessNews', name: '📰 Reuters Business' },
  { url: 'https://www.ft.com/technology?format=rss', name: '📰 FT Technology' },
  // Reddit 커뮤니티
  { url: 'https://www.reddit.com/r/startups/.rss', name: '🟠 Reddit/Startups' },
  { url: 'https://www.reddit.com/r/entrepreneur/.rss', name: '🟠 Reddit/Entrepreneur' },
  { url: 'https://www.reddit.com/r/SaaS/.rss', name: '🟠 Reddit/SaaS' },
  { url: 'https://www.reddit.com/r/investing/.rss', name: '🟠 Reddit/Investing' },
  { url: 'https://www.reddit.com/r/stocks/.rss', name: '🟠 Reddit/Stocks' },
  { url: 'https://www.reddit.com/r/venturecapital/.rss', name: '🟠 Reddit/VC' },
]

const SOURCES_INFORMATIONAL: RssSource[] = [
  { url: 'https://www.technologyreview.com/feed/', name: '🔬 MIT Tech Review' },
  { url: 'https://dev.to/feed/', name: '💻 DEV.to' },
  { url: 'https://www.nature.com/nature.rss', name: '🔬 Nature' },
  { url: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml', name: '🔬 ScienceDaily AI' },
  // Reddit AI/ML
  { url: 'https://www.reddit.com/r/MachineLearning/.rss', name: '🟠 Reddit/ML' },
  { url: 'https://www.reddit.com/r/artificial/.rss', name: '🟠 Reddit/AI' },
  { url: 'https://www.reddit.com/r/LocalLLaMA/.rss', name: '🟠 Reddit/LocalLLaMA' },
  { url: 'https://www.reddit.com/r/ChatGPT/.rss', name: '🟠 Reddit/ChatGPT' },
  { url: 'https://www.reddit.com/r/singularity/.rss', name: '🟠 Reddit/Singularity' },
  { url: 'https://www.reddit.com/r/programming/.rss', name: '🟠 Reddit/Programming' },
  // 국내
  { url: 'https://www.aitimes.com/rss/allArticle.xml', name: '🇰🇷 AI타임스' },
  { url: 'https://www.etnews.com/rss/section014.xml', name: '🇰🇷 전자신문 IT' },
  { url: 'https://ddaily.co.kr/rss/rss.xml', name: '🇰🇷 디지털데일리' },
  { url: 'https://zdnet.co.kr/rss/latest.xml', name: '🇰🇷 ZDNet Korea' },
]

const SOURCES_DEFAULT: RssSource[] = [
  { url: 'https://techcrunch.com/feed/', name: '🔵 TechCrunch' },
  { url: 'https://www.theverge.com/rss/index.xml', name: '🔵 The Verge' },
  { url: 'https://www.wired.com/feed/rss', name: '🔵 Wired' },
  { url: 'https://feeds.reuters.com/reuters/technologyNews', name: '📰 Reuters Tech' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', name: '📈 MarketWatch' },
  { url: 'https://www.reddit.com/r/technology/.rss', name: '🟠 Reddit/Technology' },
  { url: 'https://www.reddit.com/r/artificial/.rss', name: '🟠 Reddit/AI' },
  { url: 'https://www.reddit.com/r/Futurology/.rss', name: '🟠 Reddit/Futurology' },
]

// X 계정 — 트랙별 인플루언서/기관
const X_HANDLES_BUSINESS = [
  'sama', 'paulg', 'naval', 'benedictevans', 'pmarca',   // AI/VC
  'balajis', 'cz_binance', 'VitalikButerin', 'brian_armstrong', // 크립토
  'elonmusk', 'SBF_FTX',                                 // 금융/시장
]
const X_HANDLES_INFORMATIONAL = [
  'ylecun', 'karpathy', 'AndrewYNg', 'goodfellow_ian',   // AI 연구
  'VitalikButerin', 'balajis',                            // 블록체인 기술
]
const X_HANDLES_DEFAULT = [
  'sama', 'karpathy', 'benedictevans', 'naval',
  'VitalikButerin', 'balajis',
]

// ── 메인 fetch 함수 ───────────────────────────────────────

// ── DB에서 활성 소스 읽기 ────────────────────────────────

export interface DbSource {
  id: string
  name: string
  url: string
  type: 'rss' | 'youtube' | 'x' | 'special'
  category: string
  is_active: number
}

export async function fetchRealSources(
  track: 'business' | 'informational' | 'default',
  query: string,
  days: number,
  activeSources?: DbSource[]
): Promise<FetchedItem[]> {
  const fetchTasks: Promise<FetchedItem[]>[] = []

  if (activeSources && activeSources.length > 0) {
    // ── DB 기반: 활성화된 소스만 ─────────────────────────
    for (const src of activeSources) {
      if (src.type === 'rss' || src.type === 'youtube') {
        fetchTasks.push(fetchRss(src.url, src.name, days))
      } else if (src.type === 'x') {
        fetchTasks.push(fetchXRss(src.url.replace('x://', ''), days))
      } else if (src.type === 'special') {
        if (src.url === 'special://arxiv')           fetchTasks.push(fetchArxiv(query, days))
        else if (src.url === 'special://hackernews') fetchTasks.push(fetchHackerNews(days))
        else if (src.url === 'special://github_trending') fetchTasks.push(fetchGithubTrending(days))
      }
    }
  } else {
    // ── 하드코딩 폴백 ────────────────────────────────────
    const rssSources: RssSource[] = [
      ...SOURCES_COMMON,
      ...(track === 'business' ? SOURCES_BUSINESS : track === 'informational' ? SOURCES_INFORMATIONAL : SOURCES_DEFAULT),
    ]
    const xHandles = track === 'business' ? X_HANDLES_BUSINESS : track === 'informational' ? X_HANDLES_INFORMATIONAL : X_HANDLES_DEFAULT
    const ytChannels = track === 'business'
      ? [...YT_AI_CHANNELS.slice(0, 4), ...YT_CRYPTO_CHANNELS.slice(0, 2), ...YT_TECH_CHANNELS]
      : track === 'informational' ? [...YT_AI_CHANNELS, ...YT_TECH_CHANNELS.slice(0, 2)]
      : [...YT_AI_CHANNELS.slice(0, 5), ...YT_CRYPTO_CHANNELS.slice(0, 3), ...YT_TECH_CHANNELS.slice(0, 3)]

    fetchTasks.push(...rssSources.map(s => fetchRss(s.url, s.name, days)))
    fetchTasks.push(...SOURCES_KR_AI.map(s => fetchRss(s.url, s.name, days)))
    fetchTasks.push(...SOURCES_GLOBAL_AI.map(s => fetchRss(s.url, s.name, days)))
    fetchTasks.push(...SOURCES_CRYPTO.map(s => fetchRss(s.url, s.name, days)))
    fetchTasks.push(...SOURCES_FINANCE.map(s => fetchRss(s.url, s.name, days)))
    fetchTasks.push(...SOURCES_TECH.map(s => fetchRss(s.url, s.name, days)))
    fetchTasks.push(fetchYouTubeChannels(ytChannels, days))
    fetchTasks.push(fetchHackerNews(days))
    fetchTasks.push(...xHandles.map(h => fetchXRss(h, days)))
    if (track !== 'business') {
      fetchTasks.push(fetchArxiv(query, days))
      fetchTasks.push(fetchGithubTrending(days))
    }
  }

  // Google News (쿼리 기반) — 항상 추가
  const gq = encodeURIComponent(query || 'AI technology')
  fetchTasks.push(fetchRss(`https://news.google.com/rss/search?q=인공지능+AI&hl=ko&gl=KR&ceid=KR:ko`, '🌐 Google뉴스 AI', days))
  fetchTasks.push(fetchRss(`https://news.google.com/rss/search?q=artificial+intelligence&hl=en-US&gl=US&ceid=US:en`, '🌐 Google News AI', days))
  fetchTasks.push(fetchRss(`https://news.google.com/rss/search?q=${gq}&hl=ko&gl=KR&ceid=KR:ko`, '🌐 Google뉴스 쿼리', days))

  const results = await Promise.allSettled(fetchTasks)
  const all: FetchedItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value)
  }

  const seen = new Set<string>()
  return all
    .filter(item => {
      if (!item.url || seen.has(item.url)) return false
      seen.add(item.url)
      return true
    })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
}
