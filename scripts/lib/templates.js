// scripts/lib/templates.js
// Research-backed page sections (docs/content-templates.md):
// verdict-first box (Wirecutter), spec-derived pros/cons (Google review guidance —
// "discuss benefits and drawbacks"), recency line. Cons derive ONLY from documented
// specs vs category context — never fabricated.
const { getSpecVal, resolveOffer } = require('./content')
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
  return `<h2 id="pros-cons" style="font-size:20px;font-weight:700;margin:28px 0 10px;">The Good and the Not-So-Good</h2>
<div style="display:flex;gap:14px;flex-wrap:wrap;margin:0 0 8px;">
  ${col('What works in its favour', pros, '#2e7d32', '#f1f8e9')}
  ${col('Where it falls short', cons, '#c62828', '#fdf3f2')}
</div>`
}

// Full-bleed breakout from the theme's narrow post column (RTINGS/Wirecutter are wide).
// Outer div spans the viewport; inner recenters at a readable wide max.
function wideShell(innerHtml) {
  return `<div style="width:100vw;position:relative;left:calc(50% - 50vw);">
<div style="max-width:1200px;margin:0 auto;padding:0 24px;box-sizing:border-box;">
${innerHtml}
</div>
</div>`
}

function productPrice(p) {
  const o = resolveOffer(p)
  return o.last_price || p._legacy?.current_price || null
}

const SCORE_DIMENSIONS = [
  { label: 'Power',    fn: p => numSpec(p.specifications, ...WATT_KEYS) },
  { label: 'Capacity', fn: p => numSpec(p.specifications, ...CAP_KEYS) },
  { label: 'Features', fn: p => (p.specifications?._features || []).length || null },
]

// RTINGS-style scorecard, honest version: normalized against the category we track,
// derived from documented specs — explicitly NOT test scores.
function specScorecard(product, categoryProducts, catLabel) {
  const cat = String(catLabel || 'product').toLowerCase()
  const rows = []
  for (const dim of SCORE_DIMENSIONS) {
    const mine = dim.fn(product)
    if (mine == null) continue
    const all = (categoryProducts || []).map(dim.fn).filter(n => n != null && n > 0)
    const max = all.length ? Math.max(...all) : null
    if (!max) continue
    const score = Math.min(10, (mine / max) * 10)
    rows.push({ label: dim.label, score, display: `${score.toFixed(1)}/10` })
  }
  // Price position: cheaper within the category scores higher (explicitly labelled)
  const myPrice = productPrice(product)
  const prices = (categoryProducts || []).map(productPrice).filter(n => n != null)
  if (myPrice != null && prices.length > 1) {
    const min = Math.min(...prices), max = Math.max(...prices)
    if (max > min) {
      const score = 10 * (1 - (myPrice - min) / (max - min))
      rows.push({ label: 'Price position', score, display: `${score.toFixed(1)}/10` })
    }
  }
  if (!rows.length) return ''
  const n = (categoryProducts || []).length
  const bar = r => `<div style="display:grid;grid-template-columns:130px 1fr 56px;gap:10px;align-items:center;margin:0 0 8px;">
    <span style="font-size:13px;font-weight:600;color:#444;">${r.label}</span>
    <div style="background:#eee;border-radius:4px;height:10px;overflow:hidden;"><div style="background:#e8a020;height:10px;width:${Math.round(r.score * 10)}%;"></div></div>
    <span style="font-size:13px;font-weight:700;color:#333;text-align:right;">${r.display}</span>
  </div>`
  return `<div id="scorecard" style="background:#fafafa;border:1px solid #e8e8e8;border-radius:8px;padding:18px 22px;margin:24px 0;">
  <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1a1a1a;">PriceHawk Spec Score</p>
  ${rows.map(bar).join('\n  ')}
  <p style="margin:10px 0 0;font-size:12px;color:#888;line-height:1.5;">Scored against the ${n} ${cat}s in our tracker using documented specifications — not lab tests. Price position: a lower price scores higher.</p>
</div>`
}

