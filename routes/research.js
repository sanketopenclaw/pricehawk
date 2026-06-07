const { Router } = require('express')
const OpenAI = require('openai')
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const router = Router()

const CATEGORIES_PATH = path.join(__dirname, '../config/indian-categories.json')
const OPPORTUNITIES_DIR = path.join(__dirname, '../data/opportunities')

// Domains to skip — e-commerce, not editorial
const SKIP_DOMAINS = new Set([
  'amazon.in', 'www.amazon.in',
  'flipkart.com', 'www.flipkart.com',
  'meesho.com', 'www.meesho.com',
  'myntra.com', 'www.myntra.com',
  'snapdeal.com', 'www.snapdeal.com',
  'jiomart.com', 'www.jiomart.com',
  'tatacliq.com', 'www.tatacliq.com',
  'croma.com', 'www.croma.com',
  'reliancedigital.in', 'www.reliancedigital.in',
  'youtube.com', 'www.youtube.com',
  'reddit.com', 'www.reddit.com',
])

function loadCategories() {
  try {
    return JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function isEditorialUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    return !SKIP_DOMAINS.has(host) && !SKIP_DOMAINS.has('www.' + host)
  } catch {
    return false
  }
}

function extractHeadings(markdown) {
  return (markdown.match(/^#{1,3} .+/gm) || []).slice(0, 20).map(h => h.trim())
}

function wordCount(markdown) {
  return (markdown || '').split(/\s+/).filter(Boolean).length
}

// Scrape up to maxCount editorial competitor URLs in parallel
async function scrapeCompetitors(urls, firecrawlKey, maxCount = 3) {
  const editorial = urls.filter(isEditorialUrl).slice(0, maxCount)
  if (!editorial.length) return []

  const results = await Promise.allSettled(
    editorial.map(url =>
      axios.post(
        'https://api.firecrawl.dev/v1/scrape',
        { url, formats: ['markdown'], timeout: 10000 },
        { headers: { Authorization: `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' }, timeout: 15000 }
      ).then(r => ({
        url,
        markdown: r.data?.data?.markdown || '',
        title: r.data?.data?.metadata?.title || url,
      }))
    )
  )

  return results
    .filter(r => r.status === 'fulfilled' && r.value.markdown.length > 200)
    .map(r => {
      const { url, markdown, title } = r.value
      return {
        url,
        title,
        word_count: wordCount(markdown),
        headings: extractHeadings(markdown),
        // first 2000 chars of content for AI analysis
        excerpt: markdown.slice(0, 2000).replace(/\n{3,}/g, '\n\n'),
      }
    })
}

function buildAnalysisPrompt(keyword, serpSummary, competitors) {
  const compSection = competitors.length
    ? competitors.map((c, i) =>
        `--- Competitor ${i + 1}: ${c.title} (${c.url}) ---
Word count: ${c.word_count}
Headings: ${c.headings.join(' | ')}
Content excerpt:
${c.excerpt}
`).join('\n')
    : '(No competitor pages scraped)'

  return `You are a senior SEO content strategist for PriceHawk, an Indian affiliate shopping site.

TARGET KEYWORD: "${keyword}"

SERP OVERVIEW (titles + descriptions):
${serpSummary}

COMPETITOR CONTENT (scraped full pages):
${compSection}

Analyze the competitors and return JSON with this EXACT structure:
{
  "keyword": "${keyword}",
  "content_type": "guide",
  "competitor_count": <number of editorial results found>,
  "avg_word_count": <average word count across competitors>,
  "opportunity_score": <0-100, higher = easier to outrank>,
  "weak_spots": [
    "<specific gap or weakness in competitor content>",
    "<another gap>"
  ],
  "topics_covered": ["<topic competitors cover well>", "..."],
  "topics_missing": ["<topic competitors all missed>", "..."],
  "suggested_title": "<SEO title with ₹ and current year>",
  "suggested_h2s": ["<H2 section>", "<H2 section>", "..."],
  "content_angle": "<specific angle that makes PriceHawk version better than all competitors>",
  "min_word_count": <recommended minimum to beat competitors>
}`
}

router.post('/research', async (req, res) => {
  const { niche, budget } = req.body

  if (!niche) return res.status(400).json({ error: 'niche is required' })
  if (niche.length > 50) return res.status(400).json({ error: 'niche must be 50 characters or fewer' })
  if (!/^[\w\s\-]+$/.test(niche)) return res.status(400).json({ error: 'niche contains invalid characters' })
  if (budget !== undefined && !/^[0-9]{1,10}$/.test(String(budget))) return res.status(400).json({ error: 'invalid budget' })

  const firecrawlKey = process.env.FIRECRAWL_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY

  if (!firecrawlKey) return res.status(500).json({ error: 'FIRECRAWL_API_KEY not set' })
  if (!openrouterKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' })

  const primaryKeyword = budget ? `best ${niche} under ₹${budget}` : `best ${niche} india`

  try {
    // Step 1: SERP search
    const firecrawlRes = await axios.post(
      'https://api.firecrawl.dev/v1/search',
      { query: primaryKeyword, limit: 10 },
      { headers: { Authorization: `Bearer ${firecrawlKey}` } }
    )

    const serpData = firecrawlRes.data?.data || firecrawlRes.data?.results || []
    const serpUrls = Array.isArray(serpData) ? serpData.map(r => r.url).filter(Boolean) : []
    const serpSummary = Array.isArray(serpData)
      ? serpData.map((r, i) => `${i + 1}. ${r.title || r.url || ''}: ${r.description || ''}`).join('\n')
      : String(serpData)

    // Step 2: Scrape top editorial competitors in parallel
    const competitors = await scrapeCompetitors(serpUrls, firecrawlKey, 3)

    // Step 3: AI analysis with full competitor content
    const client = new OpenAI({ apiKey: openrouterKey, baseURL: 'https://openrouter.ai/api/v1' })
    const model = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free'

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: buildAnalysisPrompt(primaryKeyword, serpSummary, competitors) }]
    })

    let opportunity
    try {
      opportunity = JSON.parse(completion.choices[0]?.message?.content || '{}')
    } catch {
      opportunity = { keyword: primaryKeyword, content_type: 'guide', opportunity_score: 50 }
    }

    // Attach metadata
    const categories = loadCategories()
    const catKey = niche.toLowerCase().replace(/\s+/g, '-')
    const cat = categories[catKey]

    opportunity.niche = niche
    opportunity.budget = budget
    opportunity.analyzed_at = new Date().toISOString()
    opportunity.tiers = cat?.tiers || []
    opportunity.competitors_scraped = competitors.map(c => ({
      url: c.url,
      title: c.title,
      word_count: c.word_count,
      headings: c.headings,
    }))

    // Save
    fs.mkdirSync(OPPORTUNITIES_DIR, { recursive: true })
    const filename = `${catKey}${budget ? '-' + budget : ''}.json`
    const savedTo = path.resolve(OPPORTUNITIES_DIR, filename)
    if (!savedTo.startsWith(path.resolve(OPPORTUNITIES_DIR) + path.sep)) {
      return res.status(400).json({ error: 'invalid slug' })
    }
    fs.writeFileSync(savedTo, JSON.stringify(opportunity, null, 2))

    return res.json({ keyword: primaryKeyword, opportunities: [opportunity], saved_to: savedTo })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

router.get('/research/opportunities', (req, res) => {
  try {
    if (!fs.existsSync(OPPORTUNITIES_DIR)) return res.json({ opportunities: [], count: 0 })
    const files = fs.readdirSync(OPPORTUNITIES_DIR).filter(f => f.endsWith('.json'))
    const opportunities = files.map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(OPPORTUNITIES_DIR, f), 'utf8')) } catch { return null }
    }).filter(Boolean)
    return res.json({ opportunities, count: opportunities.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
