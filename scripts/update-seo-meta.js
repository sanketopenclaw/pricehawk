#!/usr/bin/env node
// Set Yoast _yoast_wpseo_title + _yoast_wpseo_metadesc + _yoast_wpseo_focuskw
// for all WP pages and posts. Idempotent — overwrites on every run.
require('dotenv').config()
const axios = require('axios')
const { makeAuth } = require('./lib/wp')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const AUTH = makeAuth(process.env.WORDPRESS_USERNAME, process.env.WORDPRESS_APP_PASSWORD)
const YEAR = new Date().getFullYear()

const args   = process.argv.slice(2)
const DRY    = args.includes('--dry-run')

// ── Static page definitions ───────────────────────────────────────────────────
// keyed by WP slug
const STATIC = {
  'ph-home': {
    title:   `PriceHawk — Best Deals & Price Drops in India ${YEAR}`,
    desc:    `Track prices on Amazon India. PriceHawk monitors 1,900+ products across electronics and appliances and alerts you when prices drop. Find today's best deals.`,
    focuskw: 'best deals india price tracker',
  },
  'deals': {
    title:   `Today's Best Deals in India ${YEAR} | PriceHawk`,
    desc:    `Live price drops on electronics, kitchen appliances and gadgets on Amazon India. Prices updated hourly. Never overpay again.`,
    focuskw: `best deals in india ${YEAR}`,
  },
  'price-drops': {
    title:   `Price Drop Alerts — Track Amazon India Prices | PriceHawk`,
    desc:    `Get notified when prices drop on Amazon India. PriceHawk tracks 1,900+ products and sends instant alerts when a product hits its lowest recorded price.`,
    focuskw: 'price drop alert india',
  },
  'buying-guide': {
    title:   `Buying Guides — Best Products in India ${YEAR} | PriceHawk`,
    desc:    `Expert buying guides for electronics and appliances in India. Researched by the PriceHawk team — find the right product for your budget and needs.`,
    focuskw: `best products india buying guide ${YEAR}`,
  },
  'comparison': {
    title:   `Compare Products — Side-by-Side Specs & Prices | PriceHawk`,
    desc:    `Compare electronics and appliances side-by-side on specs, price history and ratings. Make smarter buying decisions with PriceHawk.`,
    focuskw: 'compare products india',
  },
  'categories': {
    title:   `All Categories — Electronics & Appliances | PriceHawk`,
    desc:    `Browse all product categories tracked by PriceHawk — smartphones, laptops, earbuds, kitchen appliances, smart home and more. 1,900+ products tracked.`,
    focuskw: 'electronics appliances price tracker india',
  },
  'about': {
    title:   `About PriceHawk — India's Amazon Price Tracker`,
    desc:    `PriceHawk is India's dedicated price tracker for Amazon India. We monitor 1,900+ products across electronics and home appliances and alert you to the best deals.`,
    focuskw: 'amazon price tracker india',
  },
  'contact': {
    title:   `Contact PriceHawk — Get in Touch`,
    desc:    `Reach the PriceHawk team for partnerships, product suggestions, corrections or general enquiries.`,
    focuskw: 'contact pricehawk',
  },
  'privacy-policy': {
    title:   `Privacy Policy | PriceHawk`,
    desc:    `Read PriceHawk's privacy policy. We do not sell your data or share it with third parties. Your privacy is our priority.`,
    focuskw: 'pricehawk privacy policy',
  },
  'terms-of-service': {
    title:   `Terms of Service | PriceHawk`,
    desc:    `PriceHawk terms of service. Read our usage policies, affiliate disclosures and content guidelines.`,
    focuskw: 'pricehawk terms of service',
  },
  'affiliate-disclosure': {
    title:   `Affiliate Disclosure | PriceHawk`,
    desc:    `PriceHawk participates in the Amazon Associates programme and earns from qualifying purchases. Read our full affiliate disclosure here.`,
    focuskw: 'pricehawk affiliate disclosure',
  },
  'editorial-policy': {
    title:   `Editorial Policy | PriceHawk`,
    desc:    `How PriceHawk selects, researches and reviews products. Our commitment to editorial independence and accuracy.`,
    focuskw: 'pricehawk editorial policy',
  },
  'search-ph': {
    title:   `Search — PriceHawk`,
    desc:    `Search PriceHawk for price trackers, deals, reviews and buying guides on electronics and appliances in India.`,
    focuskw: 'search pricehawk',
  },
  'buying-guide-comparison': {
    title:   `Buying Guide Comparisons — Best Products India ${YEAR} | PriceHawk`,
    desc:    `Compare top-rated products side by side with buying guide context. PriceHawk tracks prices daily on Amazon India.`,
    focuskw: `product buying guide comparison india ${YEAR}`,
  },
}

