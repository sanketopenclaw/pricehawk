/**
 * Playwright-based Amazon India scraper for missing kitchen categories.
 * Headless Chromium — stealth mode — parses product grid.
 *
 * Usage:
 *   node scripts/scrape-kitchen-missing.js
 *   node scripts/scrape-kitchen-missing.js induction-cooktops
 */

require('dotenv').config()
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const TAG = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'
const PRODS_DIR = path.join(__dirname, '../data/products')
const MIN_PRODUCTS = 20
const MAX_PRODUCTS = 40

const MISSING_CATS = {
  'induction-cooktops': {
    label: 'Induction Cooktops',
    searches: ['induction cooktop', 'induction stove 1800W india', 'best induction cooktop 2024'],
  },
  'electric-kettles': {
    label: 'Electric Kettles',
    searches: ['electric kettle 1.5L', 'electric kettle stainless steel india', 'kettle with temperature control'],
  },
  'food-processors': {
    label: 'Food Processors',
    searches: ['food processor 600W india', 'kitchen food processor with attachments', 'electric food processor india'],
  },
  'hand-blenders': {
    label: 'Hand Blenders',
    searches: ['hand blender 600W india', 'immersion blender with chopper', 'stick blender india'],
  },
  'sandwich-makers': {
    label: 'Sandwich Makers',
    searches: ['sandwich maker india', 'grill sandwich toaster', 'sandwich griller non stick'],
  },
  'rice-cookers': {
    label: 'Rice Cookers',
    searches: ['electric rice cooker 1.8L india', 'automatic rice cooker india', 'rice cooker with steamer'],
  },
}

function inferBrand(name) {
  const BRANDS = [
    'Philips','Havells','Bajaj','Prestige','Pigeon','Usha','Borosil','Inalsa','Bosch','Lifelong',
    'Wonderchef','Preethi','Butterfly','Crompton','Panasonic','Morphy Richards','Sunflame',
    'Maharaja Whiteline','Singer','Glen','Faber','Elica','Agaro','Oster','Russell Hobbs',
    'Black+Decker','Black & Decker','Cuisinart','Braun','Kenwood','Moulinex','Tefal',
    'Instant Pot','Crock-Pot','Fagor','Tower','Bergner','Tramontina',
  ]
  const n = name.toLowerCase()
  for (const b of BRANDS) {
    if (n.startsWith(b.toLowerCase()) || n.includes(' ' + b.toLowerCase())) return b
  }
  return name.split(' ')[0]
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

async function scrapeCategory(page, catSlug, catConfig) {
  const products = []
  const seen = new Set()

  for (const query of catConfig.searches) {
    if (products.length >= MAX_PRODUCTS) break

    const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}&s=review-rank`
    console.log(`  → ${query}`)

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(2000)

      // Scroll to load lazy images
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
      await page.waitForTimeout(1000)

      // Extract product data from search grid
      const items = await page.evaluate((tag) => {
        const results = []
        const cards = document.querySelectorAll('[data-component-type="s-search-result"]')
        cards.forEach(card => {
          const asinEl = card.getAttribute('data-asin')
          if (!asinEl || asinEl.length !== 10) return

          const nameEl = card.querySelector('h2 span, h2 a span')
          const name = nameEl?.textContent?.trim()
          if (!name || name.length < 8) return

          // Price
          const priceEl = card.querySelector('.a-price-whole')
          const price = priceEl ? parseInt(priceEl.textContent.replace(/[^0-9]/g, '')) : null

          // MRP
          const mrpEl = card.querySelector('.a-text-price .a-offscreen')
          const mrpRaw = mrpEl?.textContent?.replace(/[^0-9]/g, '')
          const mrp = mrpRaw ? parseInt(mrpRaw) : null

          // Rating
          const ratingEl = card.querySelector('.a-icon-alt')
          const ratingText = ratingEl?.textContent
          const ratingM = ratingText?.match(/([\d.]+) out of/)
          const rating = ratingM ? parseFloat(ratingM[1]) : null

          // Review count
          const reviewEl = card.querySelector('[aria-label$="stars"] + span, .a-size-base.s-underline-text')
          const reviewCount = reviewEl?.textContent?.trim()?.replace(/[^0-9,KkLl]/g, '') || null

          // Badge
          let badge = null
          if (card.querySelector('[aria-label="Best Seller"]')) badge = 'Best Seller'
          else if (card.querySelector("[aria-label*=\"Amazon's Choice\"]")) badge = "Amazon's Choice"

          const img = card.querySelector('img.s-image')?.src || null

          results.push({ asin: asinEl, name, price, mrp, rating, reviewCount, badge, img, tag })
        })
        return results
      }, TAG)

      for (const item of items) {
        if (seen.has(item.asin)) continue
        seen.add(item.asin)
        if (products.length >= MAX_PRODUCTS) break

        const brand = inferBrand(item.name)
        const productId = `${catSlug}-${slugify(brand)}-${item.asin.toLowerCase()}`

        products.push({
          product_id: productId,
          product_name: item.name,
          brand_id: slugify(brand),
          category_id: catSlug,
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
            cat: catSlug,
          },
        })
      }

      console.log(`    found ${items.length} items (${seen.size} unique so far)`)

      if (products.length >= MIN_PRODUCTS) break
    } catch (e) {
      console.warn(`    error: ${e.message}`)
    }

    await page.waitForTimeout(2500) // polite delay between searches
  }

  return products
}

async function main() {
  const args = process.argv.slice(2)
  const catFilter = args.find(a => !a.startsWith('--')) || null

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

  // Dismiss popups / cookie consent if they appear
  context.on('page', page => {
    page.on('dialog', d => d.dismiss().catch(() => {}))
  })

  const page = await context.newPage()

  // Accept cookies on first load
  try {
    await page.goto('https://www.amazon.in', { waitUntil: 'domcontentloaded', timeout: 20000 })
    const acceptBtn = await page.$('#sp-cc-accept')
    if (acceptBtn) await acceptBtn.click()
    await page.waitForTimeout(1000)
  } catch { /* ignore */ }

  const stats = { success: 0, skipped: 0, errors: 0 }

  for (const [catSlug, catConfig] of Object.entries(MISSING_CATS)) {
    if (catFilter && catSlug !== catFilter) continue

    const outPath = path.join(PRODS_DIR, `${catSlug}.json`)
    const existing = fs.existsSync(outPath)
      ? JSON.parse(fs.readFileSync(outPath, 'utf8'))
      : null

    if (existing?.products?.length >= MIN_PRODUCTS) {
      console.log(`\n[${catSlug}] skip — already has ${existing.products.length} products`)
      stats.skipped++
      continue
    }

    console.log(`\n[${catSlug}] ${catConfig.label}`)

    try {
      const products = await scrapeCategory(page, catSlug, catConfig)

      const data = {
        category: catSlug,
        label: catConfig.label,
        tier: 3,
        group: 'Kitchen Appliances',
        scraped_at: new Date().toISOString(),
        count: products.length,
        products,
      }

      fs.writeFileSync(outPath, JSON.stringify(data, null, 2))
      console.log(`  ✓ saved ${products.length} products → ${outPath}`)
      stats.success++
    } catch (e) {
      console.error(`  ✗ ${catSlug}: ${e.message}`)
      stats.errors++
    }
  }

  await browser.close()

  console.log(`\n── DONE ────────────────────────`)
  console.log(`Success: ${stats.success} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
