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
  return `<div style="background:rgba(230,126,34,0.07);border:1px solid rgba(230,126,34,0.28);border-left:4px solid #e67e22;border-radius:0 6px 6px 0;padding:16px 20px;margin:0 0 20px;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#e67e22;font-family:'JetBrains Mono',ui-monospace,monospace;">PriceHawk verdict · ${segLabel}</p>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#c8c8c8;">${frame(name, whoFor, keyStrength)} The full reasoning, specs and honest gaps are below.</p>
  <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#e67e22;color:#140a02;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
    Check today's price on Amazon →
  </a>
</div>`
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Recency signal — honest: specs reviewed at generation time, price genuinely tracked daily
function updatedLine(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return `<p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#5f5f5f;margin:0 0 16px;letter-spacing:0.02em;">Specs reviewed ${MONTHS[d.getMonth()]} ${d.getFullYear()} · Amazon price tracked daily by PriceHawk</p>`
}

// Two-column pros / falls-short block. Renders only sides that have content.
function prosConsBlock(pros, cons) {
  if (!pros.length && !cons.length) return ''
  const col = (title, items, color, bg) => items.length ? `<div style="flex:1;min-width:240px;background:${bg};border-radius:6px;padding:14px 18px;border:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${color};">${title}</p>
    <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:#c8c8c8;">
      ${items.map(i => `<li>${i}</li>`).join('\n      ')}
    </ul>
  </div>` : ''
  return `<h2 id="pros-cons" style="font-size:20px;font-weight:700;margin:28px 0 10px;color:#f0f0f0;">The Good and the Not-So-Good</h2>
<div style="display:flex;gap:14px;flex-wrap:wrap;margin:0 0 8px;">
  ${col('What works in its favour', pros, '#4ade80', 'rgba(39,174,96,0.12)')}
  ${col('Where it falls short', cons, '#f87171', 'rgba(231,76,60,0.12)')}
</div>`
}

// Full-bleed breakout from the theme's narrow post column (RTINGS/Wirecutter are wide).
// Outer div spans the viewport; inner recenters at a readable wide max.
function wideShell(innerHtml) {
  return `<div style="width:100vw;position:relative;left:calc(50% - 50vw);">
<div style="max-width:none;margin:0 auto;padding:0 40px;box-sizing:border-box;">
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
    <span style="font-size:13px;font-weight:600;color:#c8c8c8;">${r.label}</span>
    <div style="background:#2a2a2a;border-radius:4px;height:10px;overflow:hidden;"><div style="background:#e67e22;height:10px;width:${Math.round(r.score * 10)}%;"></div></div>
    <span style="font-size:13px;font-weight:700;color:#f0f0f0;text-align:right;">${r.display}</span>
  </div>`
  return `<div id="scorecard" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:18px 22px;margin:24px 0;">
  <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#f0f0f0;">PriceHawk Spec Score</p>
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
  return `<h2 id="stacks-up" style="font-size:20px;font-weight:700;margin:28px 0 10px;color:#f0f0f0;">How It Stacks Up Against Rivals</h2>
<ul style="font-size:14.5px;line-height:1.7;color:#c8c8c8;margin:0;padding-left:20px;">
${items.join('\n')}
</ul>`
}

// Jump-link table of contents (RTINGS pattern)
function tocBlock(entries) {
  if (!entries?.length) return ''
  return `<nav style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:12px 18px;margin:0 0 20px;font-size:13px;font-family:'JetBrains Mono',ui-monospace,monospace;">
  <span style="font-weight:700;color:#888;margin-right:10px;">Jump to:</span>
  ${entries.map(e => `<a href="#${e.id}" style="color:#e67e22;text-decoration:none;font-weight:600;margin-right:14px;white-space:nowrap;">${e.label}</a>`).join('\n  ')}
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
@media (max-width:768px){.ph-post-nav{display:none!important}.ph-post-wrap{padding:0!important}.ph-post-article{padding:20px 16px!important;border-radius:0!important}}
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
<div class="ph-post-wrap" style="max-width:1440px;margin:0 auto;padding:0 40px 60px;box-sizing:border-box;">
<article class="ph-post-article" style="background:transparent;padding:36px 0;box-sizing:border-box;color:#f0f0f0;font-family:'Inter',system-ui,sans-serif;line-height:1.7;">
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
  return `<details id="specs" style="border:1px solid #2a2a2a;border-radius:6px;margin:28px 0;background:#1a1a1a;">
  <summary style="padding:14px 20px;cursor:pointer;font-size:16px;font-weight:700;color:#f0f0f0;background:#1a1a1a;border-radius:6px;user-select:none;display:flex;justify-content:space-between;align-items:center;">
    ${label}<span style="font-size:12px;color:#5f5f5f;font-weight:400;">click to expand</span>
  </summary>
  <div style="padding:16px 20px;border-top:1px solid #2a2a2a;color:#c8c8c8;">
    ${specsHTML}
  </div>
</details>`
}

