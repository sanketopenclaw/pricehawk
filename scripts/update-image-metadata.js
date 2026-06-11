#!/usr/bin/env node
// Update WP media alt_text, title, slug for all uploaded product images
// Generates SEO-proper values from product data
require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const WP_URL = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')
const PRODUCTS_DIR = path.join(__dirname, '../data/products')
const CONCURRENCY = 8
const DELAY_MS = 100

const args = process.argv.slice(2)
const catFilter = args[args.indexOf('--cat') + 1] || null

// ── Category labels ───────────────────────────────────────────────────────────
const CAT_LABEL = {
  'air-fryers': 'Air Fryer', 'mixer-grinders': 'Mixer Grinder', 'coffee-machines': 'Coffee Machine',
  'induction-cooktops': 'Induction Cooktop', 'electric-kettles': 'Electric Kettle',
  'food-processors': 'Food Processor', 'hand-blenders': 'Hand Blender',
  'sandwich-makers': 'Sandwich Maker', 'rice-cookers': 'Rice Cooker',
  'laptops': 'Laptop', 'monitors': 'Monitor', 'smartphones': 'Smartphone',
  'earbuds': 'Earbuds', 'headphones': 'Headphones', 'smartwatches': 'Smartwatch',
  'tablets': 'Tablet', 'keyboards': 'Keyboard', 'mice': 'Mouse',
  'webcams': 'Webcam', 'microphones': 'Microphone', 'chargers': 'Charger',
  'power-banks': 'Power Bank', 'routers': 'WiFi Router',
  'bluetooth-speakers': 'Bluetooth Speaker', 'soundbars': 'Soundbar',
  'gaming-monitors': 'Gaming Monitor', 'gaming-keyboards': 'Gaming Keyboard',
  'gaming-mice': 'Gaming Mouse', 'gaming-headsets': 'Gaming Headset',
  'action-cameras': 'Action Camera', 'cameras': 'Camera', 'webcams': 'Webcam',
  'air-purifiers': 'Air Purifier', 'air-conditioners': 'Air Conditioner',
  'washing-machines': 'Washing Machine', 'refrigerators': 'Refrigerator',
  'water-purifiers': 'Water Purifier', 'robot-vacuums': 'Robot Vacuum',
  'vacuum-cleaners': 'Vacuum Cleaner', 'smart-cameras': 'Smart Camera',
  'smart-lights': 'Smart Light', 'smart-plugs': 'Smart Plug',
  'smart-locks': 'Smart Lock', 'smart-scales': 'Smart Scale',
  'smart-switches': 'Smart Switch', 'fitness-bands': 'Fitness Band',
  'exercise-bikes': 'Exercise Bike', 'treadmills': 'Treadmill',
  'massage-guns': 'Massage Gun', 'backpacks': 'Backpack',
  'luggage': 'Luggage', 'standing-desks': 'Standing Desk',
  'office-chairs': 'Office Chair', 'monitor-arms': 'Monitor Arm',
  'travel-adapters': 'Travel Adapter',
}

