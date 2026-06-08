// scripts/lib/content.js
const fs = require('fs')
const path = require('path')

function resolveOffer(product) {
  const o = product.offers
  return Array.isArray(o) ? o[0] : (o || {})
}

function specTable(specifications) {
  if (!specifications || typeof specifications !== 'object') return ''
  const rows = Object.entries(specifications)
    .filter(([k]) => !k.startsWith('_'))
    .filter(([, v]) => v && String(v).trim())
  if (!rows.length) return ''
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
${rows.map(([k, v]) => `  <tr style="border-bottom:1px solid #e8e8e8;">
    <td style="padding:8px 12px;color:#666;width:40%;font-weight:600;">${k}</td>
    <td style="padding:8px 12px;">${String(v)}</td>
  </tr>`).join('\n')}
</table>`
}

function featureHighlights(features, max = 3) {
  if (!Array.isArray(features) || !features.length) return ''
  const items = features.slice(0, max)
  return `<ul style="font-size:15px;line-height:1.8;color:#333;margin:0;padding-left:20px;">
${items.map(f => `  <li>${f}</li>`).join('\n')}
</ul>`
}

function familySizeFromCapacity(capacityStr) {
  if (!capacityStr) return null
  const n = parseFloat(String(capacityStr).replace(/[^0-9.]/g, ''))
  if (isNaN(n)) return null
  if (n <= 2)   return '1–2 people'
  if (n <= 3)   return '2–3 people'
  if (n <= 4.5) return 'a family of 3–4'
  if (n <= 6)   return 'a family of 4–6'
  return 'large families or batch cooking'
}

// Pull first matching key from a specifications object
function getSpecVal(specs, ...keys) {
  for (const k of keys) {
    if (specs[k] && String(specs[k]).trim()) return String(specs[k]).trim()
  }
  return null
}

function asciDisclosure() {
  return `<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:10px 16px;font-size:13px;line-height:1.5;margin-bottom:20px;">
<strong>Affiliate Disclosure:</strong> PriceHawk earns a commission on qualifying purchases made through links on this page. This never influences our editorial recommendations. As an Amazon Associate I earn from qualifying purchases.
</div>`
}

function methodologyBlock(contextSentence) {
  return `<div style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:14px 18px;margin:24px 0;font-size:13px;line-height:1.6;">
<strong>PriceHawk Methodology:</strong> ${contextSentence} PriceHawk has not independently lab-tested this unit. All opinions are based on documented specifications and aggregated public user feedback — not hands-on testing.
</div>`
}

function loadProducts(categories, prodsDir) {
  const index = {}
  for (const cat of categories) {
    const fp = path.join(prodsDir, `${cat}.json`)
    if (!fs.existsSync(fp)) continue
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'))
    for (const p of (data.products || [])) {
      const offer = resolveOffer(p)
      const asin = offer?.external_id || p._legacy?.asin
      if (asin) index[asin] = { ...p, _catSlug: cat }
    }
  }
  return index
}

function sparklineSVG(productId, priceSeriesDir) {
  const fp = path.join(priceSeriesDir, `${productId}.json`)
  if (!fs.existsSync(fp)) return ''
  let entries
  try { entries = JSON.parse(fs.readFileSync(fp, 'utf8')) } catch { return '' }
  // format: { points: [{date, price, merchant}] }
  const points = Array.isArray(entries.points) ? entries.points.map(e => e.price) : []
  if (!Array.isArray(points) || points.length < 3) return ''
  const prices = points.filter(p => typeof p === 'number' && p > 0)
  if (prices.length < 3) return ''

  const W = 80, H = 24
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const coords = prices.map((p, i) => {
    const x = Math.round((i / (prices.length - 1)) * W)
    const y = Math.round(H - ((p - min) / range) * (H - 2) - 1)
    return `${x},${y}`
  }).join(' ')

  const trend = prices[prices.length - 1] >= prices[0] ? '#4caf50' : '#f44336'
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:inline-block;vertical-align:middle;" aria-hidden="true"><polyline points="${coords}" fill="none" stroke="${trend}" stroke-width="1.5" stroke-linejoin="round"/></svg>`
}