const TG_URL = process.env.TELEGRAM_CHANNEL_URL || 'https://t.me/pricehawkdeals'

function telegramCTA() {
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #27ae60;border-radius:0 6px 6px 0;padding:14px 20px;margin:24px 0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
  <div style="flex:1;min-width:180px;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#27ae60;font-family:'JetBrains Mono',ui-monospace,monospace;">Get deal alerts on Telegram</p>
    <p style="margin:4px 0 0;font-size:13px;color:#888;">We post genuine price drops on kitchen appliances — no spam, deals only.</p>
  </div>
  <a href="${TG_URL}" target="_blank" rel="nofollow noopener"
     style="display:inline-block;background:#e67e22;color:#140a02;text-decoration:none;font-size:13px;font-weight:700;padding:9px 18px;border-radius:4px;white-space:nowrap;">
    Join PriceHawk Deals →
  </a>
</div>`
}

// Strip Amazon mobile UI boilerplate from scraped review text
function _cleanReviewText(text) {
  if (!text) return ''
  return text
    .replace(/Brief content visible, double tap to read full content\.\n?/gi, '')
    .replace(/Full content visible, double tap to read brief content\.\n?/gi, '')
    .replace(/Read more\s*Read less\n?.*/si, '')
    .replace(/\d+ people? found this.*/si, '')
    .trim()
}

// Filter junk from feature_highlights (URLs, raw platform strings, short fragments)
function _cleanHighlights(arr) {
  if (!Array.isArray(arr)) return []
  return arr.filter(s => {
    if (typeof s !== 'string') return false
    if (s.includes('http') || s.includes('display.html') || s.includes('nodeId')) return false
    if (s.includes('.jpg') || s.includes('.png') || s.includes('Cameras,')) return false
    // Keep if it reads like a real sentence: spaces, no raw HTML, >20 chars, starts with capital/number/quote
    const clean = s.trim()
    return clean.length >= 20 && /^[A-Z0-9"']/.test(clean) && !/\d+ positive\d+ negative/.test(clean)
  }).slice(0, 3)
}

// Build 2-3 sentence sentiment summary from structured review data
function _buildSentimentSummary(dist, rating, reviewCount, sentimentScore, pos, crit, highlights) {
  const total = (dist['5_star']||0)+(dist['4_star']||0)+(dist['3_star']||0)+(dist['2_star']||0)+(dist['1_star']||0)
  const positivePct = total ? Math.round(((dist['5_star']||0)+(dist['4_star']||0))/total*100) : null
  const criticalPct = total ? Math.round(((dist['1_star']||0)+(dist['2_star']||0))/total*100) : null
  const sentences = []

  // Sentence 1: overall verdict
  if (rating && reviewCount && positivePct != null) {
    const verdict = positivePct >= 85 ? 'strongly positive' : positivePct >= 70 ? 'generally positive' : 'mixed'
    sentences.push(`${positivePct}% of the ${Number(reviewCount).toLocaleString()} Indian buyers rate it 4 or 5 stars, putting the overall consensus firmly in ${verdict} territory.`)
  }

  // Sentence 2: what buyers liked (from highlights or positive review)
  const hl = highlights[0]
  const posText = _cleanReviewText(pos?.text || '')
  if (hl) {
    sentences.push(hl.charAt(0).toUpperCase() + hl.slice(1).replace(/\.$/, '') + '.')
  } else if (posText) {
    const snippet = posText.split('.')[0].trim()
    if (snippet.length > 20 && snippet.length < 160) sentences.push(snippet + '.')
  }

  // Sentence 3: concern or confidence note
  if (crit && criticalPct != null && criticalPct > 3) {
    const critText = _cleanReviewText(crit.text || '')
    const concern = critText.split('.')[0].trim()
    if (concern.length > 20 && concern.length < 160) {
      sentences.push(`The main concern raised by a minority (${criticalPct}%): ${concern.charAt(0).toLowerCase() + concern.slice(1)}.`)
    }
  } else if (sentimentScore != null && sentimentScore >= 8) {
    sentences.push(`At a sentiment score of ${sentimentScore}/10, negative feedback is limited — mostly outlier service issues rather than product faults.`)
  }

  return sentences.slice(0, 3).join(' ')
}

function reviewsBlock(reviews, rating, reviewCount) {
  if (!reviews) return ''
  const dist = reviews.star_distribution || {}
  const total = (dist['5_star']||0)+(dist['4_star']||0)+(dist['3_star']||0)+(dist['2_star']||0)+(dist['1_star']||0)
  const sentimentScore = reviews.sentiment_score
  const highlights = _cleanHighlights(reviews.feature_highlights)
  const pos = reviews.top_positive
  const crit = reviews.top_critical

  const starBars = [5,4,3,2,1].map(n => {
    const count = dist[`${n}_star`] || 0
    const pct = total ? Math.round((count / total) * 100) : 0
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
  <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#888;width:16px;text-align:right;">${n}★</span>
  <div style="flex:1;height:6px;background:#2a2a2a;border-radius:3px;overflow:hidden;">
    <div style="height:100%;width:${pct}%;background:${pct>=50?'#e67e22':'#5f5f5f'};border-radius:3px;"></div>
  </div>
  <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#5f5f5f;width:28px;">${pct}%</span>
</div>`
  }).join('\n')

  const scoreChip = sentimentScore != null
    ? `<span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;background:rgba(39,174,96,0.15);color:#4ade80;border:1px solid rgba(39,174,96,0.3);">Sentiment ${sentimentScore}/10</span>`
    : ''

  const highlightList = highlights.length
    ? `<ul style="margin:10px 0 0;padding-left:18px;font-size:13.5px;color:#c8c8c8;line-height:1.8;">
${highlights.map(h => `  <li>${h}</li>`).join('\n')}
</ul>` : ''

  function reviewCard(rv, isPositive) {
    if (!rv) return ''
    const text = _cleanReviewText(rv.text)
    if (!text) return ''
    const short = text.length > 280 ? text.substring(0, 277) + '…' : text
    const accentColor = isPositive ? '#4ade80' : '#f87171'
    const bgColor = isPositive ? 'rgba(39,174,96,0.06)' : 'rgba(231,76,60,0.06)'
    const borderColor = isPositive ? 'rgba(39,174,96,0.2)' : 'rgba(231,76,60,0.2)'
    const label = isPositive ? 'Top Positive Review' : 'Critical Review'
    const stars = '★'.repeat(rv.rating || 0) + '☆'.repeat(5 - (rv.rating || 0))
    return `<div style="background:${bgColor};border:1px solid ${borderColor};border-radius:6px;padding:14px 16px;flex:1;min-width:0;">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
    <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:0.07em;">${label}</span>
    <span style="font-size:12px;color:#e67e22;letter-spacing:1px;">${stars}</span>
    <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:#5f5f5f;">${rv.reviewer || ''}${rv.date ? ' · ' + rv.date : ''}</span>
  </div>
  <p style="font-size:13.5px;line-height:1.7;color:#c8c8c8;margin:0;">"${short}"</p>
</div>`
  }

  const posCard = reviewCard(pos, true)
  const critCard = reviewCard(crit, false)
  const cardsRow = (posCard || critCard)
    ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px;">${posCard}${critCard}</div>`
    : ''

  const ratingStr = rating ? `<span style="font-size:28px;font-weight:800;color:#f0f0f0;font-family:'JetBrains Mono',ui-monospace,monospace;">${rating}</span><span style="font-size:14px;color:#888;"> / 5</span>` : ''
  const countStr = reviewCount ? `<span style="font-size:12px;color:#5f5f5f;font-family:'JetBrains Mono',ui-monospace,monospace;">&nbsp;(${Number(reviewCount).toLocaleString()} ratings)</span>` : ''
  const sentimentSummary = _buildSentimentSummary(dist, rating, reviewCount, sentimentScore, pos, crit, highlights)

  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px 24px;margin:28px 0;">
