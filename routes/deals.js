const { Router } = require('express')
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const router = Router()

const DEALS_FILE = path.join(__dirname, '../data/deals.json')
const ASIN_RE = /^[A-Z0-9]{10}$/

function loadDeals() {
  try {
    return JSON.parse(fs.readFileSync(DEALS_FILE, 'utf8'))
  } catch {
    return { tracked: [], alerts_sent: [] }
  }
}

function saveDeals(data) {
  fs.mkdirSync(path.dirname(DEALS_FILE), { recursive: true })
  fs.writeFileSync(DEALS_FILE, JSON.stringify(data, null, 2))
}

async function scrapeCurrentPrice(asin) {
  const apiKey = process.env.FIRECRAWL_API_KEY
  try {
    const response = await axios.post(
      'https://api.firecrawl.dev/v1/scrape',
      { url: `https://www.amazon.in/dp/${asin}`, formats: ['markdown'] },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    )
    const markdown = response.data?.data?.markdown || ''
    const match = markdown.match(/â‚¹[\s]?([\d,]+)/)
    if (!match) return null
    return parseInt(match[1].replace(/,/g, ''))
  } catch {
    return null
  }
}

async function sendTelegramAlert(product, currentPrice, baselinePrice) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const channelId = process.env.TELEGRAM_CHANNEL_ID
  if (!token || !channelId) return false

  const discount = Math.round((1 - currentPrice / baselinePrice) * 100)
  const tag = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'
  const link = `https://www.amazon.in/dp/${product.asin}?tag=${tag}`
  const text =
    `ðŸ”¥ *Price Drop Alert | PriceHawk*\n` +
    `ðŸ“¦ ${product.name}\n` +
    `ðŸ’° Now â‚¹${currentPrice.toLocaleString('en-IN')} (was â‚¹${baselinePrice.toLocaleString('en-IN')}) â€” ${discount}% OFF\n` +
    `ðŸ›’ ${link}\n` +
    `#${(product.niche || 'deal').replace(/\s/g, '').toLowerCase()} #pricedrop`

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: channelId, text, parse_mode: 'Markdown'
    })
    return true
  } catch {
    return false
  }
}

router.post('/track', (req, res) => {
  const { asin, name, threshold_inr, niche, baseline_price } = req.body
  if (!asin) return res.status(400).json({ error: 'asin required' })
  if (!name) return res.status(400).json({ error: 'name required' })
  if (!ASIN_RE.test(asin)) return res.status(400).json({ error: 'invalid asin format' })

  const deals = loadDeals()
  const idx = deals.tracked.findIndex(p => p.asin === asin)
  const entry = { asin, name, threshold_inr: threshold_inr || null, niche: niche || null, baseline_price: baseline_price || null }
  if (idx >= 0) deals.tracked[idx] = entry
  else deals.tracked.push(entry)
  saveDeals(deals)

  res.json({ tracked: true, asin, name, threshold_inr: threshold_inr || null })
})

router.get('/watchlist', (req, res) => {
  const deals = loadDeals()
  res.json({ watchlist: deals.tracked, count: deals.tracked.length })
})

router.delete('/track/:asin', (req, res) => {
  const { asin } = req.params
  if (!ASIN_RE.test(asin)) return res.status(400).json({ error: 'invalid asin format' })
  const deals = loadDeals()
  deals.tracked = deals.tracked.filter(p => p.asin !== asin)
  saveDeals(deals)
  res.json({ removed: true, asin })
})

router.post('/check', async (req, res) => {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'FIRECRAWL_API_KEY not set' })

  const deals = loadDeals()
  const results = []
  let dropsFound = 0

  for (const product of deals.tracked) {
    const currentPrice = await scrapeCurrentPrice(product.asin)
    if (currentPrice === null) { results.push({ asin: product.asin, status: 'price_unavailable' }); continue }
    if (!product.baseline_price) product.baseline_price = currentPrice

    const baselinePrice = product.baseline_price
    const threshold = product.threshold_inr || Math.round(baselinePrice * 0.9)

    if (currentPrice <= threshold) {
      const alreadySent = deals.alerts_sent.some(a => a.asin === product.asin && a.price === currentPrice)
      if (!alreadySent) {
        const sent = await sendTelegramAlert(product, currentPrice, baselinePrice)
        if (sent) deals.alerts_sent.push({ asin: product.asin, price: currentPrice, sent_at: new Date().toISOString() })
        dropsFound++
        results.push({ asin: product.asin, status: 'drop_found', current_price: currentPrice, baseline: baselinePrice, alert_sent: sent })
      } else {
        results.push({ asin: product.asin, status: 'drop_found', current_price: currentPrice, baseline: baselinePrice, alert_sent: false })
      }
    } else {
      results.push({ asin: product.asin, status: 'ok', current_price: currentPrice, baseline: baselinePrice })
    }
  }

  saveDeals(deals)
  res.json({ checked: deals.tracked.length, drops_found: dropsFound, results })
})

module.exports = router