// RTINGS-style chained comparison: nearest cheaper + nearest pricier rival with spec deltas
function howItStacksUp(product, categoryProducts, catLabel) {
  const myPrice = productPrice(product)
  if (myPrice == null) return ''
  const rivals = (categoryProducts || [])
    .filter(p => p !== product && productPrice(p) != null && (p.product_name || p._legacy?.name))
  if (!rivals.length) return ''

  const cheaper = rivals.filter(p => productPrice(p) < myPrice).sort((a, b) => productPrice(b) - productPrice(a))[0]
  const pricier = rivals.filter(p => productPrice(p) > myPrice).sort((a, b) => productPrice(a) - productPrice(b))[0]
  if (!cheaper && !pricier) return ''

  const myW = numSpec(product.specifications, ...WATT_KEYS)
  const myC = numSpec(product.specifications, ...CAP_KEYS)
  const diffLine = (rival, dir) => {
    const name = rival.product_name || rival._legacy?.name
    const w = numSpec(rival.specifications, ...WATT_KEYS)
    const c = numSpec(rival.specifications, ...CAP_KEYS)
    const deltas = []
    if (myW != null && w != null && w !== myW) deltas.push(w > myW ? `${w - myW}W more power` : `${myW - w}W less power`)
    if (myC != null && c != null && c !== myC) deltas.push(c > myC ? `${(c - myC).toFixed(1)}L more capacity` : `${(myC - c).toFixed(1)}L less capacity`)
    const deltaTxt = deltas.length ? deltas.join(', ') : 'a near-identical spec sheet'
    return `<li style="margin:0 0 8px;"><strong>${name}</strong> (${dir}) — offers ${deltaTxt}. Worth a look if that tradeoff suits you better.</li>`
  }

  const items = []
  if (cheaper) items.push(diffLine(cheaper, 'spends less'))
  if (pricier) items.push(diffLine(pricier, 'spends more'))
  return `<h2 id="stacks-up" style="font-size:20px;font-weight:700;margin:28px 0 10px;">How It Stacks Up Against Rivals</h2>
<ul style="font-size:14.5px;line-height:1.7;color:#333;margin:0;padding-left:20px;">
${items.join('\n')}
</ul>`
}

// Jump-link table of contents (RTINGS pattern)
function tocBlock(entries) {
  if (!entries?.length) return ''
  return `<nav style="background:#f8f9fa;border:1px solid #e8e8e8;border-radius:6px;padding:12px 18px;margin:0 0 20px;font-size:13px;">
  <span style="font-weight:700;color:#666;margin-right:10px;">Jump to:</span>
  ${entries.map(e => `<a href="#${e.id}" style="color:#e65100;text-decoration:none;font-weight:600;margin-right:14px;white-space:nowrap;">${e.label}</a>`).join('\n  ')}
</nav>`
}