function bestValueScore(product) {
  const specs = product.specifications || {}
  const segOrder = { budget: 4, 'mid-range': 3, premium: 2, flagship: 1 }
  const seg = product.price_segment || product._legacy?.price_segment || 'mid-range'
  const segScore = segOrder[seg] || 2  // higher score for budget (more value relative to cost)

  const wStr = getSpecVal(specs, 'Output Wattage', 'Wattage', 'Wattage Rating') || ''
  const cStr = getSpecVal(specs, 'Capacity', 'Volume', 'Bowl Capacity', 'Jug Capacity') || ''
  const w = parseFloat(wStr.replace(/[^0-9.]/g, '')) || 0
  const c = parseFloat(cStr.replace(/[^0-9.]/g, '')) || 0
  const featureCount = Array.isArray(specs._features) ? specs._features.length : 0

  // Normalised components — wattage capped at 2000W, capacity at 8L, features at 10
  const wNorm = Math.min(w / 2000, 1) * 40
  const cNorm = Math.min(c / 8, 1) * 30
  const fNorm = Math.min(featureCount / 10, 1) * 10
  // segScore: budget products score 4x, flagship 1x
  return (wNorm + cNorm + fNorm) * segScore
}

function topValueProduct(products) {
  if (!products || !products.length) return null
  return products.reduce((best, p) =>
    bestValueScore(p) > bestValueScore(best) ? p : best
  , products[0])
}

// ---------------------------------------------------------------------------
// Internal linking helpers
// ---------------------------------------------------------------------------

// Mirrors the slugify used in scripts/lib/schema.js
function _slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Derive the buying-guide slug from a queue entry, matching generate-buying-guides.js logic:
//   best-{catSlug}                         (no subtype / decision)
//   best-{catSlug}-budget                  (subtype === 'budget')
//   best-{catSlug}-{slugified-use_case}    (subtype === 'use_case', has use_case field)
function _guideSlug(op) {
  const base = `best-${op.category}`
  if (op.subtype === 'budget') return `${base}-budget`
  if (op.subtype === 'use_case' && op.use_case) return `${base}-${_slugify(op.use_case)}`
  return base
}

/**
 * Build a lookup index from a parsed phase1_queue.json array.
 *
 * Returns an object with:
 *   index[asin]  → { reviewSlug, comparisonSlugs[], catSlug }
 *   index['__hub__' + catSlug]   → slug string  (from category_page entries)
 *   index['__guide__' + catSlug] → slug string  (from buying_guide entries — first/base one)
 *
 * Comparison entries in the queue have `asins` but no `brands`, so comparison
 * slugs fall back to 'product' for both brand placeholders.  The generators
 * resolve real brand_id values from the product DB at write-time, so these
 * fallback slugs may differ from published URLs.  They are stored anyway so
 * relatedLinks can surface at least the right shape of link.
 */
function buildSlugIndex(queueData) {
  const index = {}

  for (const op of queueData) {
    // ---- review ----
    if (op.type === 'review' && op.asin) {
      const brand = _slugify(op.brand || 'product')
      const asin  = op.asin.toLowerCase()
      if (!index[op.asin]) {
        index[op.asin] = { reviewSlug: null, comparisonSlugs: [], catSlug: op.category }
      }
      index[op.asin].reviewSlug = `review-${brand}-${asin}`
    }

    // ---- comparison ----
    // Queue has asins[] but no brands[] — fall back to 'product' for both sides
    if (op.type === 'comparison' && Array.isArray(op.asins) && op.asins.length >= 2) {
      const [a1, a2] = op.asins
      const b1 = _slugify(op.brands?.[0] || 'product')
      const b2 = _slugify(op.brands?.[1] || 'product')
      const slug = `compare-${b1}-${a1.toLowerCase()}-vs-${b2}-${a2.toLowerCase()}`
      for (const asin of [a1, a2]) {
        if (!index[asin]) {
          index[asin] = { reviewSlug: null, comparisonSlugs: [], catSlug: op.category }
        }
        index[asin].comparisonSlugs.push(slug)
      }
    }

    // ---- buying_guide — store the base (non-subtyped) slug per category ----
    if (op.type === 'buying_guide' && op.category) {
      const key = '__guide__' + op.category
      // Prefer the base guide (no subtype) so the link title stays generic
      if (!index[key] || (!op.subtype)) {
        index[key] = _guideSlug(op)
      }
    }

    // ---- category_page → hub ----
    if (op.type === 'category_page' && op.category) {
      const key = '__hub__' + op.category
      if (!index[key]) {
        index[key] = `best-${op.category}`
      }
    }
  }

  return index
}