// ── Category hub slug → meta ──────────────────────────────────────────────────
const CAT_META = {
  'earbuds':           { label: 'Earbuds',            plural: 'earbuds' },
  'air-fryers':        { label: 'Air Fryers',          plural: 'air fryers' },
  'mixer-grinders':    { label: 'Mixer Grinders',      plural: 'mixer grinders' },
  'laptops':           { label: 'Laptops',             plural: 'laptops' },
  'smartphones':       { label: 'Smartphones',         plural: 'smartphones' },
  'smartwatches':      { label: 'Smartwatches',        plural: 'smartwatches' },
  'headphones':        { label: 'Headphones',          plural: 'headphones' },
  'monitors':          { label: 'Monitors',            plural: 'monitors' },
  'bluetooth-speakers':{ label: 'Bluetooth Speakers',  plural: 'bluetooth speakers' },
  'coffee-machines':   { label: 'Coffee Machines',     plural: 'coffee machines' },
  'induction-cooktops':{ label: 'Induction Cooktops',  plural: 'induction cooktops' },
  'electric-kettles':  { label: 'Electric Kettles',    plural: 'electric kettles' },
  'food-processors':   { label: 'Food Processors',     plural: 'food processors' },
  'hand-blenders':     { label: 'Hand Blenders',       plural: 'hand blenders' },
  'sandwich-makers':   { label: 'Sandwich Makers',     plural: 'sandwich makers' },
  'rice-cookers':      { label: 'Rice Cookers',        plural: 'rice cookers' },
  'air-purifiers':     { label: 'Air Purifiers',       plural: 'air purifiers' },
  'air-conditioners':  { label: 'Air Conditioners',    plural: 'air conditioners' },
  'washing-machines':  { label: 'Washing Machines',    plural: 'washing machines' },
  'refrigerators':     { label: 'Refrigerators',       plural: 'refrigerators' },
  'water-purifiers':   { label: 'Water Purifiers',     plural: 'water purifiers' },
  'robot-vacuums':     { label: 'Robot Vacuums',       plural: 'robot vacuums' },
  'vacuum-cleaners':   { label: 'Vacuum Cleaners',     plural: 'vacuum cleaners' },
  'tablets':           { label: 'Tablets',             plural: 'tablets' },
  'keyboards':         { label: 'Keyboards',           plural: 'keyboards' },
  'mice':              { label: 'Mice',                plural: 'computer mice' },
  'webcams':           { label: 'Webcams',             plural: 'webcams' },
  'microphones':       { label: 'Microphones',         plural: 'microphones' },
  'chargers':          { label: 'Chargers',            plural: 'chargers' },
  'power-banks':       { label: 'Power Banks',         plural: 'power banks' },
  'routers':           { label: 'WiFi Routers',        plural: 'wifi routers' },
  'soundbars':         { label: 'Soundbars',           plural: 'soundbars' },
  'fitness-bands':     { label: 'Fitness Bands',       plural: 'fitness bands' },
  'smart-cameras':     { label: 'Smart Cameras',       plural: 'smart cameras' },
  'smart-lights':      { label: 'Smart Lights',        plural: 'smart lights' },
  'smart-plugs':       { label: 'Smart Plugs',         plural: 'smart plugs' },
  'smart-locks':       { label: 'Smart Locks',         plural: 'smart locks' },
  'gaming-monitors':   { label: 'Gaming Monitors',     plural: 'gaming monitors' },
  'gaming-keyboards':  { label: 'Gaming Keyboards',    plural: 'gaming keyboards' },
  'gaming-mice':       { label: 'Gaming Mice',         plural: 'gaming mice' },
  'gaming-headsets':   { label: 'Gaming Headsets',     plural: 'gaming headsets' },
  'action-cameras':    { label: 'Action Cameras',      plural: 'action cameras' },
  'cameras':           { label: 'Cameras',             plural: 'cameras' },
  'backpacks':         { label: 'Backpacks',           plural: 'backpacks' },
  'luggage':           { label: 'Luggage',             plural: 'luggage' },
  'treadmills':        { label: 'Treadmills',          plural: 'treadmills' },
  'exercise-bikes':    { label: 'Exercise Bikes',      plural: 'exercise bikes' },
  'massage-guns':      { label: 'Massage Guns',        plural: 'massage guns' },
  'standing-desks':    { label: 'Standing Desks',      plural: 'standing desks' },
  'office-chairs':     { label: 'Office Chairs',       plural: 'office chairs' },
  'monitor-arms':      { label: 'Monitor Arms',        plural: 'monitor arms' },
  'travel-adapters':   { label: 'Travel Adapters',     plural: 'travel adapters' },
}

