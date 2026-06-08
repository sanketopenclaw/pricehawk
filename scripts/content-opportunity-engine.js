/**
 * PriceHawk Content Opportunity Engine
 * Analyzes product DB → generates ranked content publishing queue
 *
 * Output files (data/content/):
 *   content_queue.json         — ranked publishing queue (all opportunities)
 *   content_clusters.json      — product-grouped content clusters
 *   quick_wins.json            — top 100 low-competition high-value opportunities
 *   journey_gaps.json          — missing journey stages per product
 *   internal_link_opportunities.json
 *   revenue_opportunities.json
 *   priority_rankings.json     — full ranked list with scores
 *
 * Usage:
 *   node scripts/content-opportunity-engine.js
 *   node scripts/content-opportunity-engine.js --cat earbuds
 *   node scripts/content-opportunity-engine.js --top 10   # top N products per cat
 *   node scripts/content-opportunity-engine.js --kitchen  # kitchen beachhead only (Phase 1)
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')

const PRODS_DIR = path.join(__dirname, '../data/products')
const OUT_DIR   = path.join(__dirname, '../data/content')

// ─── CATEGORY METADATA ────────────────────────────────────────────────────────
// Drives traffic/revenue potential estimates

// commission_rate = June 2026 Amazon Associates India actual rates
// zero_pct_trap: true = earns 0% — content only worth building for traffic/list-building, NOT revenue
// Kitchen/Furniture/Home=5%, Large Appliances=3.5%, Electronics=3.5%, Phones=1%, Sports=4.7%, Bags=10%
// 0% traps: Apple all, earbuds/headphones/speakers <₹3k MRP, microwaves, semi-auto washers, gaming consoles
const CAT_META = {
  // ── Electronics (3.5%) ─────────────────────────────────────────────────────
  'laptops':          { tier: 1, avg_price: 70000, competition: 9, affiliate_intent: 9, commission_rate: 0.035 },
  'monitors':         { tier: 1, avg_price: 25000, competition: 7, affiliate_intent: 8, commission_rate: 0.035 },
  'gaming-monitors':  { tier: 1, avg_price: 30000, competition: 7, affiliate_intent: 8, commission_rate: 0.035 },
  'tablets':          { tier: 1, avg_price: 30000, competition: 8, affiliate_intent: 8, commission_rate: 0.035 },
  'cameras':          { tier: 1, avg_price: 40000, competition: 7, affiliate_intent: 8, commission_rate: 0.035 },
  'action-cameras':   { tier: 1, avg_price: 15000, competition: 6, affiliate_intent: 8, commission_rate: 0.035 },
  'smartwatches':     { tier: 1, avg_price: 10000, competition: 8, affiliate_intent: 8, commission_rate: 0.035 },
  'soundbars':        { tier: 1, avg_price: 10000, competition: 6, affiliate_intent: 8, commission_rate: 0.035 },
  'routers':          { tier: 2, avg_price: 5000,  competition: 5, affiliate_intent: 7, commission_rate: 0.035 },
  'microphones':      { tier: 4, avg_price: 5000,  competition: 4, affiliate_intent: 7, commission_rate: 0.035 },
  // ── Phones (1%) ────────────────────────────────────────────────────────────
  'smartphones':      { tier: 1, avg_price: 25000, competition: 9, affiliate_intent: 9, commission_rate: 0.010 },
  // ── 0% traps — build for traffic only, zero affiliate revenue ──────────────
  // earbuds: >90% of SKUs are <₹3k MRP → 0% commission
  'earbuds':          { tier: 1, avg_price: 5000,  competition: 8, affiliate_intent: 8, commission_rate: 0,     zero_pct_trap: true  },
  // headphones: mixed — avg ₹8k is above ₹3k threshold but budget models earn 0%
  'headphones':       { tier: 1, avg_price: 8000,  competition: 8, affiliate_intent: 8, commission_rate: 0.035, zero_pct_trap: false },
  // bluetooth speakers: most <₹3k → 0%
  'bluetooth-speakers': { tier: 1, avg_price: 4000, competition: 7, affiliate_intent: 7, commission_rate: 0,   zero_pct_trap: true  },
  // gaming consoles: 0%
  'gaming-mice':      { tier: 1, avg_price: 4000,  competition: 6, affiliate_intent: 8, commission_rate: 0.040 },
  'gaming-keyboards': { tier: 1, avg_price: 5000,  competition: 6, affiliate_intent: 8, commission_rate: 0.040 },
  'gaming-headsets':  { tier: 1, avg_price: 5000,  competition: 6, affiliate_intent: 8, commission_rate: 0.035 },
  // ── Large Appliances (3.5%) ─────────────────────────────────────────────────
  'refrigerators':    { tier: 3, avg_price: 35000, competition: 6, affiliate_intent: 9, commission_rate: 0.035 },
  'washing-machines': { tier: 3, avg_price: 30000, competition: 6, affiliate_intent: 9, commission_rate: 0.035 },
  'air-conditioners': { tier: 3, avg_price: 40000, competition: 6, affiliate_intent: 9, commission_rate: 0.035 },
  // ── Kitchen (5%) — beachhead ────────────────────────────────────────────────
  'air-fryers':         { tier: 3, avg_price: 4000,  competition: 5, affiliate_intent: 7, commission_rate: 0.050 },
  'mixer-grinders':     { tier: 3, avg_price: 3000,  competition: 4, affiliate_intent: 7, commission_rate: 0.050 },
  'coffee-machines':    { tier: 3, avg_price: 8000,  competition: 4, affiliate_intent: 7, commission_rate: 0.050 },
  'induction-cooktops': { tier: 3, avg_price: 2500,  competition: 4, affiliate_intent: 7, commission_rate: 0.050 },
  'electric-kettles':   { tier: 3, avg_price: 1500,  competition: 3, affiliate_intent: 6, commission_rate: 0.050 },
  'food-processors':    { tier: 3, avg_price: 5000,  competition: 3, affiliate_intent: 7, commission_rate: 0.050 },
  'hand-blenders':      { tier: 3, avg_price: 2000,  competition: 3, affiliate_intent: 6, commission_rate: 0.050 },
  'sandwich-makers':    { tier: 3, avg_price: 1500,  competition: 3, affiliate_intent: 6, commission_rate: 0.050 },
  'rice-cookers':       { tier: 3, avg_price: 2000,  competition: 3, affiliate_intent: 6, commission_rate: 0.050 },
  // microwave-ovens EXCLUDED: 0% commission per Amazon Associates India June 2026
  // ── Home (5%) ───────────────────────────────────────────────────────────────
  'air-purifiers':    { tier: 3, avg_price: 12000, competition: 5, affiliate_intent: 8, commission_rate: 0.050 },
  'water-purifiers':  { tier: 3, avg_price: 15000, competition: 5, affiliate_intent: 8, commission_rate: 0.050 },
  'robot-vacuums':    { tier: 3, avg_price: 20000, competition: 5, affiliate_intent: 8, commission_rate: 0.050 },
  'vacuum-cleaners':  { tier: 3, avg_price: 8000,  competition: 4, affiliate_intent: 7, commission_rate: 0.050 },
  'smart-lights':     { tier: 2, avg_price: 2000,  competition: 5, affiliate_intent: 7, commission_rate: 0.050 },
  'smart-plugs':      { tier: 2, avg_price: 1500,  competition: 4, affiliate_intent: 7, commission_rate: 0.050 },
  'smart-cameras':    { tier: 2, avg_price: 5000,  competition: 5, affiliate_intent: 8, commission_rate: 0.050 },
  'smart-locks':      { tier: 2, avg_price: 8000,  competition: 3, affiliate_intent: 8, commission_rate: 0.050 },
  'smart-switches':   { tier: 2, avg_price: 1500,  competition: 3, affiliate_intent: 7, commission_rate: 0.050 },
  // ── Furniture (5%) ──────────────────────────────────────────────────────────
  'office-chairs':    { tier: 4, avg_price: 15000, competition: 5, affiliate_intent: 8, commission_rate: 0.050 },
  'standing-desks':   { tier: 4, avg_price: 20000, competition: 4, affiliate_intent: 8, commission_rate: 0.050 },
  'monitor-arms':     { tier: 4, avg_price: 5000,  competition: 3, affiliate_intent: 7, commission_rate: 0.050 },
  // ── Mobile Accessories (4%) ─────────────────────────────────────────────────
  'power-banks':      { tier: 1, avg_price: 2000,  competition: 7, affiliate_intent: 7, commission_rate: 0.040 },
  'chargers':         { tier: 1, avg_price: 1500,  competition: 6, affiliate_intent: 7, commission_rate: 0.040 },
  'webcams':          { tier: 4, avg_price: 4000,  competition: 4, affiliate_intent: 7, commission_rate: 0.040 },
  'keyboards':        { tier: 4, avg_price: 3000,  competition: 6, affiliate_intent: 7, commission_rate: 0.040 },
  'mice':             { tier: 4, avg_price: 2000,  competition: 6, affiliate_intent: 7, commission_rate: 0.040 },
  'travel-adapters':  { tier: 6, avg_price: 1500,  competition: 4, affiliate_intent: 6, commission_rate: 0.040 },
  // ── Sports & Health (4.7%) ───────────────────────────────────────────────────
  'fitness-bands':    { tier: 5, avg_price: 3000,  competition: 7, affiliate_intent: 7, commission_rate: 0.047 },
  'exercise-bikes':   { tier: 5, avg_price: 20000, competition: 4, affiliate_intent: 8, commission_rate: 0.047 },
  'treadmills':       { tier: 5, avg_price: 30000, competition: 4, affiliate_intent: 8, commission_rate: 0.047 },
  'massage-guns':     { tier: 5, avg_price: 5000,  competition: 4, affiliate_intent: 7, commission_rate: 0.047 },
  'smart-scales':     { tier: 5, avg_price: 3000,  competition: 3, affiliate_intent: 7, commission_rate: 0.047 },
  // ── Bags & Luggage (10%) ────────────────────────────────────────────────────
  'backpacks':        { tier: 6, avg_price: 2000,  competition: 5, affiliate_intent: 6, commission_rate: 0.100 },
  'luggage':          { tier: 6, avg_price: 5000,  competition: 5, affiliate_intent: 7, commission_rate: 0.100 },
}

function catMeta(slug) {
  return CAT_META[slug] || { tier: 3, avg_price: 5000, competition: 5, affiliate_intent: 6 }
}

// ─── PRICE BRACKETS FOR BUYING GUIDES ────────────────────────────────────────

const PRICE_BRACKETS = [500, 1000, 2000, 5000, 10000, 25000, 50000]

function applicableBrackets(products) {
  const prices = products.map(p => p.current_price).filter(Boolean)
  if (!prices.length) return []
  const maxPrice = Math.max(...prices)
  return PRICE_BRACKETS.filter(b => b <= maxPrice * 1.2)
}

const USE_CASES = [
  'Small Families', 'Large Families', 'Daily Use', 'Beginners',
  'Heavy Use', 'Indian Cooking', 'Gifting', 'First Home',
  'Budget Buyers', 'Professional Use',
]

const DECISION_TYPES = [
  'Best Overall', 'Best Value', 'Best Premium',
  'Most Reliable', 'Best Build Quality', 'Best Warranty', 'Best Energy Efficient'
]

// ─── PRIORITY FORMULA (master doc §8) ─────────────────────────────────────────
// Priority = (Base - CompetitionPenalty) × Rankability
// Rankability 0.5–1.0; dominant variable for new domain.
// Buying guide Base=95 Rankability=0.4 → Priority 38.
// Long-tail comparison Base=70 Rankability=0.9 → Priority 63.

const RANKABILITY = {
  category_page:          0.80,
  brand_page:             0.80,
  review:                 0.85,  // long-tail product reviews attainable early
  comparison:             0.85,
  buying_guide_budget:    0.60,  // niche budget guides more attainable than broad
  buying_guide_use_case:  0.50,
  buying_guide_decision:  0.40,
  deal:                   0.70,
  price_history:          0.90,  // unique first-party data = high rankability
}

// Effort: 1=auto, 2=template, 3=researched, 4=written, 5=hands-on
const EFFORT = {
  category_page: 1,
  brand_page: 1,
  review: 3,
  comparison: 3,
  buying_guide: 3,
  deal: 1,
  price_history: 1,
}

// Kitchen beachhead — Phase 1 focus per master doc §13
// microwave-ovens excluded: Amazon Associates India = 0% commission (June 2026)
const KITCHEN_BEACHHEAD = new Set([
  'air-fryers', 'mixer-grinders', 'coffee-machines',
  'induction-cooktops', 'electric-kettles', 'food-processors',
  'hand-blenders', 'sandwich-makers', 'rice-cookers',
])

// Wave 2 + 3 categories per master doc §13
const WAVE_2_3 = new Set([
  'robot-vacuums', 'vacuum-cleaners', 'air-purifiers', 'water-purifiers',
  'air-conditioners', 'refrigerators', 'washing-machines',
])

function getRankability(type, subtype, catSlug) {
  let base
  if (type === 'buying_guide') {
    base = RANKABILITY[`buying_guide_${subtype}`] || RANKABILITY.buying_guide_decision
  } else {
    base = RANKABILITY[type] || 0.7
  }
  // Kitchen beachhead gets +0.1 rankability (less competitive SERPs)
  if (KITCHEN_BEACHHEAD.has(catSlug)) base = Math.min(1.0, base + 0.10)
  return base
}

function priorityScore({ traffic, revenue, competition, evergreen, strategic, journeyImpact, linkingValue }, type, subtype, catSlug) {
  const base = (traffic * 0.25) + (revenue * 0.25) + (evergreen * 0.15) +
               (strategic * 0.10) + (journeyImpact * 0.15) + (linkingValue * 0.10)
  const competitionPenalty = competition * 0.10
  const rawPriority = (base - competitionPenalty) * 10
  const rankability = getRankability(type, subtype, catSlug)
  return Math.round(Math.min(100, Math.max(0, rawPriority * rankability)))
}

function quickWinScore(priority, type) {
  const effort = EFFORT[type] || 3
  return Math.round((priority / effort) * 10) / 10
}

// ─── REVENUE ESTIMATE ────────────────────────────────────────────────────────

// commissionRate: actual June 2026 Amazon Associates India rate from CAT_META.
// If 0 (zero_pct_trap), returns {low:0, medium:0, high:0, zero_pct_trap:true}.
function revenueEstimate(price, affiliateIntent, competition, commissionRate) {
  const rate = commissionRate ?? (price > 20000 ? 0.035 : price > 5000 ? 0.04 : 0.05)
  if (rate === 0) return { low: 0, medium: 0, high: 0, zero_pct_trap: true }
  const trafficEstimate = Math.max(100, 2000 - competition * 150)
  const conversionRate = affiliateIntent * 0.003
  const low    = Math.round(price * rate * trafficEstimate * conversionRate * 0.3)
  const medium = Math.round(price * rate * trafficEstimate * conversionRate)
  const high   = Math.round(price * rate * trafficEstimate * conversionRate * 3)
  return { low, medium, high, commission_rate: rate }
}

// ─── JOURNEY GAP ANALYSIS ─────────────────────────────────────────────────────

function journeyScore(product, existingContent) {
  const asin = product.asin
  const name = product.name?.toLowerCase() || ''
  const covered = {
    brand_coverage:         !!(product.brand && product.brand !== 'Unknown'),
    review_coverage:        existingContent.reviews.has(asin),
    comparison_coverage:    existingContent.comparisons.has(asin),
    guide_coverage:         existingContent.guides.has(product._catSlug),
    deal_coverage:          existingContent.deals.has(asin),
    price_tracking_coverage: existingContent.priceTracking.has(asin),
    price_drop_coverage:    existingContent.priceDrops.has(asin),
  }
  const weights = {
    brand_coverage: 5, review_coverage: 25, comparison_coverage: 20,
    guide_coverage: 15, deal_coverage: 15, price_tracking_coverage: 10, price_drop_coverage: 10
  }
  const score = Object.entries(covered).reduce((sum, [k, v]) => sum + (v ? weights[k] : 0), 0)
  const missing = Object.entries(covered).filter(([, v]) => !v).map(([k]) => k.replace('_coverage', ''))
  return { score, missing, covered }
}

// ─── CONTENT SCORING HELPERS ─────────────────────────────────────────────────

function productPopularity(product) {
  const rc = parseInt(String(product.review_count || '0').replace(/[^0-9]/g, '')) || 0
  const rating = product.rating || 3
  // 0-10: higher review count + rating = more popular = more traffic potential
  return Math.min(10, (Math.log10(rc + 1) * 2.5) + ((rating - 3) * 1.5))
}

function priceToRevenuePotential(price) {
  if (price >= 50000) return 9
  if (price >= 20000) return 8
  if (price >= 10000) return 7
  if (price >= 5000)  return 6
  if (price >= 2000)  return 5
  return 4
}

// ─── STEP 1: CONTENT DISCOVERY ────────────────────────────────────────────────

function generateProductOpportunities(product, catSlug, meta, existingContent) {
  const ops = []
  const pop = productPopularity(product)
  const price = product.current_price || meta.avg_price
  const revPot = priceToRevenuePotential(price)
  const jGap = journeyScore(product, existingContent)

  // Review
  if (!existingContent.reviews.has(product.asin)) {
    ops.push({
      title: `${product.name} Review`,
      type: 'review',
      asin: product.asin,
      category: catSlug,
      brand: product.brand,
      scores: {
        traffic: Math.min(10, pop * 0.8 + 2),
        revenue: revPot,
        competition: meta.competition * 0.7,
        evergreen: 8,
        strategic: 8,
        journeyImpact: jGap.missing.includes('review') ? 9 : 3,
        linkingValue: 8,
      }
    })
  }

  // Comparisons: top-rated products in same category make best vs pairs
  // (actual pairs generated in Step 1b after all products loaded)
  product._needsComparison = !existingContent.comparisons.has(product.asin)

  // Deal page
  if (!existingContent.deals.has(product.asin)) {
    ops.push({
      title: `${product.name} Best Price & Deals`,
      type: 'deal',
      asin: product.asin,
      category: catSlug,
      brand: product.brand,
      scores: {
        traffic: Math.min(10, pop * 0.6 + 1),
        revenue: Math.min(10, revPot + 1),
        competition: meta.competition * 0.4,
        evergreen: 5,
        strategic: 7,
        journeyImpact: jGap.missing.includes('deal') ? 8 : 2,
        linkingValue: 6,
      }
    })
  }

  // Price history / price drop
  if (!existingContent.priceTracking.has(product.asin)) {
    ops.push({
      title: `${product.name} Price History & Price Drop Alert`,
      type: 'price_history',
      asin: product.asin,
      category: catSlug,
      brand: product.brand,
      scores: {
        traffic: Math.min(10, pop * 0.5 + 1),
        revenue: revPot * 0.7,
        competition: meta.competition * 0.3,
        evergreen: 6,
        strategic: 6,
        journeyImpact: jGap.missing.includes('price_tracking') ? 7 : 2,
        linkingValue: 5,
      }
    })
  }

  return ops
}

function generateComparisonOpportunities(products, catSlug, meta) {
  const ops = []
  // Sort by popularity, take top N for comparisons
  const sorted = [...products]
    .filter(p => p.current_price)
    .sort((a, b) => productPopularity(b) - productPopularity(a))
    .slice(0, 15)

  // Generate vs pairs for top products
  for (let i = 0; i < Math.min(sorted.length, 8); i++) {
    for (let j = i + 1; j < Math.min(sorted.length, 8); j++) {
      const a = sorted[i], b = sorted[j]
      // Only compare if price is within 3x of each other (makes sense)
      const pa = a.current_price || meta.avg_price
      const pb = b.current_price || meta.avg_price
      if (Math.max(pa, pb) / Math.min(pa, pb) > 3) continue

      const popA = productPopularity(a)
      const popB = productPopularity(b)
      const combinedPop = (popA + popB) / 2
      const avgPrice = (pa + pb) / 2

      ops.push({
        title: `${a.name} vs ${b.name}`,
        type: 'comparison',
        asins: [a.asin, b.asin],
        category: catSlug,
        brands: [a.brand, b.brand],
        scores: {
          traffic: Math.min(10, combinedPop * 0.9 + 2),
          revenue: priceToRevenuePotential(avgPrice),
          competition: meta.competition * 0.6,
          evergreen: 7,
          strategic: 7,
          journeyImpact: 7,
          linkingValue: 9,
        }
      })
    }
  }
  return ops
}

// ─── STEP 2: BUYING GUIDES ────────────────────────────────────────────────────

function generateBuyingGuides(catSlug, products, meta) {
  const ops = []
  const catLabel = catSlug.replace(/-/g, ' ')
  const catTitleCase = catLabel.replace(/\b\w/g, c => c.toUpperCase())
  const brackets = applicableBrackets(products)

  // Budget guides
  for (const bracket of brackets) {
    const matching = products.filter(p => p.current_price && p.current_price <= bracket)
    if (matching.length < 3) continue
    ops.push({
      title: `Best ${catTitleCase} Under ₹${bracket.toLocaleString('en-IN')}`,
      type: 'buying_guide',
      subtype: 'budget',
      category: catSlug,
      price_ceiling: bracket,
      scores: {
        traffic: Math.min(10, 4 + (10 - meta.competition) * 0.4 + Math.log10(bracket / 500)),
        revenue: priceToRevenuePotential(bracket * 0.7),
        competition: meta.competition * 0.5,
        evergreen: 9,
        strategic: 8,
        journeyImpact: 8,
        linkingValue: 9,
      }
    })
  }

  // Use case guides
  for (const useCase of USE_CASES) {
    ops.push({
      title: `Best ${catTitleCase} for ${useCase}`,
      type: 'buying_guide',
      subtype: 'use_case',
      category: catSlug,
      use_case: useCase,
      scores: {
        traffic: Math.min(10, 3 + (10 - meta.competition) * 0.5),
        revenue: meta.affiliate_intent * 0.8,
        competition: meta.competition * 0.4,
        evergreen: 9,
        strategic: 7,
        journeyImpact: 7,
        linkingValue: 8,
      }
    })
  }

  // Decision guides
  for (const decision of DECISION_TYPES) {
    ops.push({
      title: `${decision} ${catTitleCase} in India`,
      type: 'buying_guide',
      subtype: 'decision',
      category: catSlug,
      decision_type: decision,
      scores: {
        traffic: Math.min(10, 5 + (10 - meta.competition) * 0.3),
        revenue: meta.affiliate_intent * 0.9,
        competition: meta.competition * 0.5,
        evergreen: 9,
        strategic: 9,
        journeyImpact: 8,
        linkingValue: 9,
      }
    })
  }

  return ops
}

// ─── STEP 3: BRAND + CATEGORY PAGES ──────────────────────────────────────────

function generateBrandPages(products, catSlug, meta, seenBrands) {
  const ops = []
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))]
  for (const brand of brands) {
    if (seenBrands.has(brand)) continue
    seenBrands.add(brand)
    const brandProducts = products.filter(p => p.brand === brand)
    const avgPop = brandProducts.reduce((s, p) => s + productPopularity(p), 0) / brandProducts.length
    ops.push({
      title: `${brand} ${catSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} India — Best Prices & Reviews`,
      type: 'brand_page',
      brand,
      category: catSlug,
      product_count: brandProducts.length,
      scores: {
        traffic: Math.min(10, avgPop * 0.7 + 2),
        revenue: meta.affiliate_intent * 0.8,
        competition: meta.competition * 0.5,
        evergreen: 8,
        strategic: 8,
        journeyImpact: 6,
        linkingValue: 9,
      }
    })
  }
  return ops
}

function generateCategoryPage(catSlug, products, meta) {
  const catLabel = catSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return {
    title: `Best ${catLabel} in India ${new Date().getFullYear()} — Prices, Reviews & Deals`,
    type: 'category_page',
    category: catSlug,
    product_count: products.length,
    scores: {
      traffic: Math.min(10, 5 + (10 - meta.competition) * 0.4),
      revenue: meta.affiliate_intent,
      competition: meta.competition,
      evergreen: 9,
      strategic: 10,
      journeyImpact: 9,
      linkingValue: 10,
    }
  }
}

// ─── STEP 4: INTERNAL LINKING ─────────────────────────────────────────────────

function generateInternalLinks(product, catSlug, allOpsByAsin) {
  const links = []
  const asin = product.asin
  const review = allOpsByAsin[asin]?.find(o => o.type === 'review')
  if (!review) return links

  const from = review.title
  const targets = []

  // Review → comparison pages
  const comparisons = allOpsByAsin[asin]?.filter(o => o.type === 'comparison') || []
  comparisons.slice(0, 3).forEach(c => targets.push({ to: c.title, type: 'comparison', value: 9 }))

  // Review → buying guides (top 3 most relevant)
  targets.push({ to: `Best ${catSlug.replace(/-/g, ' ').replace(/\b\w/g, c=>c.toUpperCase())} in India ${new Date().getFullYear()}`, type: 'category_page', value: 8 })
  targets.push({ to: `Best ${catSlug.replace(/-/g, ' ').replace(/\b\w/g, c=>c.toUpperCase())} Under ₹${Math.ceil((product.current_price||5000)/1000)*1000}`, type: 'buying_guide', value: 8 })

  // Review → deal + price history
  targets.push({ to: `${product.name} Best Price & Deals`, type: 'deal', value: 7 })
  targets.push({ to: `${product.name} Price History & Price Drop Alert`, type: 'price_history', value: 7 })

  // Review → brand page
  if (product.brand) targets.push({ to: `${product.brand} ${catSlug.replace(/-/g, ' ').replace(/\b\w/g,c=>c.toUpperCase())} India — Best Prices & Reviews`, type: 'brand_page', value: 7 })

  links.push({ from, asin, category: catSlug, links: targets })
  return links
}

// ─── STEP 5-6: SCORE + RANK ───────────────────────────────────────────────────

function scoreOpportunity(op) {
  op.priority_score = priorityScore(op.scores, op.type, op.subtype, op.category)
  op.quick_win_score = quickWinScore(op.priority_score, op.type)
  op.rankability = getRankability(op.type, op.subtype, op.category)
  const meta = catMeta(op.category)
  const price = op.price_ceiling || meta.avg_price || 5000
  op.commission_rate = meta.commission_rate ?? null
  op.zero_pct_trap = meta.zero_pct_trap || false
  op.revenue_estimate = revenueEstimate(price, meta.affiliate_intent, meta.competition, meta.commission_rate)
  op.phase = KITCHEN_BEACHHEAD.has(op.category) ? 1 : WAVE_2_3.has(op.category) ? 2 : 3
  return op
}

// ─── STEP 8: CLUSTERS ────────────────────────────────────────────────────────

function buildClusters(opportunities) {
  const byAsin = new Map()
  const byCategory = new Map()

  for (const op of opportunities) {
    if (op.asin) {
      if (!byAsin.has(op.asin)) byAsin.set(op.asin, { asin: op.asin, items: [] })
      byAsin.get(op.asin).items.push({ title: op.title, type: op.type, priority_score: op.priority_score })
    }
    if (op.asins) {
      for (const asin of op.asins) {
        if (!byAsin.has(asin)) byAsin.set(asin, { asin, items: [] })
        byAsin.get(asin).items.push({ title: op.title, type: op.type, priority_score: op.priority_score })
      }
    }
    if (op.type === 'buying_guide' || op.type === 'category_page') {
      if (!byCategory.has(op.category)) byCategory.set(op.category, { category: op.category, items: [] })
      byCategory.get(op.category).items.push({ title: op.title, type: op.type, priority_score: op.priority_score })
    }
  }

  const clusters = []
  for (const [asin, cluster] of byAsin) {
    if (cluster.items.length < 2) continue
    cluster.items.sort((a, b) => b.priority_score - a.priority_score)
    cluster.cluster_score = Math.round(cluster.items.reduce((s, i) => s + i.priority_score, 0) / cluster.items.length)
    clusters.push(cluster)
  }
  for (const [cat, cluster] of byCategory) {
    cluster.items.sort((a, b) => b.priority_score - a.priority_score)
    cluster.cluster_score = Math.round(cluster.items.reduce((s, i) => s + i.priority_score, 0) / cluster.items.length)
    clusters.push(cluster)
  }

  return clusters.sort((a, b) => b.cluster_score - a.cluster_score)
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const catFilterIdx = args.indexOf('--cat')
  const catFilter = catFilterIdx !== -1 ? args[catFilterIdx + 1] : null
  const topIdx = args.indexOf('--top')
  const topN = topIdx !== -1 ? parseInt(args[topIdx + 1]) || null : null
  const kitchenOnly = args.includes('--kitchen')

  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Load all products
  const catFiles = fs.readdirSync(PRODS_DIR).filter(f => f.endsWith('.json')).sort()
  const categoriesData = []

  for (const file of catFiles) {
    const slug = file.replace('.json', '')
    if (catFilter && slug !== catFilter) continue
    if (kitchenOnly && !KITCHEN_BEACHHEAD.has(slug) && !WAVE_2_3.has(slug)) continue
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PRODS_DIR, file), 'utf8'))
      let products = (data.products || []).map(p => {
        // Normalize: support both old flat schema and new nested schema post-migration
        const offerObj = Array.isArray(p.offers) ? p.offers[0] : p.offers
        return {
          ...p,
          _catSlug: slug,
          name:          p.name          || p.product_name       || p._legacy?.name,
          asin:          p.asin          || offerObj?.external_id || p._legacy?.asin,
          brand:         p.brand         || p.brand_id            || p._legacy?.brand,
          current_price: p.current_price || offerObj?.last_price  || p._legacy?.current_price,
          rating:        p.rating        || p._legacy?.rating,
          review_count:  p.review_count  || p._legacy?.review_count,
        }
      })
      if (topN) products = products.slice(0, topN)
      categoriesData.push({ slug, products, meta: catMeta(slug) })
    } catch { /* skip */ }
  }

  const totalProducts = categoriesData.reduce((s, c) => s + c.products.length, 0)
  console.log(`Loaded ${totalProducts} products across ${categoriesData.length} categories`)

  // Build existing content index (empty for now — future: load from WP/DB)
  const existingContent = {
    reviews:      new Set(),
    comparisons:  new Set(),
    guides:       new Set(),
    deals:        new Set(),
    priceTracking: new Set(),
    priceDrops:   new Set(),
  }

  const allOpportunities = []
  const journeyGaps = []
  const internalLinks = []
  const seenBrands = new Set()
  const allOpsByAsin = {}

  // Step 1 + 2 + 3: generate all opportunities per category
  for (const { slug, products, meta } of categoriesData) {
    process.stdout.write(`  [${slug}] `)

    // Category page
    allOpportunities.push(scoreOpportunity(generateCategoryPage(slug, products, meta)))

    // Buying guides
    const guides = generateBuyingGuides(slug, products, meta)
    guides.forEach(g => allOpportunities.push(scoreOpportunity(g)))

    // Brand pages
    const brandPages = generateBrandPages(products, slug, meta, seenBrands)
    brandPages.forEach(b => allOpportunities.push(scoreOpportunity(b)))

    // Per-product: reviews, deals, price history
    for (const product of products) {
      const ops = generateProductOpportunities(product, slug, meta, existingContent)
      ops.forEach(op => {
        scoreOpportunity(op)
        if (!allOpsByAsin[product.asin]) allOpsByAsin[product.asin] = []
        allOpsByAsin[product.asin].push(op)
        allOpportunities.push(op)
      })

      // Journey gap
      const jGap = journeyScore(product, existingContent)
      if (jGap.missing.length > 0) {
        journeyGaps.push({
          asin: product.asin,
          name: product.name,
          category: slug,
          brand: product.brand,
          journey_score: jGap.score,
          missing: jGap.missing,
          priority: jGap.missing.includes('review') ? 'high' : jGap.missing.length > 4 ? 'high' : 'medium'
        })
      }
    }

    // Comparisons (needs all products in category)
    const comparisons = generateComparisonOpportunities(products, slug, meta)
    comparisons.forEach(c => {
      scoreOpportunity(c)
      for (const asin of (c.asins || [])) {
        if (!allOpsByAsin[asin]) allOpsByAsin[asin] = []
        allOpsByAsin[asin].push(c)
      }
      allOpportunities.push(c)
    })

    // Internal linking
    for (const product of products) {
      const links = generateInternalLinks(product, slug, allOpsByAsin)
      internalLinks.push(...links)
    }

    process.stdout.write(`${products.length} products, ${guides.length} guides, ${comparisons.length} comparisons\n`)
  }

  // Sort all by priority
  allOpportunities.sort((a, b) => b.priority_score - a.priority_score)

  // Step 7: publishing queue (title + type + score + revenue)
  const contentQueue = allOpportunities.map(op => ({
    title: op.title,
    type: op.type,
    subtype: op.subtype || null,
    category: op.category,
    phase: op.phase,
    priority_score: op.priority_score,
    quick_win_score: op.quick_win_score,
    rankability: op.rankability,
    commission_rate: op.commission_rate,
    ...(op.zero_pct_trap ? { zero_pct_trap: true } : {}),
    revenue_estimate: op.revenue_estimate,
    ...(op.asin          ? { asin: op.asin }                   : {}),
    ...(op.asins         ? { asins: op.asins }                 : {}),
    ...(op.brand         ? { brand: op.brand }                 : {}),
    ...(op.price_ceiling ? { price_ceiling: op.price_ceiling } : {}),
    ...(op.use_case      ? { use_case: op.use_case }           : {}),
  }))

  // Step 8: clusters
  const contentClusters = buildClusters(allOpportunities)

  // Step 9: quick wins — sorted by quick_win_score (priority/effort), Phase 1 first
  const quickWins = allOpportunities
    .filter(op => {
      const s = op.scores
      return s.competition <= 5 && s.traffic >= 5 && (s.revenue >= 6 || s.journeyImpact >= 7)
    })
    .sort((a, b) => {
      if (a.phase !== b.phase) return a.phase - b.phase  // Phase 1 first
      return b.quick_win_score - a.quick_win_score
    })
    .slice(0, 100)
    .map(op => ({
      title: op.title, type: op.type, subtype: op.subtype || null,
      category: op.category, phase: op.phase,
      priority_score: op.priority_score,
      quick_win_score: op.quick_win_score,
      rankability: op.rankability,
      revenue_estimate: op.revenue_estimate,
      why: `competition=${op.scores.competition.toFixed(1)} traffic=${op.scores.traffic.toFixed(1)} revenue=${op.scores.revenue.toFixed(1)}`
    }))

  // Step 10: revenue opportunities ranked by medium estimate
  const revenueOpportunities = [...allOpportunities]
    .sort((a, b) => (b.revenue_estimate?.medium || 0) - (a.revenue_estimate?.medium || 0))
    .slice(0, 500)
    .map(op => ({
      title: op.title, type: op.type, category: op.category,
      priority_score: op.priority_score,
      revenue_low: op.revenue_estimate?.low,
      revenue_medium: op.revenue_estimate?.medium,
      revenue_high: op.revenue_estimate?.high,
    }))

  // Phase 1 opportunities — kitchen beachhead, Phase 1 only, sorted by quick_win_score
  const phase1Queue = allOpportunities
    .filter(op => op.phase === 1)
    .sort((a, b) => b.quick_win_score - a.quick_win_score)
    .map((op, i) => ({
      rank: i + 1,
      title: op.title, type: op.type, subtype: op.subtype || null,
      category: op.category,
      priority_score: op.priority_score,
      quick_win_score: op.quick_win_score,
      rankability: op.rankability,
      commission_rate: op.commission_rate,
      ...(op.zero_pct_trap ? { zero_pct_trap: true } : {}),
      revenue_estimate: op.revenue_estimate,
      ...(op.asin          ? { asin: op.asin }                   : {}),
      ...(op.asins         ? { asins: op.asins }                 : {}),
      ...(op.brand         ? { brand: op.brand }                 : {}),
      ...(op.price_ceiling ? { price_ceiling: op.price_ceiling } : {}),
      ...(op.use_case      ? { use_case: op.use_case }           : {}),
    }))

  // Priority rankings (full)
  const priorityRankings = allOpportunities.map((op, i) => ({
    rank: i + 1,
    title: op.title, type: op.type, subtype: op.subtype || null,
    category: op.category, phase: op.phase,
    priority_score: op.priority_score,
    quick_win_score: op.quick_win_score,
    rankability: op.rankability,
    scores: op.scores,
  }))

  // Write all output files
  const outputs = {
    'content_queue.json':                contentQueue,
    'content_clusters.json':             contentClusters,
    'quick_wins.json':                   quickWins,
    'phase1_queue.json':                 phase1Queue,
    'journey_gaps.json':                 journeyGaps.sort((a, b) => a.journey_score - b.journey_score),
    'internal_link_opportunities.json':  internalLinks,
    'revenue_opportunities.json':        revenueOpportunities,
    'priority_rankings.json':            priorityRankings,
  }

  for (const [filename, data] of Object.entries(outputs)) {
    fs.writeFileSync(path.join(OUT_DIR, filename), JSON.stringify(data, null, 2))
    console.log(`  ✓ ${filename} (${data.length} items)`)
  }

  // Summary
  const byType = {}
  for (const op of allOpportunities) byType[op.type] = (byType[op.type] || 0) + 1
  console.log('\n── SUMMARY ──────────────────────────────')
  console.log(`Total opportunities: ${allOpportunities.length}`)
  Object.entries(byType).sort((a,b)=>b[1]-a[1]).forEach(([t,n]) => console.log(`  ${t}: ${n}`))
  console.log(`\nTop 5 by priority:`)
  contentQueue.slice(0, 5).forEach((op, i) => console.log(`  ${i+1}. [${op.priority_score}] ${op.title}`))
  console.log(`\nTop 5 quick wins (Phase 1 first):`)
  quickWins.slice(0, 5).forEach((op, i) => console.log(`  ${i+1}. [p${op.phase} pri=${op.priority_score} qw=${op.quick_win_score}] ${op.title}`))
  console.log(`\nPhase 1 (kitchen beachhead): ${phase1Queue.length} opportunities`)
  phase1Queue.slice(0, 5).forEach((op, i) => console.log(`  ${i+1}. [qw=${op.quick_win_score}] ${op.title}`))
  console.log(`\nJourney gaps: ${journeyGaps.length} products with missing content`)
  console.log(`Output: ${OUT_DIR}`)
  if (kitchenOnly) console.log('(kitchen+wave2/3 only — run without --kitchen for full catalog)')
}

main().catch(e => { console.error(e.message); process.exit(1) })
