/**
 * Targeted re-scraper for coffee-machines category.
 * Uses brand-specific Amazon search queries to get real branded products.
 * Overwrites data/products/coffee-machines.json.
 *
 * Usage:
 *   node scripts/rescrape-coffee-machines.js
 */

require('dotenv').config()
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const TAG = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'
const PRODS_DIR = path.join(__dirname, '../data/products')
const MIN_PRODUCTS = 30
const MAX_PRODUCTS = 80

// Brand-specific queries to surface real named products
const SEARCHES = [
  'Morphy Richards coffee maker india',
  'DeLonghi espresso machine india',
  'AGARO espresso coffee machine',
  'Nespresso coffee machine india',
  'Philips coffee maker drip india',
  'Prestige drip coffee maker',
  'Borosil french press coffee',
  'Bialetti moka pot india',
  'Cafe Zest drip coffee maker',
  'Havells coffee maker india',
  'Bajaj coffee maker india',
  'Kaapi Machines espresso india',
  'Hamilton Beach coffee maker india',
  'Tefal coffee machine india',
  'De Longhi Nespresso india',
  'Lavazza coffee machine india',
  'Saeco espresso machine india',
  'Sunflame coffee maker india',
]

const BRANDS = [
  'Morphy Richards','DeLonghi','De Longhi','AGARO','Nespresso','Philips','Prestige','Borosil',
  'Bialetti','Havells','Bajaj','Hamilton Beach','Tefal','Lavazza','Saeco','Sunflame',
  'Cafe Zest','Kaapi','Preethi','Pigeon','Lifelong','Russell Hobbs','Black+Decker',
  'Black & Decker','Cuisinart','Breville','Nescafe','Dolce Gusto','Rinaldi','Finero',
  'Proctor-Silex','Braun','Bosch','Siemens','Electrolux','Kenwood','Smeg',
]

function inferBrand(name) {
  const n = name.toLowerCase()
  for (const b of BRANDS) {
    const bl = b.toLowerCase()
    if (n.startsWith(bl + ' ') || n.startsWith(bl + ',') || n === bl ||
        n.includes(' ' + bl + ' ') || n.includes(' ' + bl + ',') || n.endsWith(' ' + bl)) {
      return b
    }
  }
  // Fallback: first word — but skip common descriptors
  const SKIP = new Set(['south','north','east','west','drip','filter','french','stovetop',
    'stainless','portable','alluminium','aluminum','aluminium','single','double','mini',
    'electric','manual','automatic','coffee','espresso','moka','press','maker','machine',
    'steel','made','home','royal','classic','premium','deluxe','professional','commercial',
    '10r11','12','ckm-204','pebk-3306','bxcm1201in','1344','cm0700b','2-in-1'])
  const first = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9-]/g,'')
  return SKIP.has(first) ? null : name.split(' ')[0]
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function inferPriceSegment(price) {
  if (!price) return null
  if (price <= 1500) return 'budget'
  if (price <= 5000) return 'mid-range'
  if (price <= 20000) return 'premium'
  return 'flagship'
}

