#!/usr/bin/env node
// Validate all product _legacy.img URLs via parallel HEAD requests
// Re-scrape broken/missing ones from Amazon using ASIN
require('dotenv').config()
const https = require('https')
const http = require('http')
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const PRODUCTS_DIR = path.join(__dirname, '../data/products')
const CONCURRENCY = 30  // parallel HEAD checks
const RESCRAPE_CONCURRENCY = 3  // playwright is slow, keep low

// ── Load all products ────────────────────────────────────────────────────────

function loadAll() {
  const all = []
  for (const file of fs.readdirSync(PRODUCTS_DIR)) {
    if (!file.endsWith('.json')) continue
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PRODUCTS_DIR, file), 'utf8'))
      if (!data.products) continue
      for (const p of data.products) {
        all.push({ file, data, product: p })
      }
    } catch (e) {
      console.warn(`Skip ${file}: ${e.message}`)
    }
  }
  return all
}

// ── HTTP HEAD check ──────────────────────────────────────────────────────────

function headCheck(url, timeout = 8000) {
  return new Promise(resolve => {
    try {
      const u = new URL(url)
      const lib = u.protocol === 'https:' ? https : http
      const req = lib.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode })
      })
      req.setTimeout(timeout, () => { req.destroy(); resolve({ ok: false, status: 'TIMEOUT' }) })
      req.on('error', e => resolve({ ok: false, status: e.code }))
      req.end()
    } catch (e) {
      resolve({ ok: false, status: e.message })
    }
  })
}

async function batchCheck(items, onResult) {
  let i = 0
  const workers = Array(CONCURRENCY).fill(null).map(async () => {
    while (true) {
      let idx
      if ((idx = i++) >= items.length) break
      const item = items[idx]
      const result = await headCheck(item.product._legacy?.img || '')
      onResult(item, result)
    }
  })
  await Promise.all(workers)
}

// ── Amazon image scraper ─────────────────────────────────────────────────────

async function scrapeByAsin(page, asin) {
  try {
    await page.goto(`https://www.amazon.in/dp/${asin}`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2500)
    const imgId = await page.evaluate(() => {
      const selectors = ['#landingImage', '#imgTagWrapperId img', '.a-dynamic-image']
      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (!el) continue
        const url = el.getAttribute('data-old-hires') || el.getAttribute('data-src') || el.getAttribute('src')
        const m = url?.match(/\/I\/([^._]+)/)
        if (m) return m[1]
      }
      const dyn = document.querySelector('[data-a-dynamic-image]')
      if (dyn) {
        const m = dyn.getAttribute('data-a-dynamic-image')?.match(/"(https:\/\/[^"]+\/I\/([^._"]+)[^"]+)"/)
        if (m) return m[2]
      }
      return null
    })
    if (!imgId) return null
    return `https://m.media-amazon.com/images/I/${imgId}._SL500_.jpg`
  } catch (e) {
    return null
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Loading products...')
  const all = loadAll()
  console.log(`Loaded ${all.length} products from ${new Set(all.map(x => x.file)).size} files\n`)

  // Separate: no img vs has img
  const noImg = all.filter(x => !x.product._legacy?.img)
  const hasImg = all.filter(x => x.product._legacy?.img)

  console.log(`Has img: ${hasImg.length}  |  Missing img: ${noImg.length}`)
  console.log(`\nChecking ${hasImg.length} URLs with ${CONCURRENCY} concurrent HEAD requests...`)

  const broken = []
  let checked = 0
  const t0 = Date.now()

  await batchCheck(hasImg, (item, result) => {
    checked++
    if (checked % 100 === 0) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      process.stdout.write(`\r  ${checked}/${hasImg.length} checked (${elapsed}s)`)
    }
    if (!result.ok) {
      broken.push({ ...item, status: result.status })
    }
  })

  console.log(`\n\nBroken URLs: ${broken.length}`)
  broken.slice(0, 20).forEach(x => {
    const asin = x.product._legacy?.asin || x.product.offers?.[0]?.external_id || x.product.offers?.external_id
    console.log(`  [${x.status}] ${x.product.product_id} (ASIN: ${asin})`)
  })
  if (broken.length > 20) console.log(`  ... and ${broken.length - 20} more`)

  // Combine broken + noImg for re-scraping
  const toFix = [
    ...broken,
    ...noImg.map(x => ({ ...x, status: 'NO_IMG' }))
  ]

  // Filter to only those with an ASIN
  const toScrape = toFix.filter(x => {
    const asin = x.product._legacy?.asin
      || (Array.isArray(x.product.offers) ? x.product.offers[0]?.external_id : x.product.offers?.external_id)
    return !!asin
  })

  const noAsin = toFix.length - toScrape.length
  console.log(`\nNeed re-scrape: ${toScrape.length} (${noAsin} skipped - no ASIN)`)

  if (toScrape.length === 0) {
    console.log('Nothing to fix. All images valid.')
    return
  }

  // Re-scrape
  const fixes = {}  // file → [{ product_id, newImg }]
  console.log(`\nLaunching Playwright (${RESCRAPE_CONCURRENCY} workers)...\n`)

  const browser = await chromium.launch({ headless: true })
  let scraped = 0
  let failed = 0

  // Process in batches
  const chunks = []
  for (let i = 0; i < toScrape.length; i += RESCRAPE_CONCURRENCY) {
    chunks.push(toScrape.slice(i, i + RESCRAPE_CONCURRENCY))
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async item => {
      const page = await browser.newPage()
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en;q=0.9' })
      try {
        const asin = item.product._legacy?.asin
          || (Array.isArray(item.product.offers) ? item.product.offers[0]?.external_id : item.product.offers?.external_id)
        const newImg = await scrapeByAsin(page, asin)
        if (newImg) {
          scraped++
          console.log(`  [OK] ${item.product.product_id} → ${newImg.substring(0, 60)}`)
          if (!fixes[item.file]) fixes[item.file] = []
          fixes[item.file].push({ product_id: item.product.product_id, newImg })
        } else {
          failed++
          console.log(`  [FAIL] ${item.product.product_id}`)
        }
      } catch (e) {
        failed++
        console.log(`  [ERR] ${item.product.product_id}: ${e.message}`)
      } finally {
        await page.close()
      }
    }))
  }

  await browser.close()

  console.log(`\nScraped: ${scraped}  Failed: ${failed}`)

  if (scraped === 0) {
    console.log('No fixes to write.')
    return
  }

  // Write back to JSON files
  console.log('\nWriting fixes to product files...')
  let filesFixed = 0

  for (const [file, fileFixes] of Object.entries(fixes)) {
    const filepath = path.join(PRODUCTS_DIR, file)
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'))
    let changed = 0

    for (const fix of fileFixes) {
      const p = data.products.find(x => x.product_id === fix.product_id)
      if (p) {
        if (!p._legacy) p._legacy = {}
        p._legacy.img = fix.newImg
        changed++
      }
    }

    if (changed > 0) {
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8')
      console.log(`  ${file}: ${changed} products updated`)
      filesFixed++
    }
  }

  console.log(`\nDone. ${filesFixed} files updated, ${scraped} images fixed.`)

  // Summary report
  const reportPath = path.join(__dirname, '../tmp/image-validation-report.json')
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalProducts: all.length,
    checked: hasImg.length,
    broken: broken.length,
    noImg: noImg.length,
    scraped,
    failed,
    filesFixes: fixes
  }, null, 2))
  console.log(`Report: ${reportPath}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
