/**
 * Fetches real product data (name, ASIN, price, rating, reviews, image) from Amazon.in
 * via Firecrawl. Writes data/product-cache.json.
 *
 * Run: node scripts/fetch-real-data.js
 */
require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const FC_KEY = process.env.FIRECRAWL_API_KEY
const TAG = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'
const CACHE = path.join(__dirname, '../data/product-cache.json')

// Products we want – known names + search terms for Amazon.in
const TARGETS = [
  // ── earbuds (homepage + category + guide) ────────────────────
  { id: 'boat-141',    name: 'boAt Airdopes 141',         search: 'boAt Airdopes 141 wireless earbuds', cat: 'earbuds' },
  { id: 'noise-104',   name: 'Noise Buds VS104 Max',      search: 'Noise Buds VS104 Max wireless earbuds', cat: 'earbuds' },
  { id: 'nord-2',      name: 'OnePlus Nord Buds 2',       search: 'OnePlus Nord Buds 2 wireless earbuds', cat: 'earbuds' },
  { id: 'realme-air5', name: 'realme Buds Air 5',         search: 'realme Buds Air 5 wireless earbuds', cat: 'earbuds' },
  { id: 'cmf-buds',   name: 'CMF by Nothing Buds Pro',   search: 'CMF by Nothing Buds Pro earbuds', cat: 'earbuds' },
  { id: 'jbl-wave',    name: 'JBL Wave Beam',             search: 'JBL Wave Beam wireless earbuds', cat: 'earbuds' },
  { id: 'realme-t01',  name: 'realme Buds T01',           search: 'realme Buds T01 wireless earbuds', cat: 'earbuds' },
  { id: 'boat-161',    name: 'boAt Airdopes 161',         search: 'boAt Airdopes 161 wireless earbuds', cat: 'earbuds' },

  // ── deals (homepage + deals page) ────────────────────────────
  { id: 'mi-band',     name: 'Redmi Smart Band 2',        search: 'Redmi Smart Band 2 fitness tracker', cat: 'wearables' },
  { id: 'pa',          name: 'Mi Air Purifier 4',         search: 'Mi Air Purifier 4 Compact', cat: 'home' },
  { id: 'tb',          name: 'Oral-B Vitality 100',       search: 'Oral-B Vitality 100 electric toothbrush', cat: 'personal' },
  { id: 'ssd',         name: 'Crucial BX500 480GB SSD',   search: 'Crucial BX500 480GB 2.5 inch SSD', cat: 'computing' },
  { id: 'vac',         name: 'Eureka Forbes Robo Vac',    search: 'Eureka Forbes Robo Vac robot vacuum', cat: 'home' },
  { id: 'rockerz',     name: 'boAt Rockerz 255 Pro+',     search: 'boAt Rockerz 255 Pro Plus earphone', cat: 'electronics' },
  { id: 'pbank',       name: 'Mi Power Bank 3i 20000mAh', search: 'Mi Power Bank 3i 20000mAh', cat: 'electronics' },
  { id: 'blender',     name: 'Lifelong Hand Blender 300W',search: 'Lifelong Hand Blender 300W', cat: 'kitchen' },
  { id: 'colorfit',    name: 'Noise ColorFit Pulse 2',    search: 'Noise ColorFit Pulse 2 smartwatch', cat: 'wearables' },
  { id: 'induction',   name: 'Prestige Induction Cooktop',search: 'Prestige Induction Cooktop', cat: 'kitchen' },
]

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function firecrawlScrape(url) {
  const r = await axios.post(
    'https://api.firecrawl.dev/v1/scrape',
    { url, formats: ['markdown'], timeout: 15000, waitFor: 1000 },
    { headers: { Authorization: `Bearer ${FC_KEY}`, 'Content-Type': 'application/json' }, timeout: 20000 }
  )
  return r.data?.data?.markdown || ''
}

