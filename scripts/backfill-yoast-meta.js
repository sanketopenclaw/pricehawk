// scripts/backfill-yoast-meta.js
// Patches _yoast_wpseo_focuskw on all existing WP posts + pages that are missing it.
require('dotenv').config()
const axios = require('axios')
const fs    = require('fs')
const path  = require('path')
const { makeAuth, wpFindPage } = require('./lib/wp')
const { loadProducts } = require('./lib/content')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const AUTH = makeAuth(process.env.WORDPRESS_USERNAME, process.env.WORDPRESS_APP_PASSWORD)

const PRODS_DIR = path.join(__dirname, '../data/products')
const KITCHEN   = ['air-fryers','mixer-grinders','coffee-machines','induction-cooktops',
                   'electric-kettles','food-processors','hand-blenders','sandwich-makers','rice-cookers']

const CAT_LABELS = {
  'air-fryers':'air fryers','mixer-grinders':'mixer grinders','coffee-machines':'coffee machines',
  'induction-cooktops':'induction cooktops','electric-kettles':'electric kettles',
  'food-processors':'food processors','hand-blenders':'hand blenders',
  'sandwich-makers':'sandwich makers','rice-cookers':'rice cookers',
}
const CAT_SINGULAR = {
  'air-fryers':'air fryer','mixer-grinders':'mixer grinder','coffee-machines':'coffee machine',
  'induction-cooktops':'induction cooktop','electric-kettles':'electric kettle',
  'food-processors':'food processor','hand-blenders':'hand blender',
  'sandwich-makers':'sandwich maker','rice-cookers':'rice cooker',
}