<h2 style="font-size:17px;font-weight:700;color:#f0f0f0;margin:0 0 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
  What Amazon Reviewers Say
  ${scoreChip}
</h2>
${sentimentSummary ? `<p style="font-size:14px;line-height:1.75;color:#c8c8c8;margin:0 0 18px;border-left:3px solid rgba(230,126,34,0.4);padding-left:14px;">${sentimentSummary}</p>` : ''}
<div style="display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start;">
  <div style="min-width:160px;">
    <div style="margin-bottom:10px;">${ratingStr}${countStr}</div>
    ${starBars}
  </div>
  <div style="flex:1;min-width:180px;">
    <p style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.06em;font-family:'JetBrains Mono',ui-monospace,monospace;margin:0 0 4px;">What buyers highlight</p>
    ${highlightList || '<p style="font-size:13px;color:#5f5f5f;margin:8px 0 0;">No highlights available.</p>'}
  </div>
</div>
${cardsRow}
<p style="font-size:11px;color:#5f5f5f;margin:12px 0 0;font-family:'JetBrains Mono',ui-monospace,monospace;">Based on Amazon India customer reviews. PriceHawk has not independently verified these claims.</p>
</div>`
}

// Horizontal image gallery — uses _legacy.images[] when available, else main img
function productImageGallery(product) {
  const images = product._legacy?.images
  const mainImg = product._legacy?.img
  const name = product.product_name || product._legacy?.name || 'Product'

  const imgs = Array.isArray(images) && images.length > 1 ? images : (mainImg ? [mainImg] : [])
  if (imgs.length < 2) return ''

  const thumbs = imgs.map((src, i) => `<div style="flex:0 0 auto;width:160px;height:160px;background:#141414;border:1px solid #2a2a2a;border-radius:6px;overflow:hidden;cursor:pointer;">
  <img src="${src}" alt="${name} — view ${i+1}" loading="lazy" style="width:100%;height:100%;object-fit:contain;padding:8px;box-sizing:border-box;">
</div>`).join('\n')

  return `<div style="margin:28px 0;">
<h2 style="font-size:17px;font-weight:700;color:#f0f0f0;margin:0 0 14px;">Product Gallery</h2>
<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;scrollbar-width:thin;scrollbar-color:#2a2a2a #0f0f0f;">
${thumbs}
</div>
</div>`
}

module.exports = {
  prosConsFromSpecs, verdictBox, updatedLine, prosConsBlock, median,
  wideShell, specScorecard, howItStacksUp, tocBlock, postShell, specsAccordion,
  telegramCTA, reviewsBlock, productImageGallery,
}