// Full site shell for generated posts — matches the homepage design system
// (public/site/shared.jsx PHHeader/PHFooter + ph-home chrome-hiding CSS).
// Dark site frame, static header/nav/footer, light 1200px reading card for the article.
function postShell(articleHtml) {
  const LOGO = 'https://pricehawk.in/wp-content/uploads/2026/06/pricehawk-logo.png'
  const NAV = [['Guides', '/buying-guide/'], ['Compare', '/comparison/'], ['Deals', '/deals/'], ['Price Drops', '/price-drops/'], ['Categories', '/categories/']]
  return `<!-- wp:html {"align":"full"} -->
<style>
body{background:#0f0f0f!important}
.site-header,.site-footer,header.site-header,footer.site-footer,
#masthead,#colophon,.wp-block-template-part,.navigation,.post-navigation,
.entry-header,.entry-footer,.comments-area,.sidebar,#secondary,
.wp-block-post-title,.wp-block-post-featured-image,.wp-block-post-author,
.wp-block-post-date,.wp-block-post-terms,.wp-block-comments{display:none!important}
.entry-content,.wp-block-post-content,.site-content,#content,.page-content,
.hentry,.wp-site-blocks{max-width:100%!important;margin:0!important;padding:0!important;background:#0f0f0f!important}
main.wp-block-group,main.wp-block-group-is-layout-constrained{margin-top:0!important;padding-top:0!important}
.wp-block-group.has-global-padding,.wp-block-group.is-layout-constrained{padding-top:0!important;margin-top:0!important}
.wp-block-html,.wp-block-html.alignfull{max-width:100%!important;width:100%!important}
.entry-content.has-global-padding>*,.is-layout-constrained>*,.entry-content>*{max-width:none!important}
.has-global-padding>*{max-width:none!important;--wp--style--global--content-size:100%!important;--wp--style--global--wide-size:100%!important}
.ph-post-hdr a:hover{color:#e67e22!important}
@media (max-width:768px){.ph-post-nav{display:none!important}.ph-post-article{padding:20px 16px!important;border-radius:0!important}}
</style>
<div style="background:#0f0f0f;min-height:100vh;font-family:'Inter',system-ui,sans-serif;">
<header class="ph-post-hdr" style="position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:32px;padding:14px 40px;border-bottom:1px solid #2a2a2a;background:rgba(15,15,15,0.92);backdrop-filter:blur(10px);">
  <a href="/"><img src="${LOGO}" alt="PriceHawk" style="height:30px;width:auto;display:block;"></a>
  <nav class="ph-post-nav" style="display:flex;gap:22px;font-size:13px;font-weight:500;font-family:'JetBrains Mono',ui-monospace,monospace;">
    ${NAV.map(([label, href]) => `<a href="${href}" style="color:#888;text-decoration:none;">${label}</a>`).join('\n    ')}
  </nav>
  <div style="margin-left:auto;display:flex;align-items:center;gap:12px;">
    <a href="/price-drops/" style="padding:8px 14px;font-size:13px;border-radius:6px;border:1px solid rgba(230,126,34,0.55);color:#e67e22;text-decoration:none;font-weight:600;">Alerts</a>
  </div>
</header>
<div style="max-width:1200px;margin:28px auto 0;padding:0 20px;box-sizing:border-box;">
<article class="ph-post-article" style="background:#ffffff;border-radius:12px;padding:36px 44px;box-sizing:border-box;color:#333;">
${articleHtml}
</article>
</div>
<footer style="border-top:1px solid #2a2a2a;padding:32px 40px;margin-top:48px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:18px;">
  <div style="display:flex;align-items:center;gap:18px;">
    <a href="/"><img src="${LOGO}" alt="PriceHawk" style="height:24px;width:auto;display:block;"></a>
    <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#5f5f5f;">Find the Best Price. Every Time.</span>
  </div>
  <div style="display:flex;gap:22px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;">
    <a href="/about/" style="color:#888;text-decoration:none;">About</a>
    <a href="/editorial-policy/" style="color:#888;text-decoration:none;">Editorial Policy</a>
    <a href="/privacy-policy/" style="color:#888;text-decoration:none;">Privacy</a>
    <a href="/terms-of-service/" style="color:#888;text-decoration:none;">Terms</a>
    <a href="/affiliate-disclosure/" style="color:#888;text-decoration:none;">Disclosure</a>
    <a href="/contact/" style="color:#888;text-decoration:none;">Contact</a>
  </div>
  <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#5f5f5f;flex-basis:100%;">
    PriceHawk earns a commission on purchases. This never affects our editorial recommendations.
  </div>
</footer>
</div>
<!-- /wp:html -->`
}

// Specifications hidden in a closed accordion — keeps the page clean
// without losing the data. Opens on click. id="specs" anchors the TOC link.
function specsAccordion(specsHTML, label = 'Full Specifications') {
  if (!specsHTML) return ''
  return `<details id="specs" style="border:1px solid #e0e0e0;border-radius:6px;margin:28px 0;">
  <summary style="padding:14px 20px;cursor:pointer;font-size:16px;font-weight:700;color:#1a1a1a;background:#fafafa;border-radius:6px;user-select:none;display:flex;justify-content:space-between;align-items:center;">
    ${label}<span style="font-size:12px;color:#999;font-weight:400;">click to expand</span>
  </summary>
  <div style="padding:16px 20px;border-top:1px solid #e0e0e0;">
    ${specsHTML}
  </div>
</details>`
}

module.exports = {
  prosConsFromSpecs, verdictBox, updatedLine, prosConsBlock, median,
  wideShell, specScorecard, howItStacksUp, tocBlock, postShell, specsAccordion,
}
