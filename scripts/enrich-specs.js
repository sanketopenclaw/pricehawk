#!/usr/bin/env node
/**
 * Enrich product specifications by scraping Amazon India product pages.
 * Internal intelligence only — specs never displayed as raw Amazon data.
 *
 * Usage:
 *   node scripts/enrich-specs.js                     # all unenriched, highest-rev first
 *   node scripts/enrich-specs.js --cat air-fryers     # single category
 *   node scripts/enrich-specs.js --cat air-fryers,refrigerators
 *   node scripts/enrich-specs.js --limit 50           # cap at 50 products
 *   node scripts/enrich-specs.js --resume             # skip already enriched
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const MASTER_PATH = path.join(__dirname, '../data/master-products.json')
const DELAY_MS = 2500   // between requests — be respectful

// Fields to exclude from specs (dynamic/noisy/PII)
const SKIP_KEYS = new Set([
  'Customer Reviews', 'Best Sellers Rank', 'Date First Available',
  'Manufacturer Contact Information', 'Importer Contact Information',
  'Packer Contact Information', 'Part Number', 'Unit Count',
  'ASIN',
])

// Category priority order (by revenue per conversion)
const CAT_PRIORITY = [
  'laptops', 'air-conditioners', 'refrigerators', 'treadmills', 'exercise-bikes',
  'washing-machines', 'cameras', 'standing-desks', 'office-chairs',
  'robot-vacuums', 'water-purifiers', 'air-purifiers', 'monitors',
  'coffee-machines', 'gaming-monitors', 'luggage', 'backpacks',
  'air-fryers', 'mixer-grinders', 'induction-cooktops', 'food-processors',
  'electric-kettles', 'rice-cookers', 'sandwich-makers', 'hand-blenders',
  'smartwatches', 'tablets', 'smartphones', 'headphones', 'soundbars',
  'smart-locks', 'smart-lights', 'smart-switches', 'smart-plugs', 'smart-cameras',
  'smart-scales', 'massage-guns', 'vacuum-cleaners', 'keyboards', 'mice',
  'gaming-keyboards', 'gaming-mice', 'gaming-headsets', 'chargers', 'power-banks',
  'routers', 'monitor-arms', 'microphones', 'webcams', 'fitness-bands',
  'travel-adapters', 'action-cameras', 'earbuds', 'bluetooth-speakers',
]

async function extractSpecs(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2000)
  } catch (e) {
    return null
  }

  return await page.evaluate((skipKeys) => {
    const result = {}

    // Method 1: Product Details tech spec table
    const rows1 = document.querySelectorAll(
      '#productDetails_techSpec_section_1 tr, ' +
      '#productDetails_techSpec_section_2 tr, ' +
      '#productDetails_detailBullets_sections1 tr, ' +
      '.a-keyvalue.prodDetTable tr'
    )
    rows1.forEach(row => {
      const th = row.querySelector('th')?.innerText?.trim()
      const td = row.querySelector('td')?.innerText?.trim()
        .replace(/\s+/g, ' ')
        .replace(/\n/g, ' ')
      if (th && td && !skipKeys.includes(th)) result[th] = td
    })

    // Method 2: Detail bullets list
    if (Object.keys(result).length < 3) {
      const bullets = document.querySelectorAll('#detailBullets_feature_div li span.a-list-item')
      bullets.forEach(li => {
        const text = li.innerText.trim()
        const colonIdx = text.indexOf(':')
        if (colonIdx > 0) {
          const key = text.substring(0, colonIdx).trim().replace(/‏/g, '')
          const val = text.substring(colonIdx + 1).trim().replace(/‏/g, '')
          if (key && val && !skipKeys.includes(key) && val.length < 300) result[key] = val
        }
      })
    }

    // Feature bullets (key product highlights)
    const feats = document.querySelectorAll('#feature-bullets li span.a-list-item')
    const featArr = Array.from(feats)
      .map(s => s.innerText.trim())
      .filter(s => s.length > 10 && s.length < 250 && !s.toLowerCase().includes('make sure this fits'))
    if (featArr.length > 0) result._features = featArr.slice(0, 8)

    return result
  }, [...SKIP_KEYS])
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const args = process.argv.slice(2)
  const catArg = args.find(a => a.startsWith('--cat=') || (args[args.indexOf('--cat') + 1] && !a.startsWith('-')))
  const catFilter = (args.find(a => a.startsWith('--cat'))
    ? (args.find(a => a.startsWith('--cat=')))?.replace('--cat=', '') || args[args.indexOf('--cat') + 1]
    : null)?.split(',')
  const limitArg = args.find(a => a.startsWith('--limit'))
  const limit = limitArg
    ? parseInt(limitArg.replace('--limit=', '') || args[args.indexOf('--limit') + 1]) || 999
    : 999
  const resume = args.includes('--resume')

  console.log('Loading master products...')
  const products = JSON.parse(fs.readFileSync(MASTER_PATH))
  console.log(`  ${products.length} total products`)

  // Filter + sort
  let queue = products
    .filter(p => p.asin)
    .filter(p => !catFilter || catFilter.includes(p.category))
    .filter(p => !resume || !p.specs_enriched)
    .filter(p => !p.specs_enriched)

  // Sort by category priority then by review count desc
  queue.sort((a, b) => {
    const pa = CAT_PRIORITY.indexOf(a.category)
    const pb = CAT_PRIORITY.indexOf(b.category)
    const priA = pa === -1 ? 999 : pa
    const priB = pb === -1 ? 999 : pb
    if (priA !== priB) return priA - priB
    return (b.review_count || 0) - (a.review_count || 0)
  })

  queue = queue.slice(0, limit)
  console.log(`  ${queue.length} products to enrich${catFilter ? ' (cats: ' + catFilter.join(',') + ')' : ''}`)

  if (queue.length === 0) {
    console.log('Nothing to do.')
    return
  }

  // Build asin→product index for fast updates
  const productMap = new Map(products.map((p, i) => [p.asin, { p, i }]))

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'en-IN',
    extraHTTPHeaders: { 'Accept-Language': 'en-IN,en;q=0.9' }
  })
  const page = await context.newPage()

  let done = 0, failed = 0, lastSave = 0

  for (const prod of queue) {
    const url = `https://www.amazon.in/dp/${prod.asin}`
    process.stdout.write(`[${done + 1}/${queue.length}] ${prod.category.padEnd(22)} ${prod.asin}  `)

    const specs = await extractSpecs(page, url)
    const entry = productMap.get(prod.asin)

    if (specs && Object.keys(specs).length > 1) {
      entry.p.specifications = specs
      entry.p.specs_enriched = true
      const specCount = Object.keys(specs).filter(k => k !== '_features').length
      console.log(`✓ ${specCount} specs${specs._features ? ' + ' + specs._features.length + ' features' : ''}`)
      done++
    } else {
      console.log('✗ no specs')
      entry.p.specifications = { _failed: true }
      entry.p.specs_enriched = false
      failed++
    }

    // Save every 20 products
    if (done + failed - lastSave >= 20) {
      fs.writeFileSync(MASTER_PATH, JSON.stringify(products, null, 2))
      console.log(`  [saved progress — ${done} enriched, ${failed} failed]`)
      lastSave = done + failed
    }

    await sleep(DELAY_MS)
  }

  await browser.close()

  // Final save
  fs.writeFileSync(MASTER_PATH, JSON.stringify(products, null, 2))

  // Also update per-category files
  const byCat = new Map()
  products.forEach(p => {
    if (!byCat.has(p.category)) byCat.set(p.category, [])
    byCat.get(p.category).push(p)
  })

  let catsUpdated = 0
  const prodsDir = path.join(__dirname, '../data/products')
  for (const [cat, prods] of byCat) {
    const catFile = path.join(prodsDir, `${cat}.json`)
    if (!fs.existsSync(catFile)) continue
    const existing = JSON.parse(fs.readFileSync(catFile))
    const asinToSpec = new Map(prods.filter(p => p.specs_enriched).map(p => [p.asin, p.specifications]))
    const prodArray = Array.isArray(existing) ? existing : (existing.products || [])
    let changed = false
    prodArray.forEach(p => {
      const leg = p._legacy || {}
      const asin = p.asin || leg.asin
      if (asin && asinToSpec.has(asin)) {
        p.specifications = asinToSpec.get(asin)
        changed = true
      }
    })
    if (changed) {
      if (Array.isArray(existing)) {
        fs.writeFileSync(catFile, JSON.stringify(existing, null, 2))
      } else {
        existing.products = prodArray
        fs.writeFileSync(catFile, JSON.stringify(existing, null, 2))
      }
      catsUpdated++
    }
  }

  console.log(`\nDone: ${done} enriched, ${failed} failed, ${catsUpdated} category files updated`)
  console.log(`Master DB saved: data/master-products.json`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
