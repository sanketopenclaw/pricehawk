/**
 * PriceHawk Product Intelligence Database Builder
 * Scrapes Amazon India via Firecrawl for all approved categories.
 * Output: data/products/<category>.json (per-category) + data/product-db.json (master index)
 *
 * Usage:
 *   node scripts/build-product-db.js              # all categories
 *   node scripts/build-product-db.js earbuds      # single category
 *   node scripts/build-product-db.js --resume     # skip already-completed categories
 */

require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { scrape } = require('./scraper')

const FC_KEY = process.env.FIRECRAWL_API_KEY
const TAG = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'
const CATS = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/indian-categories.json'), 'utf8'))
const PRODS_DIR = path.join(__dirname, '../data/products')
const DB_PATH = path.join(__dirname, '../data/product-db.json')

const DELAY_MS = 2000         // between scrapes
const PAGES_PER_SEARCH = 2    // pages per search query (each ~16-20 products)
const MIN_PRODUCTS = 30       // minimum target per category before stopping
const MAX_PRODUCTS = 100      // cap per category

// ─── PARSERS ─────────────────────────────────────────────────────────────────

const BRANDS = [
  'boAt','Noise','OnePlus','realme','CMF','JBL','Sony','Samsung','Apple','Bose',
  'Sennheiser','Audio-Technica','Jabra','Skullcandy','Anker','OPPO','Vivo','Xiaomi',
  'Redmi','Mi','ASUS','Acer','HP','Dell','Lenovo','MSI','LG','BenQ','AOC','ViewSonic',
  'Logitech','Razer','Corsair','HyperX','SteelSeries','Roccat','Zebronics','Portronics',
  'Ambrane','Syska','Philips','Havells','Crompton','Bajaj','Voltas','Daikin','Hitachi',
  'Whirlpool','IFB','Bosch','Eureka Forbes','Kent','AO Smith','Livpure','Havells',
  'Dyson','iRobot','Ecovacs','Roborock','Pigeon','Prestige','Butterfly','Preethi',
  'Lifelong','Inalsa','Agaro','Wonderchef','Glen','Faber','Elica','Sunflame',
  'Maharaja Whiteline','Singer','Morphy Richards','Russell Hobbs','Borosil',
  'Bergner','Tramontina','Oster','Vidiem','Sujata','Kenstar','Havells',
  'Atomberg','Orient','Usha','Godrej','Carrier','Blue Star',
  'O General','Panasonic','Mitsubishi','Haier','TCL','Hisense','Vu','Thomson',
  'Akai','Micromax','Intex','Lava','Karbonn','Motorola','Nokia','Poco','iQOO',
  'Infinix','Tecno','Nothing','Google','Huawei','Honor','Fujifilm','Canon','Nikon',
  'Olympus','GoPro','DJI','Insta360','SJCAM','Akaso','Tp-Link','Netgear','D-Link',
  'Tenda','Qubo','CP Plus','Hikvision','Dahua','Yale','Pebble','Fire-Boltt',
  'Fastrack','Titan','Fossil','Amazfit','Garmin','Fitbit','Boltt','Hammer','Mivi',
  'Crossbeats','Boult','Ptron','Truke','Tagg','Gizmore','Maxima','Wildcraft',
  'Skybags','American Tourister','VIP','Safari','Nasher Miles','Uppercase','Mokobara',
  'Samsonite','Aristocrat','F Gear','AmazonBasics','Boult Audio','Soundcore'
]

function inferBrand(name) {
  const n = name.toLowerCase()
  for (const b of BRANDS) {
    const bl = b.toLowerCase()
    // Match only at word boundaries — prevents 'mi' matching 'mixer', 'premium', etc.
    if (n.startsWith(bl + ' ') || n.startsWith(bl + ',') || n === bl ||
        n.includes(' ' + bl + ' ') || n.includes(' ' + bl + ',') || n.endsWith(' ' + bl)) {
      return b
    }
  }
  return name.split(' ')[0]
}

function inferPriceSegment(price) {
  if (!price) return null
  if (price <= 1500) return 'budget'
  if (price <= 5000) return 'mid-range'
  if (price <= 20000) return 'premium'
  return 'flagship'
}