/**
 * Build an HTML "Related Pages" section for a product page.
 *
 * @param {string} asin       - The product ASIN
 * @param {string} catSlug    - Category slug, e.g. 'air-fryers'
 * @param {object} slugIndex  - Result of buildSlugIndex()
 * @param {string} catLabel   - Human-readable label, e.g. 'Air Fryer'
 * @returns {string} HTML string, or '' if nothing to link
 */
function relatedLinks(asin, catSlug, slugIndex, catLabel) {
  const links = []
  const entry = slugIndex[asin] || {}

  // Always link to category hub (fallback if not in index)
  const hubSlug = slugIndex['__hub__' + catSlug] || `best-${catSlug}`
  links.push(
    `<a href="/${hubSlug}/" style="color:#e65100;text-decoration:none;font-weight:600;">Best ${catLabel}s in India →</a>`
  )

  // Link to buying guide only when it differs from the hub (avoids duplicate link)
  const guideSlug = slugIndex['__guide__' + catSlug]
  if (guideSlug && guideSlug !== hubSlug) {
    links.push(
      `<a href="/${guideSlug}/" style="color:#e65100;text-decoration:none;font-weight:600;">${catLabel} Buying Guide →</a>`
    )
  }

  // Up to 2 comparison pages featuring this product
  const compSlugs = (entry.comparisonSlugs || []).slice(0, 2)
  for (const slug of compSlugs) {
    links.push(
      `<a href="/${slug}/" style="color:#1565c0;text-decoration:none;">Compare options →</a>`
    )
  }

  if (!links.length) return ''

  return `<div style="background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;padding:14px 18px;margin:24px 0;">
<p style="font-size:13px;font-weight:700;color:#444;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px;">Related Pages</p>
<div style="display:flex;flex-wrap:wrap;gap:10px 20px;">
${links.map(l => `<span style="font-size:14px;">${l}</span>`).join('\n')}
</div>
</div>`
}

function metaDescription(name, catLabel, specs, seg) {
  const wattage  = getSpecVal(specs, 'Output Wattage', 'Wattage', 'Wattage Rating')
  const capacity = getSpecVal(specs, 'Capacity', 'Volume', 'Bowl Capacity', 'Jug Capacity')
  const segWord  = { budget: 'affordable', 'mid-range': 'mid-range', premium: 'premium', flagship: 'flagship' }[seg] || 'popular'

  const specPart = [wattage, capacity].filter(Boolean).join(', ')
  const base = specPart
    ? `${name} — ${specPart} ${catLabel.toLowerCase()} for Indian homes.`
    : `${name} — ${segWord} ${catLabel.toLowerCase()} for Indian homes.`

  const suffix = ' Read our full spec breakdown, price trend, and verdict.'
  const desc = base + suffix
  return desc.length > 160 ? desc.substring(0, 157) + '…' : desc
}

module.exports = {
  resolveOffer,
  specTable,
  featureHighlights,
  familySizeFromCapacity,
  getSpecVal,
  asciDisclosure,
  methodologyBlock,
  loadProducts,
  sparklineSVG,
  bestValueScore,
  topValueProduct,
  buildSlugIndex,
  relatedLinks,
  metaDescription,
}
