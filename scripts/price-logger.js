/**
 * PriceHawk Price Logger — captures daily price points per product.
 *
 * Reads current prices from data/products/*.json (internal use only — NEVER
 * displayed publicly). Appends one data point per day to data/price_series/.
 * Sets publish_eligible=true after 60+ data points.
 *
 * Usage:
 *   node scripts/price-logger.js              # log all products
 *   node scripts/price-logger.js --cat air-fryers
 *   node scripts/price-logger.js --dry-run
 *
 * Schedule: run daily via cron/Task Scheduler.
 * Windows Task Scheduler example:
 *   Action: node C:\Claude\pricehawk\scripts\price-logger.js
 *   Trigger: Daily at 09:00 IST
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')

const PRODS_DIR  = path.join(__dirname, '../data/products')
const SERIES_DIR = path.join(__dirname, '../data/price_series')

const ARGS = process.argv.slice(2)
const DRY_RUN   = ARGS.includes('--dry-run')
const CAT_IDX   = ARGS.indexOf('--cat')
const CAT_FILTER = CAT_IDX !== -1 ? ARGS[CAT_IDX + 1] : null
const PUBLISH_THRESHOLD = 60

function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })  // YYYY-MM-DD
}

function getSeriesPath(productId) {
  return path.join(SERIES_DIR, `${productId}.json`)
}

function loadSeries(productId) {
  const fp = getSeriesPath(productId)
  if (!fs.existsSync(fp)) {
    return {
      series_id: `ph-${productId}`,
      product_id: productId,
      source: 'firstparty_tracker',
      currency: 'INR',
      points: [],
      lowest: null,
      highest: null,
      median_90d: null,
      publish_eligible: false,
    }
  }
  return JSON.parse(fs.readFileSync(fp, 'utf8'))
}

function appendPoint(series, price, merchant) {
  const today = todayIST()
  // Idempotent: don't duplicate same merchant same day
  const exists = series.points.some(p => p.date === today && p.merchant === merchant)
  if (exists) return { series, added: false }

  series.points.push({ date: today, price, merchant })
  series.points.sort((a, b) => a.date.localeCompare(b.date))

  // Recompute aggregates
  const prices = series.points.map(p => p.price)
  series.lowest  = Math.min(...prices)
  series.highest = Math.max(...prices)

  const last90 = series.points.slice(-90).map(p => p.price).sort((a, b) => a - b)
  series.median_90d = last90[Math.floor(last90.length / 2)] || null

  series.publish_eligible = series.points.length >= PUBLISH_THRESHOLD

  return { series, added: true }
}

function getProductId(product, catSlug) {
  if (product.product_id) return product.product_id
  // Fall back to legacy slug generation for pre-migration products
  const brand = (product.brand || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const asin = (product.asin || '').toLowerCase()
  return `${catSlug}-${brand}-${asin}`
}

function getPrice(product) {
  if (product.offers) {
    // offers can be a single object or an array depending on migration path
    const offersArr = Array.isArray(product.offers) ? product.offers : [product.offers]
    const amz = offersArr.find(o => o.merchant === 'amazon_in')
    if (amz?.last_price) return amz.last_price
  }
  return product.current_price || product._legacy?.current_price || null
}

function main() {
  fs.mkdirSync(SERIES_DIR, { recursive: true })

  const files = fs.readdirSync(PRODS_DIR).filter(f => f.endsWith('.json')).sort()
  let totalLogged = 0
  let totalSkipped = 0
  let totalAlreadyHave = 0

  const today = todayIST()
  console.log(`Price Logger — ${today} IST`)

  for (const file of files) {
    const catSlug = file.replace('.json', '')
    if (CAT_FILTER && catSlug !== CAT_FILTER) continue

    let data
    try {
      data = JSON.parse(fs.readFileSync(path.join(PRODS_DIR, file), 'utf8'))
    } catch { continue }

    const products = data.products || []
    let catLogged = 0

    for (const product of products) {
      const price = getPrice(product)
      if (!price) { totalSkipped++; continue }

      const productId = getProductId(product, catSlug)
      const series = loadSeries(productId)
      const { series: updated, added } = appendPoint(series, price, 'amazon_in')

      if (!added) { totalAlreadyHave++; continue }

      catLogged++
      totalLogged++

      if (!DRY_RUN) {
        fs.writeFileSync(getSeriesPath(productId), JSON.stringify(updated, null, 2))
      }
    }

    if (catLogged > 0) {
      console.log(`  [${catSlug}] logged ${catLogged} products`)
    }
  }

  console.log(`\nDone. Logged: ${totalLogged}, no price: ${totalSkipped}, already today: ${totalAlreadyHave}`)
  if (DRY_RUN) console.log('(dry run — no files written)')

  // Summary of how far along we are to publish eligibility
  if (!DRY_RUN) {
    const seriesFiles = fs.readdirSync(SERIES_DIR).filter(f => f.endsWith('.json'))
    const eligible = seriesFiles.filter(f => {
      const s = JSON.parse(fs.readFileSync(path.join(SERIES_DIR, f), 'utf8'))
      return s.publish_eligible
    })
    const byPoints = {}
    seriesFiles.forEach(f => {
      const s = JSON.parse(fs.readFileSync(path.join(SERIES_DIR, f), 'utf8'))
      const bucket = Math.floor(s.points.length / 10) * 10
      byPoints[bucket] = (byPoints[bucket] || 0) + 1
    })
    console.log(`\nPrice series: ${seriesFiles.length} products tracked, ${eligible.length} publish-eligible`)
    console.log('Points distribution:', Object.entries(byPoints).sort(([a],[b]) => +a - +b).map(([k,v]) => `${k}d: ${v}`).join(', '))
    console.log(`Days until first pages eligible: ~${Math.max(0, PUBLISH_THRESHOLD - Math.max(...seriesFiles.map(f => JSON.parse(fs.readFileSync(path.join(SERIES_DIR, f), 'utf8')).points.length), 0))}`)
  }
}

main()