// ── Meta derivers ─────────────────────────────────────────────────────────────

function metaForCategoryHub(slug) {
  const c = CAT_META[slug]
  if (!c) return null
  return {
    title:   `Best ${c.label} in India ${YEAR} — Prices, Reviews & Deals | PriceHawk`,
    desc:    `Compare the best ${c.plural} in India ${YEAR}. Prices tracked daily on Amazon India. Find top-rated ${c.plural} with honest reviews and price history.`,
    focuskw: `best ${c.plural} in india ${YEAR}`,
  }
}

function metaForReview(slug, titleRendered) {
  // slug: review-{brand}-{asin} or arbitrary review slug
  const rawTitle = (titleRendered || '')
    .replace(/&#8212;.*$/, '').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim()
  const productName = rawTitle.replace(/\s*[—|].*$/, '').replace(/\s*Review\s*$/i, '').trim()
  return {
    title:   `${productName} Review ${YEAR} — Should You Buy It? | PriceHawk`,
    desc:    `Detailed review of the ${productName}. Key specs, pros, cons, and current price on Amazon India. Updated ${YEAR}.`,
    focuskw: `${productName.toLowerCase()} review`,
  }
}

function metaForComparison(slug, titleRendered) {
  const rawTitle = (titleRendered || '')
    .replace(/&#8212;.*$/, '').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim()
  const compName = rawTitle.replace(/\s*[—|].*$/, '').trim()
  return {
    title:   `${compName} — Price & Spec Comparison India | PriceHawk`,
    desc:    `Side-by-side comparison of ${compName}. Specs, price history and ratings on Amazon India. Find which one is right for you.`,
    focuskw: `${compName.toLowerCase()}`,
  }
}

function metaForBuyingGuide(slug, titleRendered) {
  const rawTitle = (titleRendered || '')
    .replace(/&#8212;.*$/, '').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim()
  const guideName = rawTitle.replace(/\s*[—|].*$/, '').trim()
  return {
    title:   `${guideName} ${YEAR} — Best Picks & Prices | PriceHawk`,
    desc:    `${guideName}. Researched by PriceHawk with prices tracked daily on Amazon India. Find the best option for your budget.`,
    focuskw: `${guideName.toLowerCase()}`,
  }
}

function deriveMetaFor(slug, titleRendered) {
  // Static pages
  if (STATIC[slug]) return STATIC[slug]

  // Category hub: exact match in CAT_META
  if (CAT_META[slug]) return metaForCategoryHub(slug)

  // Best-{cat} pages (category hubs with 'best-' prefix)
  const bestCatSlug = slug.replace(/^best-/, '')
  if (CAT_META[bestCatSlug]) return metaForCategoryHub(bestCatSlug)

  // Review pages
  if (slug.includes('-review') || slug.startsWith('review-')) return metaForReview(slug, titleRendered)

  // Comparison pages
  if (slug.startsWith('compare-') || slug.includes('-vs-')) return metaForComparison(slug, titleRendered)

  // Buying guide / best-* pages
  if (slug.startsWith('best-')) return metaForBuyingGuide(slug, titleRendered)

  // Brand/category hub: {cat}-{brand} format
  for (const catSlug of Object.keys(CAT_META)) {
    if (slug.startsWith(catSlug + '-')) {
      const brand = slug.replace(catSlug + '-', '').replace(/-/g, ' ')
      const c = CAT_META[catSlug]
      return {
        title:   `${brand.replace(/\b\w/g, l => l.toUpperCase())} ${c.label} — Price & Reviews India ${YEAR} | PriceHawk`,
        desc:    `Compare all ${brand} ${c.plural} available in India. Prices tracked on Amazon India. Specs, ratings and price history.`,
        focuskw: `${brand} ${c.plural} india`,
      }
    }
  }

  return null
}

// ── WP fetch + patch ──────────────────────────────────────────────────────────

async function fetchAll(postType) {
  const items = []
  let page = 1
  while (true) {
    const r = await axios.get(
      `${WP}/wp-json/wp/v2/${postType}?per_page=100&page=${page}&status=publish,draft,private&_fields=id,slug,title`,
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

async function patchMeta(postType, id, meta) {
  await axios.post(
    `${WP}/wp-json/wp/v2/${postType}/${id}`,
    { meta: {
      _yoast_wpseo_title:    meta.title,
      _yoast_wpseo_metadesc: meta.desc,
      _yoast_wpseo_focuskw:  meta.focuskw,
    }},
    { headers: AUTH }
  )
}

async function main() {
  if (!WP) { console.error('WORDPRESS_URL missing'); process.exit(1) }

  let patched = 0, skipped = 0, errors = 0

  for (const postType of ['pages', 'posts']) {
    const items = await fetchAll(postType)
    console.log(`\n${postType}: ${items.length} found`)

    for (const item of items) {
      const titleRaw = item.title?.rendered || ''
      const meta = deriveMetaFor(item.slug, titleRaw)

      if (!meta) {
        console.log(`  [SKIP] ${item.slug} — no rule matched`)
        skipped++
        continue
      }

      if (DRY) {
        console.log(`  [DRY]  ${item.slug}`)
        console.log(`         title:   ${meta.title}`)
        console.log(`         desc:    ${meta.desc.substring(0, 80)}...`)
        console.log(`         focuskw: ${meta.focuskw}`)
        patched++
        continue
      }

      try {
        await patchMeta(postType, item.id, meta)
        console.log(`  [OK]   ${item.slug} → "${meta.focuskw}"`)
        patched++
      } catch (e) {
        console.error(`  [ERR]  ${item.slug}: ${e.response?.data?.message || e.message}`)
        errors++
      }

      await new Promise(r => setTimeout(r, 150))
    }
  }

  console.log(`\n── DONE ──────────────────────────────────`)
  console.log(`Patched: ${patched}  Skipped: ${skipped}  Errors: ${errors}`)
  if (DRY) console.log('(dry run — no WP changes made)')
}

main().catch(e => { console.error(e.message); process.exit(1) })