// ── Key spec extractor per category ──────────────────────────────────────────
const KEY_SPECS = {
  'air-fryers':        s => s['Capacity'] || s['Output Wattage'],
  'mixer-grinders':    s => s['Wattage'] || s['Power Source'],
  'coffee-machines':   s => s['Capacity'] || s['Special Feature'],
  'induction-cooktops':s => s['Wattage'] || s['Output Wattage'],
  'electric-kettles':  s => s['Capacity'] || s['Wattage'],
  'food-processors':   s => s['Wattage'] || s['Capacity'],
  'hand-blenders':     s => s['Wattage'] || s['Output Wattage'],
  'sandwich-makers':   s => s['Wattage'] || s['Special Feature'],
  'rice-cookers':      s => s['Capacity'] || s['Wattage'],
  'laptops':           s => s['RAM Memory Installed Size'] || s['Screen Size'],
  'monitors':          s => s['Screen Size'] || s['Display Type'],
  'smartphones':       s => s['RAM'] || s['Memory Storage Capacity'],
  'earbuds':           s => s['Battery Life'] || s['Connectivity Technology'],
  'headphones':        s => s['Special Feature'] || s['Connectivity Technology'],
  'smartwatches':      s => s['Display Type'] || s['Special Feature'],
  'tablets':           s => s['RAM Memory Installed Size'] || s['Screen Size'],
  'washing-machines':  s => s['Capacity'] || s['Special Feature'],
  'air-purifiers':     s => s['Coverage Area'] || s['Special Feature'],
  'air-conditioners':  s => s['Capacity'] || s['Special Feature'],
  'refrigerators':     s => s['Capacity'] || s['Special Feature'],
  'water-purifiers':   s => s['Purification Feature'] || s['Special Feature'],
  'treadmills':        s => s['Maximum Speed'] || s['Special Feature'],
  'exercise-bikes':    s => s['Maximum Weight Recommendation'] || s['Special Feature'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function titleCase(s) {
  return (s || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function slugify(s) {
  return (s || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
}

function cleanProductName(name) {
  // Strip non-ASCII (garbled double-encoded unicode, bold emoji, etc.)
  let s = name.replace(/[^\x00-\x7F]/g, '').trim()
  // Unescape \| → |, then cut at first pipe (Amazon marketing suffix)
  s = s.replace(/\\+\|/g, '|').replace(/\s*\|.*$/, '').trim()
  // Trim after 3rd comma (Amazon names are bloated)
  const parts = s.split(',')
  const cleaned = parts.slice(0, 3).join(',').trim()
  return cleaned.length > 80 ? cleaned.substring(0, 80).trim() : cleaned
}

function brandTitle(brandId) {
  const overrides = {
    'agaro': 'AGARO', 'inalsa': 'Inalsa', 'ibell': 'iBELL',
    'havells': 'Havells', 'philips': 'Philips', 'bosch': 'Bosch',
    'bajaj': 'Bajaj', 'prestige': 'Prestige', 'pigeon': 'Pigeon',
    'preethi': 'Preethi', 'butterfly': 'Butterfly', 'usha': 'Usha',
    'wonderchef': 'Wonderchef', 'kent': 'Kent', 'lifelong': 'Lifelong',
    'morphy-richards': 'Morphy Richards', 'russell-hobbs': 'Russell Hobbs',
    'delonghi': 'De\'Longhi', 'nespresso': 'Nespresso', 'bialetti': 'Bialetti',
    'asus': 'ASUS', 'hp': 'HP', 'dell': 'Dell', 'lenovo': 'Lenovo',
    'mi': 'Mi', 'samsung': 'Samsung', 'lg': 'LG', 'oneplus': 'OnePlus',
    'realme': 'realme', 'vivo': 'vivo', 'oppo': 'OPPO',
    'boat': 'boAt', 'noise': 'Noise', 'jbl': 'JBL', 'sony': 'Sony',
    'bose': 'Bose', 'sennheiser': 'Sennheiser',
    'eureka-forbes': 'Eureka Forbes', 'ao-smith': 'A.O. Smith',
    'bluestar': 'Blue Star', 'whirlpool': 'Whirlpool', 'ifb': 'IFB',
  }
  return overrides[brandId] || titleCase(brandId)
}

function buildMetadata(product, catSlug) {
  const rawName = product.product_name || product._legacy?.name || ''
  const brand = brandTitle(product.brand_id || product._legacy?.brand || '')
  const catLabel = CAT_LABEL[catSlug] || titleCase(catSlug)
  const specs = product.specifications || {}
  const keySpecFn = KEY_SPECS[catSlug]
  const keySpec = keySpecFn ? keySpecFn(specs) : null

  // Title: clean product name, max ~60 chars
  const cleanName = cleanProductName(rawName)

  // Alt text: clean name + key spec only if not already numeric-present in name
  let altParts = [cleanName]
  if (keySpec) {
    // Extract numeric portion of spec (e.g. "4.5 litres" → "4.5")
    const num = keySpec.match(/[\d.]+/)?.[0]
    const alreadyInName = num && cleanName.includes(num)
    if (!alreadyInName && !cleanName.toLowerCase().includes(keySpec.toLowerCase())) {
      altParts.push(keySpec)
    }
  }
  const altText = altParts.join(' ').substring(0, 120)

  // WP title: shorter, for media library display
  const wpTitle = cleanName.length > 60
    ? cleanName.substring(0, 57) + '...'
    : cleanName

  // Slug: just slugified clean name (brand already in name usually)
  const wpSlug = slugify(cleanName).substring(0, 80)

  return { altText, wpTitle, wpSlug }
}

// ── Load products ─────────────────────────────────────────────────────────────
function loadAll() {
  const all = []
  for (const file of fs.readdirSync(PRODUCTS_DIR)) {
    if (!file.endsWith('.json')) continue
    const catSlug = file.replace('.json', '')
    if (catFilter && catSlug !== catFilter) continue
    let data
    try { data = JSON.parse(fs.readFileSync(path.join(PRODUCTS_DIR, file), 'utf8')) }
    catch (e) { console.warn(`Skip ${file}: ${e.message}`); continue }
    if (!data.products) continue
    for (const p of data.products) {
      if (!p.wp_image_id) continue
      all.push({ file, catSlug, product: p })
    }
  }
  return all
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const all = loadAll()
  console.log(`Updating metadata for ${all.length} WP media items${catFilter ? ` (cat: ${catFilter})` : ''}...\n`)

  let done = 0, failed = 0

  for (let i = 0; i < all.length; i += CONCURRENCY) {
    const batch = all.slice(i, i + CONCURRENCY)

    await Promise.all(batch.map(async item => {
      const { altText, wpTitle, wpSlug } = buildMetadata(item.product, item.catSlug)
      try {
        await axios.post(
          `${WP_URL}/wp-json/wp/v2/media/${item.product.wp_image_id}`,
          { alt_text: altText, title: wpTitle, slug: wpSlug },
          { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
        )
        done++
      } catch (e) {
        failed++
        if (process.env.DEBUG) console.log(`\n[FAIL] ${item.product.product_id}: ${e.response?.data?.message || e.message}`)
      }
    }))

    process.stdout.write(`\r  ${done + failed}/${all.length} — OK: ${done}  FAIL: ${failed}`)
    if (i + CONCURRENCY < all.length) await sleep(DELAY_MS)
  }

  console.log(`\n\nDone: ${done}  Failed: ${failed}`)

  // Show sample
  const sample = all.slice(0, 3)
  console.log('\nSample output:')
  for (const item of sample) {
    const { altText, wpTitle, wpSlug } = buildMetadata(item.product, item.catSlug)
    console.log(`  [${item.catSlug}] ${item.product.product_id}`)
    console.log(`    title:    ${wpTitle}`)
    console.log(`    alt:      ${altText}`)
    console.log(`    slug:     ${wpSlug}`)
  }
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
