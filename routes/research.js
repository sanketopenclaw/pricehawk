const { Router } = require('express')
const OpenAI = require('openai')
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const router = Router()

const CATEGORIES_PATH = path.join(__dirname, '../config/indian-categories.json')
const OPPORTUNITIES_DIR = path.join(__dirname, '../data/opportunities')

function loadCategories() {
  try {
    return JSON.parse(fs.readFileSync(CATEGORIES_PATH, 'utf8'))
  } catch {
    return {}
  }
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
    const firecrawlRes = await axios.post(
      'https://api.firecrawl.dev/v1/search',
      { query: primaryKeyword + ' site:india OR amazon.in OR flipkart', limit: 10 },
      { headers: { Authorization: `Bearer ${firecrawlKey}` } }
    )

    const serpData = firecrawlRes.data?.data || firecrawlRes.data?.results || []
    const serpSummary = Array.isArray(serpData)
      ? serpData.map((r, i) => `${i + 1}. ${r.title || r.url || ''}: ${r.description || r.markdown || ''}`).join('\n')
      : String(serpData)

    const client = new OpenAI({ apiKey: openrouterKey, baseURL: 'https://openrouter.ai/api/v1' })
    const model = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free'

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `You are a content strategist for PriceHawk, an Indian affiliate shopping site.
Analyze these top Google results for "${primaryKeyword}":

${serpSummary}

Return JSON with this exact structure:
{
  "keyword": "${primaryKeyword}",
  "content_type": "guide",
  "competitor_count": <number>,
  "avg_word_count": <estimated number>,
  "opportunity_score": <0-100>,
  "weak_spots": ["<issue1>", "<issue2>"],
  "suggested_title": "<SEO title with ₹ amount and year>",
  "content_angle": "<what makes PriceHawk version better>"
}`
      }]
    })

    let opportunity
    try {
      opportunity = JSON.parse(completion.choices[0]?.message?.content || '{}')
    } catch {
      opportunity = { keyword: primaryKeyword, content_type: 'guide', opportunity_score: 50 }
    }

    const categories = loadCategories()
    const catKey = niche.toLowerCase().replace(/\s+/g, '-')
    const cat = categories[catKey]

    opportunity.niche = niche
    opportunity.budget = budget
    opportunity.analyzed_at = new Date().toISOString()
    opportunity.tiers = cat?.tiers || []

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
