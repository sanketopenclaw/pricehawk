/**
 * Migrates data/products/*.json to merchant-agnostic schema (master doc §3).
 *
 * SAFE TO RUN: idempotent — skips products that already have product_id.
 * WARNING: do NOT run while enrich-reviews.js is writing to the same files.
 *          Wait for enrichment to finish first.
 *
 * What it does:
 *  - Generates product_id slug: {category}-{brand_slug}-{asin_lower}
 *  - Moves ASIN into offers[].external_id
 *  - Sets display_price_publicly: false on all offers
 *  - Keeps all existing fields (reviews, specs, etc.) untouched
 *  - Adds price_history_ref pointing to price_series file
 *
 * Usage: node scripts/migrate-schema.js [--dry-run] [--cat air-fryers]
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')

const PRODS_DIR = path.join(__dirname, '../data/products')
const ARGS = process.argv.slice(2)
const DRY_RUN = ARGS.includes('--dry-run')
const CAT_IDX = ARGS.indexOf('--cat')
const CAT_FILTER = CAT_IDX !== -1 ? ARGS[CAT_IDX + 1] : null

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function buildProductId(catSlug, brand, asin) {
  return `${catSlug}-${slugify(brand)}-${asin.toLowerCase()}`
}

function migrateProduct(p, catSlug) {
  if (p.product_id) return p  // already migrated

  const asin = p.asin || ''
  const brand = p.brand || 'unknown'
  const productId = buildProductId(catSlug, brand, asin)

  return {
    product_id: productId,
    product_name: p.name,
    brand_id: slugify(brand),
    category_id: catSlug,
    status: 'active',
    price_segment: p.price_segment || null,
    specifications: p.specifications || {},
    buyer_profiles: p.buyer_profiles || [],
    labs_scores: p.labs_scores || {},
    price_history_ref: `ph-${productId}`,
    offers: [
      {
        merchant: 'amazon_in',
        external_id: asin,
        affiliate_url: p.affiliate_url || `https://www.amazon.in/dp/${asin}?tag=pricehawkin-21`,
        link_type: 'sitestripe',
        network: 'amazon_associates',
        last_price: p.current_price || null,
        price_retrieved_at: p.scraped_at || null,
        display_price_publicly: false,
      }
    ],
    content: {
      review_id: null,
      comparison_ids: [],
      guide_ids: [],
      deal_id: null,
      price_page_id: null,
    },
    // Keep enrichment data
    reviews: p.reviews || null,
    badge: p.badge || null,
    prime: p.prime || false,
    // Keep raw fields for backward compat during transition
    _legacy: {
      name: p.name,
      asin: p.asin,
      current_price: p.current_price,
      mrp: p.mrp,
      rating: p.rating,
      review_count: p.review_count,
      img: p.img,
      amazon_url: p.amazon_url,
      cat: p.cat,
    }
  }
}

function main() {
  const files = fs.readdirSync(PRODS_DIR).filter(f => f.endsWith('.json')).sort()
  let totalMigrated = 0
  let totalSkipped = 0
  let filesChanged = 0

  for (const file of files) {
    const catSlug = file.replace('.json', '')
    if (CAT_FILTER && catSlug !== CAT_FILTER) continue

    const filePath = path.join(PRODS_DIR, file)
    let data
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (e) {
      console.error(`  [skip] ${file}: parse error`)
      continue
    }

    const products = data.products || []
    const needsMigration = products.filter(p => !p.product_id)
    if (needsMigration.length === 0) {
      console.log(`  [done] ${catSlug}: all ${products.length} already migrated`)
      totalSkipped += products.length
      continue
    }

    const migrated = products.map(p => migrateProduct(p, catSlug))
    totalMigrated += needsMigration.length
    totalSkipped += products.length - needsMigration.length
    filesChanged++

    if (DRY_RUN) {
      console.log(`  [dry]  ${catSlug}: would migrate ${needsMigration.length}/${products.length}`)
      console.log(`         example id: ${migrated[0]?.product_id}`)
    } else {
      fs.writeFileSync(filePath, JSON.stringify({ ...data, products: migrated }, null, 2))
      console.log(`  [ok]   ${catSlug}: migrated ${needsMigration.length}/${products.length}`)
    }
  }

  console.log(`\nDone. Migrated: ${totalMigrated}, already done: ${totalSkipped}, files changed: ${filesChanged}`)
  if (DRY_RUN) console.log('(dry run — no files written)')
}

main()
