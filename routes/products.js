const { Router } = require('express')
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const router = Router()

const CATEGORIES = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/indian-categories.json'), 'utf8'))
const PRODS_DIR = path.join(__dirname, '../data/products')

function parseAmazonProducts(markdown, budget) {
  const products = []
  const budgetNum = budget ? parseInt(budget) : Infinity
  const lines = (markdown || '').split('\n')
  let current = null

  for (const line of lines) {
    const nameMatch = line.match(/#+\s+(.+)/) || line.match(/\*\*(.+?)\*\*/)
    if (nameMatch && line.length < 120) {
      if (current) products.push(current)
      current = { name: nameMatch[1].trim(), asin: null, price_inr: null, rating: null, reviews: null, badge: null, prime: false, source: 'amazon' }
    }
    if (current) {
      const priceMatch = line.match(/₹[\s]?([\d,]+)/)
      if (priceMatch) current.price_inr = parseInt(priceMatch[1].replace(/,/g, ''))
      const ratingMatch = line.match(/([\d.]+)\s*(?:out of 5|stars?|★)/i)
      if (ratingMatch) current.rating = parseFloat(ratingMatch[1])
      const reviewMatch = line.match(/([\d,]+)\s*(?:ratings?|reviews?|customers?)/i)
      if (reviewMatch) current.reviews = parseInt(reviewMatch[1].replace(/,/g, ''))
      const asinMatch = line.match(/\/dp\/([A-Z0-9]{10})/)
      if (asinMatch) current.asin = asinMatch[1]
      if (/best seller/i.test(line)) current.badge = 'Best Seller'
      if (/amazon.s choice/i.test(line)) current.badge = "Amazon's Choice"
      if (/prime/i.test(line)) current.prime = true
    }
  }
  if (current) products.push(current)

  return products
    .filter(p => p.name && p.name.length > 3)
    .filter(p => !p.price_inr || p.price_inr <= budgetNum * 1.1)
    .map(p => ({ ...p, score: (p.reviews || 0) * (p.rating || 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}

router.post('/products', async (req, res) => {
  const { niche, budget, sources } = req.body
  if (!niche) return res.status(400).json({ error: 'niche required' })
  if (!/^[\w\s\-]+$/.test(niche) || niche.length > 50) return res.status(400).json({ error: 'invalid niche' })
  if (budget && !/^\d+$/.test(String(budget))) return res.status(400).json({ error: 'invalid budget' })

  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'FIRECRAWL_API_KEY not set' })

  const catKey = niche.toLowerCase().replace(/\s+/g, '-')
  const cat = CATEGORIES[catKey]
  const scrapeUrl = cat
    ? `https://www.amazon.in/s?k=${encodeURIComponent(cat.amazon_search)}&s=review-rank`
    : `https://www.amazon.in/s?k=${encodeURIComponent(niche)}&s=review-rank`

  const slug = catKey + (budget ? `-under-${budget}` : '')

  try {
    const response = await axios.post(
      'https://api.firecrawl.dev/v1/scrape',
      { url: scrapeUrl, formats: ['markdown'] },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    )

    const markdown = response.data?.data?.markdown || ''
    let products = parseAmazonProducts(markdown, budget)

    if (products.length < 3) {
      const query = cat
        ? `best ${cat.amazon_search} under ${budget || '5000'} rupees amazon india`
        : `best ${niche} under ${budget || '5000'} rupees amazon india`
      const searchRes = await axios.post(
        'https://api.firecrawl.dev/v1/search',
        { query },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
      )
      const combinedMarkdown = (searchRes.data?.data || []).map(r => r.markdown || '').join('\n')
      products = parseAmazonProducts(combinedMarkdown, budget)
    }

    const scraped_at = new Date().toISOString()
    const result = { niche, budget: budget || null, scraped_at, products, saved_to: `data/products/${slug}.json` }

    fs.mkdirSync(PRODS_DIR, { recursive: true })
    const writePath = path.resolve(PRODS_DIR, `${slug}.json`)
    if (!writePath.startsWith(path.resolve(PRODS_DIR) + path.sep)) return res.status(400).json({ error: 'invalid slug' })
    fs.writeFileSync(writePath, JSON.stringify(result, null, 2))

    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.error || e.message })
  }
})

router.get('/products/:slug', (req, res) => {
  const { slug } = req.params
  if (!/^[a-z0-9\-]+$/.test(slug)) return res.status(400).json({ error: 'invalid slug' })
  const resolved = path.resolve(PRODS_DIR, `${slug}.json`)
  if (!resolved.startsWith(path.resolve(PRODS_DIR) + path.sep)) return res.status(400).json({ error: 'invalid slug' })
  if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'not found' })
  try {
    res.json(JSON.parse(fs.readFileSync(resolved, 'utf8')))
  } catch (e) {
    res.status(500).json({ error: 'failed to read cached data' })
  }
})

module.exports = router
