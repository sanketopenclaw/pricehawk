// scripts/lib/templates.js
// Research-backed page sections (docs/content-templates.md):
// verdict-first box (Wirecutter), spec-derived pros/cons (Google review guidance —
// "discuss benefits and drawbacks"), recency line. Cons derive ONLY from documented
// specs vs category context — never fabricated.
const { getSpecVal } = require('./content')
const { seededPick } = require('./voice')

function numSpec(specs, ...keys) {
  const v = getSpecVal(specs || {}, ...keys)
  if (!v) return null
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : n
}

function median(nums) {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const WATT_KEYS = ['Output Wattage', 'Wattage', 'Wattage Rating']
const CAP_KEYS  = ['Capacity', 'Volume', 'Bowl Capacity', 'Jug Capacity']

function prosConsFromSpecs(product, categoryProducts, catLabel) {
  const specs    = product.specifications || {}
  const features = specs._features || []
  const cat      = String(catLabel || 'product').toLowerCase()
  const pros = []
  const cons = []

  // Wattage vs category median
  const w = numSpec(specs, ...WATT_KEYS)
  const catWatts = (categoryProducts || []).map(p => numSpec(p.specifications, ...WATT_KEYS)).filter(n => n != null)
  const medW = median(catWatts)
  if (w != null && medW != null) {
    if (w >= medW * 1.15) pros.push(`More power (${w}W) than most ${cat}s we track — faster preheat and quicker cooking`)
    else if (w <= medW * 0.8) cons.push(`${w}W is below the category norm (~${Math.round(medW)}W) — expect slower preheat and longer cook times`)
  }

  // Capacity sizing
  const c = numSpec(specs, ...CAP_KEYS)
  if (c != null) {
    if (c <= 2.5) cons.push(`At ${c}L it is small — cooking for a family of four means batches`)
    else if (c >= 6) cons.push(`${c}L is generous but bulky — measure your counter space first`)
    if (c >= 4 && c < 6) pros.push(`${c}L capacity comfortably covers a family of 3–4`)
  }

  // Controls
  const ctrl = getSpecVal(specs, 'Controller Type', 'Control Method', 'Controls')
  if (ctrl && /manual|knob|analog/i.test(ctrl)) {
    cons.push('Manual controls only — no digital presets, so timing is on you')
  } else if (ctrl && /touch|digital/i.test(ctrl)) {
    pros.push('Digital controls with presets — less guesswork than manual dials')
  }

  // Common features the category has that this product lacks
  const hasFeature = (feats, re) => (feats || []).some(f => re.test(f))
  const AUTO_RE = /auto.?shut|overheat/i
  const productHasAuto = hasFeature(features, AUTO_RE)
  const catWithAuto = (categoryProducts || []).filter(p => hasFeature(p.specifications?._features, AUTO_RE)).length
  if (!productHasAuto && categoryProducts?.length && catWithAuto >= categoryProducts.length / 2) {
    cons.push('No auto shut-off listed in the specs — a safety feature most rivals in this category include')
  } else if (productHasAuto) {
    pros.push('Auto shut-off and overheat protection included')
  }

  if (hasFeature(features, /keep.?warm/i)) pros.push('Keep-warm mode holds food at temperature after cooking')

  // Segment expectation-setting (tradeoff phrasing, not a flaw)
  const seg = product.price_segment || 'mid-range'
  if (seg === 'budget' && cons.length < 2) {
    cons.push('Budget pricing usually means simpler materials — fine for regular use, just not premium feel')
  }

  return { pros, cons }
}

const VERDICT_FRAMES = [
  (name, who, strength) => `The <strong>${name}</strong> is probably the right call if you're buying for ${who} — its case rests on ${strength}.`,
  (name, who, strength) => `For ${who}, the <strong>${name}</strong> is a solid pick: ${strength} is what it gets right.`,
  (name, who, strength) => `If your household is ${who}, the <strong>${name}</strong> is likely worth shortlisting — mainly for ${strength}.`,
]

// Verdict-first box (Wirecutter pattern): answer at the top for readers who won't scroll
function verdictBox({ name, catLabel, seg, whoFor, keyStrength, link, seed = '' }) {
  const frame = seededPick(VERDICT_FRAMES, seed)
  const segLabel = String(seg || 'mid-range').replace(/-/g, ' ')
  return `<div style="background:#fffbf2;border:1px solid #f0d9a8;border-left:4px solid #e8a020;border-radius:0 6px 6px 0;padding:16px 20px;margin:0 0 20px;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#b07b10;">PriceHawk verdict · ${segLabel}</p>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#333;">${frame(name, whoFor, keyStrength)} The full reasoning, specs and honest gaps are below.</p>
  <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
    Check today's price on Amazon →
  </a>
</div>`
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Recency signal — honest: specs reviewed at generation time, price genuinely tracked daily
function updatedLine(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return `<p style="font-size:12.5px;color:#888;margin:0 0 16px;">Specs reviewed ${MONTHS[d.getMonth()]} ${d.getFullYear()} · Amazon price tracked daily by PriceHawk</p>`
}

// Two-column pros / falls-short block. Renders only sides that have content.
function prosConsBlock(pros, cons) {
  if (!pros.length && !cons.length) return ''
  const col = (title, items, color, bg) => items.length ? `<div style="flex:1;min-width:240px;background:${bg};border-radius:6px;padding:14px 18px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${color};">${title}</p>
    <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:#333;">
      ${items.map(i => `<li>${i}</li>`).join('\n      ')}
    </ul>
  </div>` : ''
  return `<h2 style="font-size:20px;font-weight:700;margin:28px 0 10px;">The Good and the Not-So-Good</h2>
<div style="display:flex;gap:14px;flex-wrap:wrap;margin:0 0 8px;">
  ${col('What works in its favour', pros, '#2e7d32', '#f1f8e9')}
  ${col('Where it falls short', cons, '#c62828', '#fdf3f2')}
</div>`
}

module.exports = { prosConsFromSpecs, verdictBox, updatedLine, prosConsBlock, median }