async function searchAmazonProduct(target) {
  // Search Amazon.in for the product
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(target.search)}`
  let md = ''
  try {
    md = await firecrawlScrape(url)
  } catch (e) {
    console.warn(`  Scrape failed for ${target.name}: ${e.message}`)
    return null
  }

  // Extract ASIN from /dp/XXXXXXXXXX URLs
  const asinMatch = md.match(/\/dp\/([A-Z0-9]{10})/)
  const asin = asinMatch ? asinMatch[1] : null

  // Extract price ₹X,XXX
  const priceMatch = md.match(/₹\s*([0-9,]+)/)
  const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null

  // Extract rating X.X out of 5
  const ratingMatch = md.match(/([\d.]+)\s*out of 5/)
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null

  // Extract review count
  const reviewMatch = md.match(/([\d,]+)\s*(?:ratings?|reviews?)/i)
  const reviews = reviewMatch ? reviewMatch[1].replace(/,/g, '') : null

  // Extract Amazon CDN image URL
  const imgMatch = md.match(/https:\/\/m\.media-amazon\.com\/images\/I\/[\w\-.%]+\.(?:_[A-Z0-9_,]+\.)?(?:jpg|jpeg|png|webp)/i)
  let img = imgMatch ? imgMatch[0] : null
  // Normalize to _SL500_ size
  if (img) img = img.replace(/_[A-Z]{2}_[A-Z0-9_,]+_\./, '._SL500_.')
                    .replace(/\.jpg$/, '._SL500_.jpg')
                    .replace(/\._SL500_\._SL500_/, '._SL500_')

  console.log(`  ${target.name}: asin=${asin} price=${price} img=${img ? 'found' : 'missing'}`)

  return { id: target.id, name: target.name, cat: target.cat, asin, price, rating, reviews, img }
}

async function fetchProductPage(asin) {
  if (!asin) return null
  try {
    const md = await firecrawlScrape(`https://www.amazon.in/dp/${asin}`)

    const priceMatch = md.match(/₹\s*([0-9,]+)/)
    const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null

    const ratingMatch = md.match(/([\d.]+)\s*out of 5/)
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null

    const reviewMatch = md.match(/([\d,.]+[LK]?)\s*(?:ratings?|reviews?)/i)
    const reviews = reviewMatch ? reviewMatch[1] : null

    const imgMatches = [...md.matchAll(/https:\/\/m\.media-amazon\.com\/images\/I\/([\w\-.%]+)\.(?:jpg|jpeg|png)/gi)]
    // pick largest-looking image (avoid _SL75_, _SL110_, thumbnails)
    let img = null
    for (const m of imgMatches) {
      const u = m[0]
      if (!/_SL[0-9]{2,3}_/.test(u) && !/_US[0-9]{2}_/.test(u) && !/_SR[0-9]/.test(u)) {
        img = u
        break
      }
    }
    if (!img && imgMatches.length) {
      img = imgMatches[imgMatches.length - 1][0]
    }

    return { price, rating, reviews, img }
  } catch {
    return null
  }
}

async function main() {
  console.log(`Fetching real product data for ${TARGETS.length} products...\n`)

  const results = []

  for (const target of TARGETS) {
    console.log(`[${target.id}] ${target.name}`)
    let result = await searchAmazonProduct(target)

    // If image missing and we got an ASIN, try the product page directly
    if (result && result.asin && !result.img) {
      console.log(`  → fetching product page for image...`)
      const detail = await fetchProductPage(result.asin)
      if (detail) {
        result.img = detail.img || result.img
        result.price = result.price || detail.price
        result.rating = result.rating || detail.rating
        result.reviews = result.reviews || detail.reviews
      }
    }

    results.push(result || { id: target.id, name: target.name, cat: target.cat, asin: null, price: null, rating: null, reviews: null, img: null })
    await sleep(1500) // avoid rate limiting
  }

  // Write cache
  fs.mkdirSync(path.dirname(CACHE), { recursive: true })
  fs.writeFileSync(CACHE, JSON.stringify(results, null, 2))
  console.log(`\n✓ Wrote ${results.length} products to ${CACHE}`)

  // Summary
  const withImg = results.filter(r => r.img).length
  const withAsin = results.filter(r => r.asin).length
  console.log(`  ${withAsin}/${results.length} got ASIN, ${withImg}/${results.length} got image`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