function cleanProductName(raw) {
  // Remove trailing color/variant info and keep meaningful name
  return raw
    .replace(/\s*[-–|,]\s*(Black|White|Blue|Red|Green|Grey|Gray|Gold|Silver|Pink|Purple|Navy|Beige|Brown|Orange|Yellow|Teal|Mint|Midnight|Midnight Black|Space Grey|Rose Gold|Cosmic|Pearl).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

/**
 * Amazon India search results markdown (Firecrawl) — organic listing structure:
 *
 * [![Name truncated...](https://m.media-amazon.com/images/I/XYZ._AC_UY218_.jpg)](https://www.amazon.in/.../dp/ASIN/ref=...)
 * [**Full Product Name**](https://www.amazon.in/.../dp/ASIN/ref=...)
 * 4.8_4.8 out of 5 stars_ [(638)](url#customerReviews)
 * Price, product page [₹4,999₹4,999M.R.P: ₹13,228\n...](url)
 * (62% off)
 *
 * Sponsored listings use aax-eu-zaz redirect URLs — extract ASIN from pd_rd_i param.
 */
function parseProductsFromMarkdown(markdown, catSlug) {
  const products = []
  const seen = new Set()

  // Find every product image block — marks start of each product
  // Handle both direct amazon.in URLs and aax redirect URLs
  const imgRe = /!\[([^\]]{8,300})\]\((https:\/\/m\.media-amazon\.com\/images\/I\/[^)]+)\)\]\(([^)]*)\)/g

  const blocks = []
  let m
  while ((m = imgRe.exec(markdown)) !== null) {
    const rawName = m[1]
    const imgUrl = m[2]
    const linkUrl = m[3]

    // Extract ASIN from URL (direct or redirect)
    const asin = (
      linkUrl.match(/\/dp\/([A-Z0-9]{10})\//)?.[1] ||
      linkUrl.match(/pd_rd_i=([A-Z0-9]{10})/)?.[1] ||
      linkUrl.match(/\/dp\/([A-Z0-9]{10})/)?.[1]
    ) || null

    if (!asin) continue

    // Upgrade image size
    const img = imgUrl
      .replace(/_AC_UY\d+_/, '._SL500_')
      .replace(/_AC_SR\d+,\d+_QL\d+_/, '._SL500_')
      .replace(/_AC_US\d+_/, '._SL500_')
      .replace(/_AC_SX\d+_/, '._SL500_')
      .replace(/\._SL500_\._SL500_/, '._SL500_')

    blocks.push({ rawName, img, asin, blockEnd: m.index + m[0].length })
  }

  for (let i = 0; i < blocks.length; i++) {
    const { rawName, img, asin, blockEnd } = blocks[i]
    if (seen.has(asin)) continue

    // Text between this product block and the next image block
    const nextBlock = blocks[i + 1]?.blockEnd ?? markdown.length
    // Scan from the END of this image block to ~4000 chars ahead (or next product)
    const slice = markdown.slice(blockEnd, Math.min(blockEnd + 4000, nextBlock))

    // ── Bold product name ────────────────────────────────────────────────────
    const nameM = slice.match(/\[\*\*([^\]]+)\*\*\]/)
    const name = cleanProductName(nameM?.[1] || rawName)

    // ── Rating ───────────────────────────────────────────────────────────────
    // Pattern: "4.8_4.8 out of 5 stars_" or just "4.8 out of 5 stars"
    const ratingM = slice.match(/([\d.]+)_?[\d.]* out of 5 stars/i) ||
                    slice.match(/([\d.]+)\s+out of 5/i)
    const rating = ratingM ? parseFloat(ratingM[1]) : null

    // ── Review count ─────────────────────────────────────────────────────────
    // Appears as "[(638)]" or "(1,234)" right after "stars_"
    const revM = slice.match(/stars[_\s]*\[?\(?([\d,]+)\)?]?/i)
    const review_count = revM ? revM[1].replace(/,/g, '') : null

    // ── Price ─────────────────────────────────────────────────────────────────
    // "Price, product page [₹4,999₹4,999M.R.P: ₹13,228"
    const priceM = slice.match(/Price[^[]*\[₹\s*([\d,]+)/) ||
                   slice.match(/₹\s*([\d,]+)/)
    const price = priceM ? parseInt(priceM[1].replace(/,/g, '')) : null

    // ── MRP ───────────────────────────────────────────────────────────────────
    const mrpM = slice.match(/M\.R\.P[:\s]*₹\s*([\d,]+)/i)
    const mrp = mrpM ? parseInt(mrpM[1].replace(/,/g, '')) : null

    // ── Badge ─────────────────────────────────────────────────────────────────
    let badge = null
    if (/\bbest\s*seller\b/i.test(slice)) badge = 'Best Seller'
    else if (/amazon.s\s*choice/i.test(slice)) badge = "Amazon's Choice"

    seen.add(asin)
    products.push({
      name,
      brand: inferBrand(name),
      asin,
      current_price: (price && price > 50 && price < 2000000) ? price : null,
      mrp: (mrp && mrp > 50) ? mrp : null,
      rating,
      review_count,
      badge,
      prime: /\bprime\b/i.test(slice),
      img,
      cat: catSlug,
      price_segment: inferPriceSegment(price),
      affiliate_url: `https://www.amazon.in/dp/${asin}?tag=${TAG}`,
      amazon_url: `https://www.amazon.in/dp/${asin}`,
      _score: (parseReviewNum(review_count) || 0) * (rating || 3)
    })
  }

  return products
}

function parseReviewNum(s) {
  if (!s) return 0
  s = String(s).replace(/,/g, '').trim()
  if (/L$/i.test(s)) return parseFloat(s) * 100000
  if (/K$/i.test(s)) return parseFloat(s) * 1000
  return parseInt(s) || 0
}

function dedupe(arr) {
  const seen = new Map()
  for (const p of arr) {
    const key = p.asin
    if (!seen.has(key)) {
      seen.set(key, p)
    } else {
      // Merge: keep richer record
      const ex = seen.get(key)
      if (!ex.img && p.img) ex.img = p.img
      if (!ex.rating && p.rating) ex.rating = p.rating
      if (!ex.review_count && p.review_count) ex.review_count = p.review_count
      if (!ex.current_price && p.current_price) ex.current_price = p.current_price
      if (!ex.badge && p.badge) ex.badge = p.badge
    }
  }
  return [...seen.values()]
}

// ─── SCRAPER ─────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function firecrawlScrape(url) {
  const r = await axios.post(
    'https://api.firecrawl.dev/v1/scrape',
    { url, formats: ['markdown'], timeout: 20000, waitFor: 1500 },
    { headers: { Authorization: `Bearer ${FC_KEY}`, 'Content-Type': 'application/json' }, timeout: 30000 }
  )
  return r.data?.data?.markdown || ''
}

