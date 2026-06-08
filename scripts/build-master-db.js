#!/usr/bin/env node
/**
 * Build normalized master product DB from 54 per-category JSON files.
 * Output: data/master-products.json (flat array, normalized schema)
 *         data/master-db-summary.json (per-category stats)
 *
 * Usage: node scripts/build-master-db.js
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')

const PRODS_DIR = path.join(__dirname, '../data/products')
const OUT_FLAT   = path.join(__dirname, '../data/master-products.json')
const OUT_SUMMARY = path.join(__dirname, '../data/master-db-summary.json')

// Commission rates per category (June 2026 Amazon India)
const COMMISSION = {
  // Kitchen — 5%
  'air-fryers': 5, 'mixer-grinders': 5, 'coffee-machines': 5, 'induction-cooktops': 5,
  'electric-kettles': 5, 'food-processors': 5, 'hand-blenders': 5, 'sandwich-makers': 5,
  'rice-cookers': 5,
  // Furniture / Home — 5%
  'office-chairs': 5, 'standing-desks': 5,
  // Sports & Health — 4.7%
  'treadmills': 4.7, 'exercise-bikes': 4.7, 'massage-guns': 4.7, 'smart-scales': 4.7,
  // Mobile Accessories — 4%
  'chargers': 4, 'power-banks': 4, 'keyboards': 4, 'mice': 4,
  'gaming-keyboards': 4, 'gaming-mice': 4, 'webcams': 4, 'microphones': 4,
  'monitor-arms': 4, 'routers': 4,
  // Electronics ≥₹3k MRP — 3.5%
  'laptops': 3.5, 'monitors': 3.5, 'smartwatches': 3.5, 'headphones': 3.5,
  'soundbars': 3.5, 'cameras': 3.5, 'action-cameras': 3.5,
  'gaming-monitors': 3.5, 'gaming-headsets': 3.5, 'tablets': 3.5,
  // Large Appliances — 3.5%
  'refrigerators': 3.5, 'washing-machines': 3.5, 'air-conditioners': 3.5,
  // Wave 2 Home — 3.5%
  'robot-vacuums': 3.5, 'vacuum-cleaners': 3.5, 'air-purifiers': 3.5, 'water-purifiers': 3.5,
  // Smart Home — 4%
  'smart-lights': 4, 'smart-plugs': 4, 'smart-cameras': 4,
  'smart-locks': 4, 'smart-switches': 4, 'fitness-bands': 4,
  // Bags & Luggage — 10%
  'backpacks': 10, 'luggage': 10, 'travel-adapters': 10,
  // Smartphones — 1%
  'smartphones': 1,
  // 0% TRAPS
  'earbuds': 0, 'bluetooth-speakers': 0,
}

// Category wave / priority grouping
const WAVE = {
  'air-fryers': 1, 'mixer-grinders': 1, 'coffee-machines': 1, 'induction-cooktops': 1,
  'electric-kettles': 1, 'food-processors': 1, 'hand-blenders': 1, 'sandwich-makers': 1,
  'rice-cookers': 1,
  'robot-vacuums': 2, 'vacuum-cleaners': 2, 'air-purifiers': 2, 'water-purifiers': 2,
  'refrigerators': 3, 'washing-machines': 3, 'air-conditioners': 3,
}

// Expected revenue per conversion = rate × typical AOV
const TYPICAL_AOV = {
  'air-fryers': 6000, 'mixer-grinders': 4000, 'coffee-machines': 8000,
  'induction-cooktops': 3000, 'electric-kettles': 2000, 'food-processors': 5000,
  'hand-blenders': 2500, 'sandwich-makers': 2000, 'rice-cookers': 2500,
  'refrigerators': 30000, 'washing-machines': 25000, 'air-conditioners': 35000,
  'robot-vacuums': 15000, 'vacuum-cleaners': 8000, 'air-purifiers': 12000,
  'water-purifiers': 15000, 'laptops': 55000, 'monitors': 18000,
  'office-chairs': 12000, 'standing-desks': 20000, 'luggage': 6000, 'backpacks': 4000,
  'treadmills': 30000, 'exercise-bikes': 20000, 'massage-guns': 4000,
  'smartwatches': 8000, 'cameras': 40000, 'tablets': 25000, 'smartphones': 15000,
  'soundbars': 10000, 'headphones': 5000, 'gaming-monitors': 25000,
}

function normalize(raw, catSlug, catMeta) {
  const leg = raw._legacy || {}

  const name = raw.name || raw.product_name || leg.name || ''
  const asin = raw.asin || (Array.isArray(raw.offers) ? raw.offers[0]?.external_id : raw.offers?.external_id) || leg.asin || ''
  const brand = raw.brand || raw.brand_id || leg.brand || ''
  const price = raw.current_price ?? (Array.isArray(raw.offers) ? raw.offers[0]?.last_price : raw.offers?.last_price) ?? leg.current_price ?? null
  const mrp = raw.mrp ?? leg.mrp ?? null
  const rating = raw.rating ?? leg.rating ?? null
  const review_count = raw.review_count ?? leg.review_count ?? null
  const img = raw.img || leg.img || ''
  const badge = raw.badge ?? leg.badge ?? null
  const prime = raw.prime ?? false

  const commissionRate = COMMISSION[catSlug] ?? 3.5
  const aov = TYPICAL_AOV[catSlug] ?? price ?? 5000
  const revenuePerConversion = commissionRate === 0 ? 0 : Math.round((aov * commissionRate) / 100)

  const product_id = raw.product_id || `${catSlug}-${brand.toLowerCase().replace(/\s+/g,'-')}-${asin.toLowerCase()}`

  return {
    product_id,
    asin,
    name,
    brand: brand.toLowerCase().replace(/\s+/g, '-'),
    brand_display: brand,
    category: catSlug,
    category_label: catMeta?.label || catSlug,
    category_group: catMeta?.group || '',
    wave: WAVE[catSlug] || null,
    price_segment: raw.price_segment || inferSegment(price),
    current_price: price,
    mrp,
    rating,
    review_count: parseReviewNum(review_count),
    badge,
    prime,
    img,
    affiliate_url: `https://www.amazon.in/dp/${asin}?tag=pricehawkin-21`,
    commission_rate: commissionRate,
    zero_commission: commissionRate === 0,
    revenue_per_conversion: revenuePerConversion,
    specifications: raw.specifications || {},
    specs_enriched: raw.specifications && Object.keys(raw.specifications).length > 0,
    reviews: raw.reviews || null,
    content: raw.content || {},
    publish_eligible: false,
  }
}

function inferSegment(price) {
  if (!price) return null
  if (price <= 1500) return 'budget'
  if (price <= 5000) return 'mid'
  if (price <= 20000) return 'premium'
  return 'flagship'
}

function parseReviewNum(s) {
  if (!s) return null
  const str = String(s).replace(/,/g, '').trim()
  if (/L$/i.test(str)) return Math.round(parseFloat(str) * 100000)
  if (/K$/i.test(str)) return Math.round(parseFloat(str) * 1000)
  return parseInt(str) || null
}

function main() {
  const cats = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/indian-categories.json')))
  const files = fs.readdirSync(PRODS_DIR).filter(f => f.endsWith('.json')).sort()

  const allProducts = []
  const summary = []

  for (const file of files) {
    const catSlug = file.replace('.json', '')
    const catMeta = cats[catSlug]
    const raw = JSON.parse(fs.readFileSync(path.join(PRODS_DIR, file)))
    const products = Array.isArray(raw) ? raw : (raw.products || [])

    const normalized = products.map(p => normalize(p, catSlug, catMeta))
    allProducts.push(...normalized)

    const withSpecs = normalized.filter(p => p.specs_enriched).length
    const withRating = normalized.filter(p => p.rating).length
    const avgPrice = normalized.reduce((s, p) => s + (p.current_price || 0), 0) / (normalized.length || 1)
    const commRate = COMMISSION[catSlug] ?? 3.5
    const aov = TYPICAL_AOV[catSlug] ?? avgPrice
    const revPerConv = commRate === 0 ? 0 : Math.round(aov * commRate / 100)

    summary.push({
      category: catSlug,
      label: catMeta?.label || catSlug,
      group: catMeta?.group || '',
      wave: WAVE[catSlug] || null,
      tier: catMeta?.tier || null,
      count: normalized.length,
      with_rating: withRating,
      with_specs: withSpecs,
      commission_rate: commRate,
      zero_commission: commRate === 0,
      typical_aov: aov,
      revenue_per_conversion: revPerConv,
      priority_score: commRate === 0 ? 0 : Math.round(revPerConv * (WAVE[catSlug] ? (4 - WAVE[catSlug]) : 0.5))
    })

    console.log(`  ${String(normalized.length).padStart(3)} products  ${String(withSpecs).padStart(3)} specs  ${commRate}%  ${catSlug}`)
  }

  // Sort summary by priority
  summary.sort((a, b) => b.priority_score - a.priority_score || b.revenue_per_conversion - a.revenue_per_conversion)

  fs.writeFileSync(OUT_FLAT, JSON.stringify(allProducts, null, 2))
  fs.writeFileSync(OUT_SUMMARY, JSON.stringify({
    built_at: new Date().toISOString(),
    total_products: allProducts.length,
    total_categories: summary.length,
    with_specs: allProducts.filter(p => p.specs_enriched).length,
    zero_commission_categories: summary.filter(c => c.zero_commission).length,
    top_revenue_categories: summary.slice(0, 10).map(c => ({ category: c.category, rev_per_conv: c.revenue_per_conversion, rate: c.commission_rate })),
    categories: summary
  }, null, 2))

  console.log(`\nMaster DB built:`)
  console.log(`  ${allProducts.length} products across ${summary.length} categories`)
  console.log(`  ${allProducts.filter(p => p.specs_enriched).length} with specs (need enrichment: ${allProducts.filter(p => !p.specs_enriched).length})`)
  console.log(`\nTop 10 by revenue/conversion:`)
  summary.slice(0, 10).forEach(c => {
    console.log(`  ₹${c.revenue_per_conversion.toString().padStart(5)}/sale  ${c.commission_rate}%  ${c.category}`)
  })
}

main()