function titleText(titleObj) {
  // WP REST returns title as { rendered: "Best Earbuds &#8212; PriceHawk" }
  return (titleObj?.rendered || titleObj || '')
    .replace(/&#8212;.*$/, '')   // strip em-dash suffix "— PriceHawk"
    .replace(/&amp;/g, '&').replace(/&#8211;/g, '-').replace(/&quot;/g, '"')
    .replace(/\s*[—–|]\s*.*/g, '') // strip " — anything" or " | anything"
    .replace(/\s*\d{4}\s*$/, '')   // strip trailing year
    .trim()
}

function deriveFocusKwFromTitle(titleObj) {
  const t = titleText(titleObj).toLowerCase()
  if (!t) return null

  // "best earbuds in india", "best air fryers in india — prices..."
  const bestIndia = t.match(/^(best .+?)\s+(?:in india|india)/)
  if (bestIndia) return bestIndia[1].trim() + ' in india'

  // "boat airdopes 141 review", "agaro galaxy digital air fryer review"
  const review = t.match(/^(.+?)\s+review/)
  if (review) return review[1].trim() + ' review'

  // "philips vs bajaj air fryer", "ninja vs cosori"
  const vs = t.match(/^(.+?)\s+vs\s+(.+?)(?:\s+in\s+india)?$/)
  if (vs) return `${vs[1].trim()} vs ${vs[2].trim()}`

  return null
}

function deriveFocusKw(slug, postType, productIndex, titleObj) {
  // ── Buying guide posts: best-{cat}, best-{cat}-budget, best-{cat}-{use-case} ──
  if (slug.startsWith('best-')) {
    for (const cat of KITCHEN) {
      if (slug === `best-${cat}`)        return `best ${CAT_SINGULAR[cat]} in india`
      if (slug === `best-${cat}-budget`) return `best budget ${CAT_SINGULAR[cat]} in india`
      if (slug.startsWith(`best-${cat}-`)) {
        const useCase = slug.replace(`best-${cat}-`, '').replace(/-/g, ' ')
        return `best ${CAT_SINGULAR[cat]} for ${useCase}`
      }
    }
  }

  // ── Category hub pages: best-{cat} (page type) ──
  if (postType === 'pages') {
    for (const cat of KITCHEN) {
      if (slug === `best-${cat}`) return `best ${CAT_LABELS[cat]} in india`
    }
  }

  // ── Brand pages: {cat}-{brand} ──
  for (const cat of KITCHEN) {
    if (slug.startsWith(`${cat}-`) && !slug.startsWith('best-')) {
      const brand = slug.replace(`${cat}-`, '').replace(/-/g, ' ')
      return `${brand} ${CAT_LABELS[cat]}`
    }
  }

  // ── Brand comparisons: {brand1}-vs-{brand2}-{cat} ──
  for (const cat of KITCHEN) {
    if (slug.endsWith(`-${cat}`)) {
      const brandPart = slug.slice(0, -(cat.length + 1))
      const vsIdx = brandPart.indexOf('-vs-')
      if (vsIdx > -1) {
        const b1 = brandPart.slice(0, vsIdx).replace(/-/g, ' ')
        const b2 = brandPart.slice(vsIdx + 4).replace(/-/g, ' ')
        return `${b1} vs ${b2} ${CAT_SINGULAR[cat]}`
      }
    }
  }

  // ── Review posts: review-{brand}-{asin} ──
  if (slug.startsWith('review-')) {
    const withoutPrefix = slug.replace('review-', '')
    const asinMatch = withoutPrefix.match(/([a-z0-9]{10})$/)
    if (asinMatch) {
      const asin    = asinMatch[1].toUpperCase()
      const product = productIndex[asin]
      if (product) {
        const cat   = product._catSlug || product.category_id || ''
        const brand = (product.brand_id || '').replace(/-/g, ' ')
        return `${brand} ${CAT_SINGULAR[cat] || cat} review`
      }
      const brand = withoutPrefix.replace(`-${asinMatch[1]}`, '').replace(/-/g, ' ')
      return `${brand} review`
    }
  }

  // ── Product comparisons: compare-{brand1}-{asin1}-vs-{brand2}-{asin2} ──
  if (slug.startsWith('compare-')) {
    const withoutPrefix = slug.replace('compare-', '')
    const vsIdx = withoutPrefix.indexOf('-vs-')
    if (vsIdx > -1) {
      const part1 = withoutPrefix.slice(0, vsIdx)
      const part2 = withoutPrefix.slice(vsIdx + 4)
      const m1 = part1.match(/([a-z0-9]{10})$/)
      const m2 = part2.match(/([a-z0-9]{10})$/)
      if (m1 && m2) {
        const p1   = productIndex[m1[1].toUpperCase()]
        const p2   = productIndex[m2[1].toUpperCase()]
        const b1   = ((p1?.brand_id) || part1.replace(`-${m1[1]}`, '')).replace(/-/g, ' ')
        const b2   = ((p2?.brand_id) || part2.replace(`-${m2[1]}`, '')).replace(/-/g, ' ')
        const cat  = p1?._catSlug || p2?._catSlug || ''
        const sing = CAT_SINGULAR[cat] || ''
        return `${b1} vs ${b2}${sing ? ' ' + sing : ''}`
      }
    }
  }

  // ── General best-* slug not matching kitchen cats ──
  if (slug.startsWith('best-')) {
    const kw = slug.replace(/-/g, ' ').replace(/\bin\b$/, '').trim()
    return kw || null
  }

  // ── Title-based fallback for everything else ──
  return deriveFocusKwFromTitle(titleObj)
}

async function fetchAll(postType) {
  const items = []
  let page = 1
  while (true) {
    const r = await axios.get(
      `${WP}/wp-json/wp/v2/${postType}?per_page=100&page=${page}&status=draft,publish,private&_fields=id,slug,title,meta`,
      { headers: AUTH }
    )
    if (!r.data.length) break
    items.push(...r.data)
    const total = parseInt(r.headers['x-wp-totalpages'] || '1')
    if (page >= total) break
    page++
  }
  return items
}

async function patchMeta(postType, id, focusKw, metaDesc) {
  const meta = { _yoast_wpseo_focuskw: focusKw }
  if (metaDesc) meta._yoast_wpseo_metadesc = metaDesc
  await axios.post(`${WP}/wp-json/wp/v2/${postType}/${id}`, { meta }, { headers: AUTH })
}

async function main() {
  const args    = process.argv.slice(2)
  const dryRun  = args.includes('--dry-run')
  const force   = args.includes('--force') // overwrite even if focuskw already set

  if (!WP || !process.env.WORDPRESS_USERNAME || !process.env.WORDPRESS_APP_PASSWORD) {
    console.error('Missing WP credentials in .env'); process.exit(1)
  }

  const productIndex = loadProducts(KITCHEN, PRODS_DIR)
  const stats = { patched: 0, skipped: 0, unchanged: 0, errors: 0 }

  for (const postType of ['posts', 'pages']) {
    console.log(`\nFetching ${postType}…`)
    let items
    try { items = await fetchAll(postType) }
    catch (e) { console.error(`  Failed: ${e.message}`); continue }

    console.log(`  Found ${items.length} ${postType}`)

    for (const item of items) {
      const existing = item.meta?._yoast_wpseo_focuskw
      if (existing && !force) {
        console.log(`  skip (has kw) ${item.slug}`)
        stats.unchanged++
        continue
      }

      const focusKw = deriveFocusKw(item.slug, postType, productIndex, item.title)
      if (!focusKw) {
        console.log(`  skip (no match) ${item.slug}`)
        stats.skipped++
        continue
      }

      if (dryRun) {
        console.log(`  [dry] ${item.slug}  →  "${focusKw}"`)
        stats.patched++
        continue
      }

      try {
        await patchMeta(postType, item.id, focusKw)
        console.log(`  ✓ ${item.slug}  →  "${focusKw}"`)
        stats.patched++
      } catch (e) {
        console.error(`  ✗ ${item.slug}: ${e.response?.data?.message || e.message}`)
        stats.errors++
      }

      await new Promise(r => setTimeout(r, 200))
    }
  }

  console.log(`\n── DONE ──────────────────────────────`)
  console.log(`Patched: ${stats.patched} | Skipped: ${stats.skipped} | Already set: ${stats.unchanged} | Errors: ${stats.errors}`)
  if (dryRun) console.log('(dry run — no WP changes)')
}

main().catch(e => { console.error(e.message); process.exit(1) })