async function scrapeCategory(catSlug, catConfig) {
  const allProducts = []
  const label = catConfig.label

  console.log(`\n[${catSlug}] ${label}`)

  for (const query of catConfig.searches) {
    if (allProducts.length >= MAX_PRODUCTS) break

    for (let page = 1; page <= PAGES_PER_SEARCH; page++) {
      if (allProducts.length >= MAX_PRODUCTS) break

      const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}&s=review-rank&page=${page}`
      console.log(`  → ${query} (page ${page})`)

      try {
        const md = await scrape(url, { scroll: true, waitFor: 2000 })
        const batch = parseProductsFromMarkdown(md, catSlug)
        allProducts.push(...batch)
        console.log(`    found ${batch.length} products (total: ${allProducts.length})`)
      } catch (e) {
        console.warn(`    scrape error: ${e.message}`)
      }

      await sleep(DELAY_MS)

      // If we got enough from page 1, skip page 2
      if (page === 1 && allProducts.length >= MIN_PRODUCTS) break
    }

    if (allProducts.length >= MIN_PRODUCTS) break
  }

  const products = dedupe(allProducts)
    .sort((a, b) => b._score - a._score)
    .slice(0, MAX_PRODUCTS)
    .map(({ _score, ...p }) => p)

  return {
    category: catSlug,
    label,
    tier: catConfig.tier,
    group: catConfig.group,
    scraped_at: new Date().toISOString(),
    count: products.length,
    products
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  // FC_KEY optional — falls back to crawl4ai if not set or 402

  fs.mkdirSync(PRODS_DIR, { recursive: true })

  const args = process.argv.slice(2)
  const resume = args.includes('--resume')
  const singleCat = args.find(a => !a.startsWith('--'))

  let categoriesToRun = Object.entries(CATS)
  if (singleCat) {
    categoriesToRun = categoriesToRun.filter(([k]) => k === singleCat)
    if (!categoriesToRun.length) { console.error(`Unknown category: ${singleCat}`); process.exit(1) }
  }

  const masterIndex = []
  let done = 0, skipped = 0

  for (const [catSlug, catConfig] of categoriesToRun) {
    const outPath = path.join(PRODS_DIR, `${catSlug}.json`)

    if (resume && fs.existsSync(outPath)) {
      console.log(`[skip] ${catSlug} (already exists)`)
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'))
      masterIndex.push({ category: catSlug, label: catConfig.label, tier: catConfig.tier, group: catConfig.group, count: existing.count, scraped_at: existing.scraped_at })
      skipped++
      continue
    }

    try {
      const result = await scrapeCategory(catSlug, catConfig)
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2))
      masterIndex.push({ category: catSlug, label: catConfig.label, tier: catConfig.tier, group: catConfig.group, count: result.count, scraped_at: result.scraped_at })
      console.log(`  ✓ saved ${result.count} products → data/products/${catSlug}.json`)
      done++
    } catch (e) {
      console.error(`  ✗ failed: ${e.message}`)
    }
  }

  // Write master index
  const db = {
    built_at: new Date().toISOString(),
    total_categories: masterIndex.length,
    total_products: masterIndex.reduce((s, c) => s + (c.count || 0), 0),
    affiliate_tag: TAG,
    categories: masterIndex.sort((a, b) => a.tier - b.tier || a.label.localeCompare(b.label))
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))

  console.log(`\n✓ Done. ${done} scraped, ${skipped} skipped.`)
  console.log(`  Total products: ${db.total_products} across ${db.total_categories} categories`)
  console.log(`  Master index: data/product-db.json`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