async function scrapeCategory(page) {
  const products = []
  const seen = new Set()

  for (const query of SEARCHES) {
    if (products.length >= MAX_PRODUCTS) break

    const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}&s=review-rank`
    console.log(`  → ${query}`)

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2000)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
      await page.waitForTimeout(1000)

      const items = await page.evaluate((tag) => {
        const results = []
        const cards = document.querySelectorAll('[data-component-type="s-search-result"]')
        cards.forEach(card => {
          const asinEl = card.getAttribute('data-asin')
          if (!asinEl || asinEl.length !== 10) return

          const nameEl = card.querySelector('h2 span, h2 a span')
          const name = nameEl?.textContent?.trim()
          if (!name || name.length < 8) return

          const priceEl = card.querySelector('.a-price-whole')
          const price = priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) : null

          const mrpEl = card.querySelector('.a-text-price .a-offscreen')
          const mrpRaw = mrpEl?.textContent?.replace(/[^0-9]/g, '')
          const mrp = mrpRaw ? parseInt(mrpRaw) : null

          const ratingEl = card.querySelector('.a-icon-alt')
          const ratingText = ratingEl?.textContent
          const ratingM = ratingText?.match(/([\d.]+) out of/)
          const rating = ratingM ? parseFloat(ratingM[1]) : null

          const reviewEl = card.querySelector('[aria-label$="stars"] + span, .a-size-base.s-underline-text')
          const reviewCount = reviewEl?.textContent?.trim()?.replace(/[^0-9,KkLl]/g, '') || null

          let badge = null
          if (card.querySelector('[aria-label="Best Seller"]')) badge = 'Best Seller'
          else if (card.querySelector("[aria-label*=\"Amazon's Choice\"]")) badge = "Amazon's Choice"

          const img = card.querySelector('img.s-image')?.src || null

          results.push({ asin: asinEl, name, price, mrp, rating, reviewCount, badge, img, tag })
        })
        return results
      }, TAG)

      let addedThisSearch = 0
      for (const item of items) {
        if (seen.has(item.asin)) continue
        seen.add(item.asin)
        if (products.length >= MAX_PRODUCTS) break

        const brand = inferBrand(item.name)
        if (!brand) {
          console.log(`    skip (unbranded): ${item.name.substring(0,60)}`)
          continue
        }
        const brandSlug = slugify(brand)
        const productId = `coffee-machines-${brandSlug}-${item.asin.toLowerCase()}`

        products.push({
          product_id: productId,
          product_name: item.name,
          brand_id: brandSlug,
          category_id: 'coffee-machines',
          status: 'active',
          price_segment: inferPriceSegment(item.price),
          specifications: {},
          buyer_profiles: [],
          labs_scores: {},
          price_history_ref: `ph-${productId}`,
          offers: {
            merchant: 'amazon_in',
            external_id: item.asin,
            affiliate_url: `https://www.amazon.in/dp/${item.asin}?tag=${TAG}`,
            link_type: 'sitestripe',
            network: 'amazon_associates',
            last_price: item.price,
            price_retrieved_at: item.price ? new Date().toISOString() : null,
            display_price_publicly: false,
          },
          content: { review_id: null, comparison_ids: [], guide_ids: [], deal_id: null, price_page_id: null },
          _legacy: {
            name: item.name,
            asin: item.asin,
            current_price: item.price,
            mrp: item.mrp,
            rating: item.rating,
            review_count: item.reviewCount,
            img: item.img,
            amazon_url: `https://www.amazon.in/dp/${item.asin}`,
            cat: 'coffee-machines',
          },
        })
        addedThisSearch++
      }

      console.log(`    +${addedThisSearch} products (total: ${products.length})`)
      if (products.length >= MIN_PRODUCTS) break
    } catch (e) {
      console.warn(`    error: ${e.message}`)
    }

    await page.waitForTimeout(2500)
  }

  return products
}

async function main() {
  fs.mkdirSync(PRODS_DIR, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor',
    ],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  const page = await context.newPage()

  // Accept cookies on first load
  try {
    await page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded', timeout: 20000 })
    const acceptBtn = await page.$('#sp-cc-accept')
    if (acceptBtn) await acceptBtn.click()
    await page.waitForTimeout(1000)
  } catch { /* ignore */ }

  console.log('\n[coffee-machines] Targeted brand-specific scrape')
  const products = await scrapeCategory(page)
  await browser.close()

  // Deduplicate by ASIN
  const seen = new Map()
  for (const p of products) {
    const asin = p.offers?.external_id
    if (!seen.has(asin)) seen.set(asin, p)
  }
  const deduped = [...seen.values()]

  const data = {
    category: 'coffee-machines',
    label: 'Coffee Machines',
    tier: 1,
    group: 'Kitchen Appliances',
    scraped_at: new Date().toISOString(),
    count: deduped.length,
    products: deduped,
  }

  const outPath = path.join(PRODS_DIR, 'coffee-machines.json')
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2))

  // Show brand distribution
  const brands = {}
  deduped.forEach(p => { brands[p.brand_id] = (brands[p.brand_id]||0)+1 })
  console.log(`\n✓ saved ${deduped.length} products`)
  console.log('Brand distribution:', Object.entries(brands).sort((a,b)=>b[1]-a[1]).map(([b,c])=>`${b}(${c})`).join(', '))
}

main().catch(e => { console.error(e.message); process.exit(1) })
