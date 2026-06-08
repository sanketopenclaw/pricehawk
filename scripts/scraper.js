/**
 * PriceHawk Shared Scraper
 * Fallback chain: crawl4ai → webclaw → firecrawl
 *
 * crawl4ai: free, Playwright-based (Docker at :11235)
 *   - stealth mode + UndetectedAdapter for Amazon bot detection
 *   - magic=true + wait_until="load" for anti-bot sites
 *   - max_retries=2 internal retry before escalating out
 * webclaw: free tier binary at ~/.webclaw/webclaw-mcp.exe, or REST API with WEBCLAW_API_KEY
 * firecrawl: paid credits, scroll+actions support, most reliable for JS-heavy pages
 *
 * Usage:
 *   const { scrape } = require('./scraper')
 *   const md = await scrape(url, { waitFor: 5000, scroll: true })
 */

require('dotenv').config()
const axios = require('axios')
const { execFileSync } = require('child_process')
const os = require('os')
const path = require('path')
const fs = require('fs')

const FC_KEY = process.env.FIRECRAWL_API_KEY
const WC_KEY = process.env.WEBCLAW_API_KEY
const CRAWL4AI_URL = process.env.CRAWL4AI_URL || 'http://localhost:11235'
const WEBCLAW_BINARY = path.join(os.homedir(), '.webclaw', 'webclaw-mcp.exe')

// ─── CRAWL4AI ────────────────────────────────────────────────────────────────

async function scrapeCrawl4ai(url, opts = {}) {
  // Progressive anti-bot: stealth + magic + retries
  // Docs: https://docs.crawl4ai.com/advanced/anti-bot-and-fallback/
  //       https://docs.crawl4ai.com/advanced/undetected-browser/
  const payload = {
    urls: [url],
    browser_config: {
      headless: false,           // harder to detect than headless
      enable_stealth: true,      // removes webdriver flag, patches fingerprint
      use_undetected_browser: true  // UndetectedAdapter for Cloudflare/DataDome
    },
    crawler_config: {
      magic: true,               // simulate_user + override_navigator + anti-detection
      wait_until: 'load',        // wait for full load (anti-bot fires after DOMContentLoaded)
      max_retries: 2,            // internal retry rounds before giving up
      scroll_delay: opts.scroll ? 1.0 : 0,
      delay_before_return_html: opts.waitFor ? opts.waitFor / 1000 : 2.0,
    }
  }

  const timeout = (opts.waitFor || 5000) + 45000
  const r = await axios.post(`${CRAWL4AI_URL}/crawl`, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout
  })

  // Handle async task response (crawl4ai may return task_id for long crawls)
  if (r.data?.task_id) {
    const taskId = r.data.task_id
    for (let i = 0; i < 30; i++) {
      await new Promise(res => setTimeout(res, 2000))
      const t = await axios.get(`${CRAWL4AI_URL}/task/${taskId}`, { timeout: 10000 })
      if (t.data?.status === 'completed') {
        const md = t.data?.result?.markdown || t.data?.results?.[0]?.markdown
        if (md) return md
        break
      }
      if (t.data?.status === 'failed') break
    }
    throw new Error(`crawl4ai: task failed or timed out`)
  }

  const md = r.data?.results?.[0]?.markdown || r.data?.result?.markdown
  if (md) return md
  throw new Error(`crawl4ai: no markdown in response`)
}

// ─── WEBCLAW ─────────────────────────────────────────────────────────────────

async function scrapeWebclaw(url, opts = {}) {
  // Try hosted API if key available
  if (WC_KEY) {
    const r = await axios.post(
      'https://api.webclaw.io/v1/scrape',
      { url, formats: ['markdown'], only_main_content: false },
      { headers: { Authorization: `Bearer ${WC_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
    )
    if (r.data?.markdown) return r.data.markdown
  }

  // Fallback to local CLI binary
  if (fs.existsSync(WEBCLAW_BINARY)) {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('webclaw: invalid URL protocol')
    const result = execFileSync(WEBCLAW_BINARY, ['--format', 'markdown', '--', url], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe']  // suppress binary's stderr noise
    })
    return result.toString()
  }

  throw new Error('webclaw: no API key and binary not found')
}

// ─── FIRECRAWL ───────────────────────────────────────────────────────────────

async function scrapeFirecrawl(url, opts = {}) {
  if (!FC_KEY) throw new Error('FIRECRAWL_API_KEY not set')

  const payload = {
    url,
    formats: ['markdown'],
    timeout: opts.timeout || 30000,
    waitFor: opts.waitFor || 1500,
  }

  if (opts.scroll) {
    payload.actions = [
      { type: 'scroll', direction: 'down' },
      { type: 'wait', milliseconds: Math.floor((opts.waitFor || 3000) * 0.6) },
      { type: 'scroll', direction: 'down' },
      { type: 'wait', milliseconds: Math.floor((opts.waitFor || 3000) * 0.4) },
    ]
    payload.timeout = 60000
  }

  const r = await axios.post(
    'https://api.firecrawl.dev/v1/scrape',
    payload,
    { headers: { Authorization: `Bearer ${FC_KEY}`, 'Content-Type': 'application/json' }, timeout: 65000 }
  )
  const md = r.data?.data?.markdown || ''
  if (!md) throw new Error('firecrawl: empty response')
  return md
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function callProvider(provider, url, opts) {
  if (provider === 'crawl4ai') return scrapeCrawl4ai(url, opts)
  if (provider === 'webclaw')  return scrapeWebclaw(url, opts)
  if (provider === 'firecrawl') return scrapeFirecrawl(url, opts)
  return Promise.reject(new Error(`unknown provider: ${provider}`))
}

// ─── FALLBACK CHAIN ──────────────────────────────────────────────────────────

/**
 * Scrape with sequential fallback: crawl4ai → webclaw → firecrawl
 * opts.providers: override order, e.g. ['firecrawl']
 * opts.race: fire all providers simultaneously, take first valid response
 */
async function scrape(url, opts = {}) {
  const providers = opts.providers || ['crawl4ai', 'webclaw', 'firecrawl']

  if (opts.race) {
    // Fire all simultaneously — first valid markdown wins, rest are ignored
    const races = providers.map(p =>
      callProvider(p, url, opts)
        .then(md => {
          if (!md || md.length <= 100) throw new Error(`${p}: content too short`)
          return md
        })
        .catch(e => Promise.reject(new Error(`${p}: ${e.message}`)))
    )
    try {
      return await Promise.any(races)
    } catch (agg) {
      throw new Error(`All scrapers failed:\n  ${agg.errors.map(e => e.message).join('\n  ')}`)
    }
  }

  const errors = []
  for (const provider of providers) {
    try {
      const md = await callProvider(provider, url, opts)
      if (md && md.length > 100) return md
      errors.push(`${provider}: content too short (${md.length} chars)`)
    } catch (e) {
      errors.push(`${provider}: ${e.message}`)
    }
  }
  throw new Error(`All scrapers failed:\n  ${errors.join('\n  ')}`)
}

module.exports = { scrape, scrapeFirecrawl, scrapeCrawl4ai, scrapeWebclaw }
