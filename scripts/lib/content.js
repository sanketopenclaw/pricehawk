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

module.exports = {
  resolveOffer,
  specTable,
  featureHighlights,
  familySizeFromCapacity,
  getSpecVal,
  asciDisclosure,
  methodologyBlock,
  loadProducts,
}
