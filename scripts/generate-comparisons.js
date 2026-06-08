// scripts/generate-comparisons.js
require('dotenv').config()
const fs   = require('fs')
const path = require('path')

const { makeAuth, wpUpsertPage } = require('./lib/wp')
const {
  resolveOffer, specTable, asciDisclosure,
  methodologyBlock, loadProducts, getSpecVal,
  buildSlugIndex, relatedLinks,
} = require('./lib/content')
const { comparisonSchema, slugify } = require('./lib/schema')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD
const TAG  = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'
const AUTH = makeAuth(USER, PASS)

const PRODS_DIR  = path.join(__dirname, '../data/products')
const QUEUE_FILE = path.join(__dirname, '../data/content/phase1_queue.json')
const YEAR = new Date().getFullYear()

const KITCHEN = ['air-fryers','mixer-grinders','coffee-machines','induction-cooktops',
                 'electric-kettles','food-processors','hand-blenders','sandwich-makers','rice-cookers']

const CAT_LABELS = {
  'air-fryers':'Air Fryer','mixer-grinders':'Mixer Grinder','coffee-machines':'Coffee Machine',
  'induction-cooktops':'Induction Cooktop','electric-kettles':'Electric Kettle',
  'food-processors':'Food Processor','hand-blenders':'Hand Blender',
  'sandwich-makers':'Sandwich Maker','rice-cookers':'Rice Cooker',
}

const CAT_FAQS = {
  'air-fryers': [
    ['Should I choose larger or smaller capacity?', 'For 1–2 people, a 2–3L basket is adequate and heats up faster. For a family of 4, a 4–6L model is the practical choice. Larger does not always mean better — oversized baskets can distribute heat unevenly for small portions.'],
    ['Do all air fryers perform equally at the same wattage?', 'No. Wattage determines maximum heat output, but heating element design, fan placement, and basket construction affect actual cooking performance.'],
  ],
  'mixer-grinders': [
    ['Is there a performance difference between models at similar wattage?', 'Yes. Motor quality, jar shape, and blade design vary significantly even at the same wattage. Indian brands engineered for wet grinding differ even at identical wattages.'],
    ['How long do mixer grinders typically last?', 'With normal use (1–2 sessions daily), a quality mixer grinder should last 5–8 years. Motor overheating from continuous long-duration use is the primary cause of premature failure.'],
  ],
  'coffee-machines': [
    ['Is quality difference noticeable between models?', 'For basic drip coffee, differences are minor. For espresso, pressure and temperature stability matter — higher-end models extract better crema.'],
    ['What ongoing costs should I factor in?', 'Pod costs (₹40–80 each) add up versus ground coffee (₹15–25 per cup). Descaling tablets (₹150–300) are needed every 1–3 months.'],
  ],
  'induction-cooktops': [
    ['Does wattage matter for induction?', '1200–1500W suits smaller vessels. 1800–2000W brings larger vessels to boil faster. The gap is noticeable for large-batch cooking.'],
    ['Which brand has better after-sales service in India?', 'Philips, Havells, and Bajaj have broad service networks. For tier-2/3 cities, established Indian brands often have faster turnaround.'],
  ],
  'electric-kettles': [
    ['Real difference between ₹600 and ₹1,500 kettle?', 'Yes — primarily interior material (stainless vs plastic), keep-warm function, and build longevity. The stainless interior is worth the difference for daily use.'],
    ['How often to descale?', 'Monthly in hard water cities (Delhi, Bengaluru, Mumbai). Limestone build-up reduces heating efficiency and affects taste.'],
  ],
  'food-processors': [
    ['Can one replace the other — food processor vs mixer grinder?', 'Partially. A food processor handles solid prep better. A mixer grinder handles wet grinding better. Both have distinct roles in Indian kitchens.'],
    ['Most useful attachments for Indian cooking?', 'Slicing and chopping discs for vegetables. A dough blade for roti dough. Fine grater for coconut.'],
  ],
  'hand-blenders': [
    ['Can I use a hand blender for hot soups?', 'Yes — submerge the head fully, use a tall container to prevent splatter, and start at low speed.'],
    ['Is higher-wattage noticeably better?', 'For smoothies and soups, 300–400W is adequate. For crushing ice or extended use, 600W+ makes a real difference.'],
  ],
  'sandwich-makers': [
    ['Are removable plates worth the higher cost?', 'For cleaning ease: yes, significantly. For versatility (grill + waffle): yes if you use both. For basic daily sandwiches: fixed plates are equally effective.'],
    ['How to extend the life of a sandwich maker?', 'Wipe plates while still warm — residue is much easier to remove at this stage. Avoid metal utensils on non-stick surfaces.'],
  ],
  'rice-cookers': [
    ['Is a rice cooker worth buying with a pressure cooker?', 'Different use cases. A rice cooker delivers perfectly consistent results without monitoring. A pressure cooker is faster for combined dal+rice cooking.'],
    ['What capacity is right?', '1–1.5L for 1–2 people. 1.8L for 3–4 people. 2.8L+ for families of 5–6.'],
  ],
}

function titleCase(s) {
  return (s || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function shortName(name, maxLen = 50) {
  const clean = (name || '').replace(/\s*[\\|,].*$/, '').trim()
  return clean.length > maxLen ? clean.substring(0, maxLen - 1) + '…' : clean
}

function buildPickDecisions(p1, p2, specs1, specs2) {
  const seg1 = p1.price_segment || p1._legacy?.price_segment || 'mid-range'
  const seg2 = p2.price_segment || p2._legacy?.price_segment || 'mid-range'
  const reasons1 = []
  const reasons2 = []

  const w1 = parseFloat((getSpecVal(specs1, 'Output Wattage', 'Wattage', 'Wattage Rating') || '').replace(/[^0-9.]/g, ''))
  const w2 = parseFloat((getSpecVal(specs2, 'Output Wattage', 'Wattage', 'Wattage Rating') || '').replace(/[^0-9.]/g, ''))
  if (!isNaN(w1) && !isNaN(w2) && w1 !== w2) {
    const wHighReasons = w1 > w2 ? reasons1 : reasons2
    const wHighVal = w1 > w2 ? getSpecVal(specs1, 'Output Wattage', 'Wattage') : getSpecVal(specs2, 'Output Wattage', 'Wattage')
    wHighReasons.push(`higher power (${wHighVal}) — faster preheat, better performance for larger batches`)
  }

  const c1 = parseFloat((getSpecVal(specs1, 'Capacity', 'Volume', 'Bowl Capacity') || '').replace(/[^0-9.]/g, ''))
  const c2 = parseFloat((getSpecVal(specs2, 'Capacity', 'Volume', 'Bowl Capacity') || '').replace(/[^0-9.]/g, ''))
  if (!isNaN(c1) && !isNaN(c2) && c1 !== c2) {
    const cHighReasons = c1 > c2 ? reasons1 : reasons2
    const cHighVal = c1 > c2 ? getSpecVal(specs1, 'Capacity', 'Volume') : getSpecVal(specs2, 'Capacity', 'Volume')
    cHighReasons.push(`larger capacity (${cHighVal}) — better for bigger families`)
    const cLowReasons = c1 < c2 ? reasons1 : reasons2
    cLowReasons.push('more compact — quicker to heat for smaller portions')
  }

  const segOrder = ['budget', 'mid-range', 'premium', 'flagship']
  const si1 = segOrder.indexOf(seg1)
  const si2 = segOrder.indexOf(seg2)
  if (si1 !== si2) {
    if (si1 < si2) { reasons1.push('more budget-friendly'); reasons2.push('more premium build and features') }
    else { reasons2.push('more budget-friendly'); reasons1.push('more premium build and features') }
  }

  if (!reasons1.length) reasons1.push('its specific combination of specifications matches your primary requirement')
  if (!reasons2.length) reasons2.push('its specific combination of specifications matches your primary requirement')

  return { reasons1, reasons2 }
}

function buildComparisonHTML(p1, p2, catSlug, slugIndex = {}) {
  const name1  = p1.product_name || p1._legacy?.name || 'Product 1'
  const name2  = p2.product_name || p2._legacy?.name || 'Product 2'
  const brand1 = titleCase(p1.brand_id || '')
  const brand2 = titleCase(p2.brand_id || '')
  const short1 = shortName(name1)
  const short2 = shortName(name2)
  const offer1 = resolveOffer(p1)
  const offer2 = resolveOffer(p2)
  const link1  = offer1.affiliate_url || `https://www.amazon.in/dp/${offer1.external_id || p1._legacy?.asin}?tag=${TAG}`
  const link2  = offer2.affiliate_url || `https://www.amazon.in/dp/${offer2.external_id || p2._legacy?.asin}?tag=${TAG}`
  const asin1  = offer1.external_id || p1._legacy?.asin || ''
  const asin2  = offer2.external_id || p2._legacy?.asin || ''
  const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
  const faqs   = CAT_FAQS[catSlug] || []
  const specs1 = p1.specifications || {}
  const specs2 = p2.specifications || {}

  const allKeys = [...new Set([
    ...Object.keys(specs1).filter(k => !k.startsWith('_')),
    ...Object.keys(specs2).filter(k => !k.startsWith('_')),
  ])]

  const specRowsHTML = allKeys.length
    ? allKeys.map(k => `  <tr style="border-bottom:1px solid #e8e8e8;">
    <td style="padding:8px 12px;color:#666;font-weight:600;font-size:13px;width:25%;">${k}</td>
    <td style="padding:8px 12px;font-size:13px;width:37.5%;${specs1[k] ? '' : 'color:#bbb;'}">${specs1[k] || '—'}</td>
    <td style="padding:8px 12px;font-size:13px;width:37.5%;${specs2[k] ? '' : 'color:#bbb;'}">${specs2[k] || '—'}</td>
  </tr>`).join('\n')
    : `  <tr><td colspan="3" style="padding:12px;color:#999;font-size:13px;">Refer to Amazon product pages for full specifications.</td></tr>`

  const { reasons1, reasons2 } = buildPickDecisions(p1, p2, specs1, specs2)
  const slug = `compare-${slugify(brand1)}-${asin1.toLowerCase()}-vs-${slugify(brand2)}-${asin2.toLowerCase()}`
  const schema = comparisonSchema({ name1: short1, name2: short2, catLabel, catSlug, link1, link2, faqs, slug })

  const methodCtx = `This comparison is based on published specifications for the ${short1} and ${short2}, competitive positioning within each product's price segment, and aggregated user experience from public reviews.`

  return `${asciDisclosure()}

<nav style="font-size:13px;color:#888;margin-bottom:20px;">
<a href="/" style="color:#666;">Home</a> › <a href="/best-${catSlug}/" style="color:#666;">Best ${catLabel}s in India ${YEAR}</a> › Comparison
</nav>

<p style="font-size:16px;line-height:1.7;color:#333;">
Choosing between the <strong>${short1}</strong> and the <strong>${short2}</strong>?
This comparison breaks down the key specification differences to help you decide which is the better fit.
</p>

<div style="display:flex;gap:16px;margin:24px 0;flex-wrap:wrap;">
  <div style="flex:1;min-width:220px;border:1px solid #e0e0e0;border-radius:6px;padding:16px;">
    <p style="font-size:12px;color:#888;font-weight:700;text-transform:uppercase;margin:0 0 6px;">${brand1}</p>
    <p style="font-size:15px;font-weight:700;margin:0 0 14px;line-height:1.4;">${short1}</p>
    <a href="${link1}" target="_blank" rel="nofollow sponsored noopener"
       style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
      Check price on Amazon →
    </a>
  </div>
  <div style="flex:1;min-width:220px;border:1px solid #e0e0e0;border-radius:6px;padding:16px;">
    <p style="font-size:12px;color:#888;font-weight:700;text-transform:uppercase;margin:0 0 6px;">${brand2}</p>
    <p style="font-size:15px;font-weight:700;margin:0 0 14px;line-height:1.4;">${short2}</p>
    <a href="${link2}" target="_blank" rel="nofollow sponsored noopener"
       style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
      Check price on Amazon →
    </a>
  </div>
</div>

<h2 style="font-size:20px;font-weight:700;margin:28px 0 10px;">Specification Comparison</h2>
<div style="overflow-x:auto;">
<table style="width:100%;border-collapse:collapse;font-size:14px;">
  <thead>
    <tr style="background:#f5f5f5;">
      <th style="padding:10px 12px;text-align:left;font-weight:700;font-size:13px;color:#444;width:25%;">Specification</th>
      <th style="padding:10px 12px;text-align:left;font-weight:700;font-size:13px;color:#444;width:37.5%;">${short1.substring(0,35)}${short1.length>35?'…':''}</th>
      <th style="padding:10px 12px;text-align:left;font-weight:700;font-size:13px;color:#444;width:37.5%;">${short2.substring(0,35)}${short2.length>35?'…':''}</th>
    </tr>
  </thead>
  <tbody>
${specRowsHTML}
  </tbody>
</table>
</div>

<h2 style="font-size:20px;font-weight:700;margin:32px 0 12px;">Which One Should You Buy?</h2>

<div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:12px;">
  <p style="margin:0;font-size:14px;line-height:1.6;">
    <strong>Choose ${short1.substring(0,40)}${short1.length>40?'…':''}</strong> if you want:
    <ul style="margin:8px 0 0;padding-left:18px;">
      ${reasons1.map(r => `<li>${r}</li>`).join('\n      ')}
    </ul>
  </p>
</div>

<div style="background:#e3f2fd;border-left:4px solid #2196f3;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:24px;">
  <p style="margin:0;font-size:14px;line-height:1.6;">
    <strong>Choose ${short2.substring(0,40)}${short2.length>40?'…':''}</strong> if you want:
    <ul style="margin:8px 0 0;padding-left:18px;">
      ${reasons2.map(r => `<li>${r}</li>`).join('\n      ')}
    </ul>
  </p>
</div>

${methodologyBlock(methodCtx)}

<div style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:6px;padding:16px 20px;margin:24px 0;">
  <p style="margin:0 0 10px;font-weight:700;font-size:15px;">Check current prices on Amazon India:</p>
  <div style="display:flex;gap:12px;flex-wrap:wrap;">
    <a href="${link1}" target="_blank" rel="nofollow sponsored noopener"
       style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
      ${short1.substring(0,30)}${short1.length>30?'…':''} →
    </a>
    <a href="${link2}" target="_blank" rel="nofollow sponsored noopener"
       style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
      ${short2.substring(0,30)}${short2.length>30?'…':''} →
    </a>
  </div>
  <p style="margin:10px 0 0;font-size:12px;color:#999;">Amazon prices change frequently. Click to see current prices.</p>
</div>

${faqs.length ? `<h2 style="font-size:20px;font-weight:700;margin:32px 0 12px;">Frequently Asked Questions</h2>
${faqs.map(([q, a]) => `<details style="border:1px solid #e0e0e0;border-radius:4px;margin-bottom:8px;">
  <summary style="padding:12px 16px;cursor:pointer;font-weight:600;font-size:14px;background:#fafafa;">${q}</summary>
  <div style="padding:12px 16px;font-size:14px;line-height:1.7;color:#333;">${a}</div>
</details>`).join('\n')}` : ''}

${relatedLinks(asin1, catSlug, slugIndex, catLabel)}

<hr style="margin:32px 0;border:none;border-top:1px solid #e0e0e0;">
<p style="font-size:13px;color:#888;">
  <a href="/best-${catSlug}/" style="color:#e65100;font-weight:600;">← See all ${catLabel}s compared in India ${YEAR}</a>
</p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
</script>`
}

async function main() {
  const args      = process.argv.slice(2)
  const dryRun    = args.includes('--dry-run')
  const catFilter = args.includes('--cat') ? args[args.indexOf('--cat') + 1] : null
  const limit     = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) || 9999 : 9999

  if (!WP || !USER || !PASS) { console.error('Missing WP credentials in .env'); process.exit(1) }
  if (!fs.existsSync(QUEUE_FILE)) { console.error('Run content-opportunity-engine.js first'); process.exit(1) }

  const productIndex = loadProducts(KITCHEN, PRODS_DIR)
  const slugIndex = buildSlugIndex(JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')))
  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))
    .filter(o => o.type === 'comparison')
    .filter(o => !catFilter || o.category === catFilter)
    .slice(0, limit)

  console.log(`Comparison queue: ${queue.length} items`)
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 }

  for (const op of queue) {
    const [asin1, asin2] = op.asins || []
    if (!asin1 || !asin2) { stats.skipped++; continue }
    const p1 = productIndex[asin1]
    const p2 = productIndex[asin2]
    if (!p1 || !p2) {
      console.log(`  skip ${asin1}+${asin2} — one or both not in product index`)
      stats.skipped++; continue
    }

    const brand1  = slugify(p1.brand_id || 'product')
    const brand2  = slugify(p2.brand_id || 'product')
    const catSlug = op.category
    const slug    = `compare-${brand1}-${asin1.toLowerCase()}-vs-${brand2}-${asin2.toLowerCase()}`
    const name1   = shortName(p1.product_name || p1._legacy?.name || '', 40)
    const name2   = shortName(p2.product_name || p2._legacy?.name || '', 40)
    const title   = `${name1} vs ${name2} — Which Is Better for Indian Homes?`

    try {
      const html   = buildComparisonHTML(p1, p2, catSlug, slugIndex)
      const result = await wpUpsertPage({ title, slug, content: html }, { wp: WP, auth: AUTH, dryRun })
      if (result) {
        console.log(`  ✓ [${result.action}] ${catSlug} | ${name1.substring(0,30)} vs ${name2.substring(0,30)}`)
        result.action === 'created' ? stats.created++ : stats.updated++
      }
    } catch (e) {
      console.error(`  ✗ ${asin1}+${asin2}: ${e.message}`)
      stats.errors++
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n── DONE ────────────────────────`)
  console.log(`Created: ${stats.created} | Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`)
  if (dryRun) console.log('(dry run — no WP changes)')
}

main().catch(e => { console.error(e.message); process.exit(1) })
