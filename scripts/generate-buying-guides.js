// scripts/generate-buying-guides.js
require('dotenv').config()
const fs   = require('fs')
const path = require('path')

const { makeAuth, wpUpsertPage } = require('./lib/wp')
const {
  resolveOffer, asciDisclosure, loadProducts, getSpecVal, sparklineSVG,
  topValueProduct, metaDescription,
} = require('./lib/content')
const { guideSchema, slugify } = require('./lib/schema')
const { guideOpener, voiceLint } = require('./lib/voice')
const { postShell } = require('./lib/templates')
const {
  classifyPicks,
  buildPageStyles,
  buildQuickPicksTable,
  buildTrustSection,
  buildComparisonTable,
  buildProductRecommendation,
  buildLabsSection,
  buildBuyingGuideSection,
  buildAlternativesSection,
  buildFAQSection,
  buildFinalRecsSection,
  buildInternalLinksSection,
} = require('./lib/guide-content')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD
const TAG  = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'
const AUTH = makeAuth(USER, PASS)

const PRODS_DIR        = path.join(__dirname, '../data/products')
const QUEUE_FILE       = path.join(__dirname, '../data/content/phase1_queue.json')
const PRICE_SERIES_DIR = path.join(__dirname, '../data/price_series')
const YEAR = new Date().getFullYear()

const KITCHEN = ['air-fryers','mixer-grinders','coffee-machines','induction-cooktops',
                 'electric-kettles','food-processors','hand-blenders','sandwich-makers','rice-cookers']

const CAT_LABELS = {
  'air-fryers':'Air Fryers','mixer-grinders':'Mixer Grinders','coffee-machines':'Coffee Machines',
  'induction-cooktops':'Induction Cooktops','electric-kettles':'Electric Kettles',
  'food-processors':'Food Processors','hand-blenders':'Hand Blenders',
  'sandwich-makers':'Sandwich Makers','rice-cookers':'Rice Cookers',
}
const CAT_LABEL_SINGULAR = {
  'air-fryers':'air fryer','mixer-grinders':'mixer grinder','coffee-machines':'coffee machine',
  'induction-cooktops':'induction cooktop','electric-kettles':'electric kettle',
  'food-processors':'food processor','hand-blenders':'hand blender',
  'sandwich-makers':'sandwich maker','rice-cookers':'rice cooker',
}

const CAT_INTROS = {
  'air-fryers': 'Air fryers are India\'s fastest-growing kitchen appliance — delivering crispy results with significantly less oil than traditional frying. Whether you\'re making samosas, pakoras, or grilled chicken, the right air fryer transforms everyday cooking.',
  'mixer-grinders': 'A good mixer grinder is the backbone of an Indian kitchen. From idli batter to evening chutneys, the right one saves time and lasts years.',
  'coffee-machines': 'India\'s coffee culture has outgrown instant powder. A coffee machine delivers café-quality results at home and pays for itself within months compared to daily coffee shop visits.',
  'induction-cooktops': 'Induction cooktops offer precise temperature control, energy efficiency, and safety — no open flame, no gas leak risk. Ideal for Indian cooking styles.',
  'electric-kettles': 'Electric kettles boil water faster than any stovetop with lower energy consumption. Modern models with temperature control unlock pour-over coffee and green tea at their intended temperatures.',
  'food-processors': 'Food processors cut prep time dramatically — from grating coconut to kneading dough. A good processor handles tasks that would take 30 minutes by hand in under 5.',
  'hand-blenders': 'Hand blenders are the space-saving workhorse of the modern kitchen. Blend soups directly in the pot, make smoothies in the glass — minimal cleanup.',
  'sandwich-makers': 'Sandwich makers and grills go beyond sandwiches. The right one handles grilled cheese to paninis and Indian-style toast with even browning.',
  'rice-cookers': 'Electric rice cookers deliver perfectly cooked rice every time — no watching, no overflow, no burning. Set it, forget it, eat it.',
}

const CAT_BUYING_FACTORS = {
  'air-fryers': [
    { factor: 'Capacity', tip: 'A 2–3L basket suits 1–2 people. For a family of 4, choose 4–6L. Larger baskets take longer to heat up uniformly.' },
    { factor: 'Wattage', tip: 'Higher wattage (1500W+) preheats faster and maintains temperature better during use. Do not go below 1000W.' },
    { factor: 'Preset Programs', tip: 'Presets are convenient for beginners. Experienced cooks often prefer full manual control over temperature and time.' },
    { factor: 'Controls', tip: 'Digital touchscreen offers precision. Analog dials are simpler and often more durable over time.' },
  ],
  'mixer-grinders': [
    { factor: 'Wattage', tip: '500W handles light daily use. 750W suits families grinding idli/dosa batter regularly. Below 500W is insufficient for most Indian kitchens.' },
    { factor: 'Number of Jars', tip: '3 jars (dry, wet, chutney) covers most Indian cooking needs. A liquidising jar is useful for large families.' },
    { factor: 'Motor Warranty', tip: 'Look for a minimum 2-year motor warranty. Indian brands often offer 5-year motor warranties — a strong quality signal.' },
    { factor: 'Jar Material', tip: 'Stainless steel jars are more durable and do not stain. Polycarbonate jars are lighter but prone to cracking over time.' },
  ],
  'coffee-machines': [
    { factor: 'Coffee Type', tip: 'Drip: bulk coffee for multiple cups. Espresso: café-style shots. Capsule: convenience at a higher per-cup cost.' },
    { factor: 'Bar Pressure', tip: 'True espresso requires a minimum of 9 bar pump pressure. Lower pressure produces a weaker, less crema-rich shot.' },
    { factor: 'Milk Frother', tip: 'Required for cappuccinos and lattes. Budget machines typically omit this — factor in the cost if it matters to you.' },
    { factor: 'Descaling', tip: 'In hard-water cities, descale monthly. Choose models with a descaling indicator to avoid guesswork.' },
  ],
  'induction-cooktops': [
    { factor: 'Wattage', tip: '1200W handles everyday cooking. 1800–2000W boils water faster and handles deep frying better.' },
    { factor: 'Cookware Compatibility', tip: 'Only ferromagnetic cookware works — cast iron and magnetic stainless steel. Test with a magnet before purchasing.' },
    { factor: 'Presets', tip: 'Temperature presets for dal, milk, and chai save effort for repetitive daily cooking tasks.' },
    { factor: 'Safety Features', tip: 'Look for auto-shutoff, child lock, and overheating protection — essential for households with children.' },
  ],
  'electric-kettles': [
    { factor: 'Capacity', tip: '1L for 2–3 cups. 1.5–1.7L suits most households. 2L+ for larger families or offices.' },
    { factor: 'Interior Material', tip: 'Stainless steel interior is essential — no plastic taste, more hygienic, and easier to descale.' },
    { factor: 'Wattage', tip: '1500W boils 1 litre in ~3.5 minutes. 2200W cuts this to ~2 minutes. For most uses, the difference is negligible.' },
    { factor: 'Temperature Control', tip: 'Variable temperature matters only for green tea (75°C), white tea (70°C), or specialty pour-over coffee (93°C).' },
  ],
  'food-processors': [
    { factor: 'Wattage', tip: '600W handles most household tasks. 800–1000W for heavy continuous use like kneading dough or shredding hard vegetables.' },
    { factor: 'Bowl Capacity', tip: '1.5–2L suits 2–4 people. 3L+ for large families or batch cooking.' },
    { factor: 'Attachments', tip: 'Slicing disc, shredding disc, chopping blade, and dough blade cover 90% of use cases. Evaluate the included set carefully.' },
    { factor: 'Cleaning', tip: 'Wide-mouth bowls with dishwasher-safe parts save significant time. Narrow openings trap food residue.' },
  ],
  'hand-blenders': [
    { factor: 'Wattage', tip: '250–400W handles smoothies, soups, and baby food. 600W+ for tough ingredients like fibrous vegetables or frozen fruit.' },
    { factor: 'Speed Settings', tip: 'Variable speed gives better control across different textures. At minimum, ensure high and low speeds are available.' },
    { factor: 'Shaft Material', tip: 'Stainless steel shafts last significantly longer than plastic and are safe for hot liquids.' },
    { factor: 'Attachments', tip: 'A chopper bowl and whisk attachment expand functionality significantly for daily kitchen tasks.' },
  ],
  'sandwich-makers': [
    { factor: 'Plate Type', tip: 'Fixed triangular: basic sandwich only. Flat grill: paninis and vegetables. Removable plates: swap between modes — most versatile.' },
    { factor: 'Wattage', tip: '750–900W is standard. Higher wattage preheats faster, which matters when making multiple sandwiches consecutively.' },
    { factor: 'Non-Stick Coating', tip: 'Quality non-stick coating reduces need for butter, prevents sticking, and makes cleaning easier.' },
    { factor: 'Ready Indicator', tip: 'A ready indicator light signals when the maker has reached cooking temperature — avoids undercooked sandwiches.' },
  ],
  'rice-cookers': [
    { factor: 'Capacity', tip: '1L for 1–2 people. 1.8L is the standard Indian household size. 2.8L+ for larger families.' },
    { factor: 'Inner Pot Quality', tip: 'Non-stick coating prevents sticking. Thicker pots provide more even heat distribution across the base.' },
    { factor: 'Keep-Warm Function', tip: 'Auto keep-warm is essential for Indian households with staggered meal times — keeps rice fresh for 2–3 hours.' },
    { factor: 'Multi-Cook', tip: 'Multi-cook handles rice, dal, khichdi, and steam — worth it for daily use. Single-function models are limiting.' },
  ],
}

function titleCase(s) { return (s || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
function shortName(name, max = 50) {
  const c = (name || '').replace(/\s*[|,].*$/, '').trim()
  return c.length > max ? c.substring(0, max - 1) + '…' : c
}

function getProductsForCat(catSlug, productIndex, n = 6) {
  return Object.values(productIndex)
    .filter(p => p._catSlug === catSlug)
    .map(p => {
      const offer = resolveOffer(p)
      return { ...p, _price: offer.last_price || p._legacy?.current_price || 0 }
    })
    .sort((a, b) => {
      // Sort by popularity score for best display order
      const scoreA = parseFloat(a._legacy?.rating || '4') * Math.log1p(parseInt((String(a._legacy?.review_count || '0')).replace(/[^0-9]/g, '') || '0'))
      const scoreB = parseFloat(b._legacy?.rating || '4') * Math.log1p(parseInt((String(b._legacy?.review_count || '0')).replace(/[^0-9]/g, '') || '0'))
      return scoreB - scoreA
    })
    .slice(0, n)
}

function buildGuideHTML(products, catSlug, subtype, useCase) {
  const catLabel    = CAT_LABELS[catSlug] || titleCase(catSlug)
  const catSingular = CAT_LABEL_SINGULAR[catSlug] || catLabel.toLowerCase()
  const intro       = CAT_INTROS[catSlug] || `Find the best ${catSingular} for Indian homes.`
  const guideSlug   = `best-${catSlug}${useCase ? '-' + slugify(useCase) : ''}${subtype === 'budget' ? '-budget' : ''}`

  const topValue   = topValueProduct(products)
  const topValueId = topValue ? (topValue.product_id || null) : null
  const picks      = classifyPicks(products)

  // Section 1 – Quick Picks
  const s1 = buildQuickPicksTable(picks, catLabel, catSingular, TAG)

  // Diagnosis-style opener (problem first), then category context paragraph
  const introHTML = `${guideOpener(catLabel, catSingular, catSlug)}
<p style="font-size:16px;line-height:1.8;color:#333;margin:24px 0;">${intro}</p>`

  // Section 2 – Trust / Methodology
  const s2 = buildTrustSection(catLabel)

  // Section 3 – Comparison Table
  const s3 = buildComparisonTable(products, products)

  // Section 4 – Top Recommendations (individual deep-dives)
  const s4Header = `<h2 style="font-size:20px;font-weight:700;margin:36px 0 16px;">Top ${catLabel} Recommendations — Detailed Analysis</h2>`
  const s4Cards  = products.map((p, i) => buildProductRecommendation(p, catSlug, catSingular, i + 1, topValueId, products, TAG)).join('\n')

  // Section 5 – PriceHawk Labs
  const s5 = buildLabsSection(products, catSlug, catLabel)

  // Section 6 – Buying Guide
  const s6 = buildBuyingGuideSection(catSlug, catLabel, CAT_BUYING_FACTORS)

  // Section 7 – Alternatives
  const s7 = buildAlternativesSection(products, catSlug, catLabel, catSingular, TAG)

  // Section 8 – FAQ
  const s8 = buildFAQSection(catSlug, catLabel, catSingular, YEAR)

  // Section 9 – Final Recommendations
  const s9 = buildFinalRecsSection(picks, catLabel, catSingular)

  // Section 10 – Internal Links
  const s10 = buildInternalLinksSection(catSlug, catLabel, products)

  // Schema.org
  const productList = products.map(p => ({
    name: shortName(p.product_name || p._legacy?.name || '', 60),
    link: (() => { const o = resolveOffer(p); return o.affiliate_url || `https://www.amazon.in/dp/${o.external_id || p._legacy?.asin}?tag=${TAG}` })()
  }))
  const schema = guideSchema({ catLabel, catSlug, slug: guideSlug, products: productList })
  const schemaJSON = JSON.stringify(schema, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

  return postShell(`${buildPageStyles()}

${asciDisclosure()}

<nav style="font-size:13px;color:#888;margin-bottom:20px;">
  <a href="/" style="color:#666;">Home</a> ›
  <a href="/best-${catSlug}/" style="color:#666;">${catLabel}</a> ›
  Buying Guide
</nav>

<h1 style="font-size:28px;font-weight:800;line-height:1.25;margin:0 0 18px;color:#1a1a1a;">Best ${catLabel}s in India ${YEAR}${useCase ? ` for ${useCase}` : ''}${subtype === 'budget' ? ' — Budget Picks' : ''}</h1>

${introHTML}

${s1}

${s2}

${s3}

${s4Header}
${s4Cards}

${s5}

${s6}

${s7}

${s8}

${s9}

${s10}

<script type="application/ld+json">
${schemaJSON}
</script>`)
}

async function main() {
  const args      = process.argv.slice(2)
  const dryRun    = args.includes('--dry-run')
  const catFilter = args.includes('--cat') ? args[args.indexOf('--cat') + 1] : null
  const subtype   = args.includes('--subtype') ? args[args.indexOf('--subtype') + 1] : null
  const limit     = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) || 9999 : 9999

  if (!WP || !USER || !PASS) { console.error('Missing WP credentials in .env'); process.exit(1) }
  if (!fs.existsSync(QUEUE_FILE)) { console.error('Run content-opportunity-engine.js first'); process.exit(1) }

  const productIndex = loadProducts(KITCHEN, PRODS_DIR)

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))
    .filter(o => o.type === 'buying_guide')
    .filter(o => !catFilter || o.category === catFilter)
    .filter(o => !subtype || o.subtype === subtype)
    .slice(0, limit)

  console.log(`Buying guide queue: ${queue.length} items`)
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 }

  for (const op of queue) {
    const catSlug  = op.category
    const useCase  = op.use_case || op.decision_type || null
    const sub      = op.subtype || 'general'
    const products = getProductsForCat(catSlug, productIndex)

    if (!products.length) { console.log(`  skip ${catSlug} — no products`); stats.skipped++; continue }

    const guideSlug = `best-${catSlug}${useCase ? '-' + slugify(useCase) : ''}${sub === 'budget' ? '-budget' : ''}`
    const catLabel  = CAT_LABELS[catSlug] || titleCase(catSlug)
    const title     = sub === 'budget'
      ? `Best Budget ${catLabel} in India ${YEAR}`
      : useCase
        ? `Best ${catLabel} for ${useCase} in India ${YEAR}`
        : `Best ${catLabel} in India ${YEAR}`

    try {
      const guideMetaDesc = `Best ${catLabel} in India ${YEAR} — top picks ranked by specs, ratings, and value. ${products.length} options compared with full buying guide.`
      const md = guideMetaDesc.length > 160 ? guideMetaDesc.substring(0, 157) + '…' : guideMetaDesc
      const catSingular = CAT_LABEL_SINGULAR[catSlug] || catLabel.toLowerCase()
      const focusKw = sub === 'budget'
        ? `best budget ${catSingular} in india`
        : useCase
          ? `best ${catSingular} for ${useCase.toLowerCase()}`
          : `best ${catSingular} in india`
      const html   = buildGuideHTML(products, catSlug, sub, useCase)
      const lintHits = voiceLint(html)
      if (lintHits.length) console.warn(`  ⚠ voice lint [${guideSlug}]: ${lintHits.map(h => h.match).join(', ')}`)
      const topImg = products.find(p => p.wp_image_id)?.wp_image_id || null
      const result = await wpUpsertPage({ title, slug: guideSlug, content: html }, { wp: WP, auth: AUTH, dryRun, metaDesc: md, focusKw, postType: 'posts', featuredMediaId: topImg })
      if (result) {
        console.log(`  ✓ [${result.action}] ${catSlug} | ${sub} | ${useCase || 'general'}`)
        result.action === 'created' ? stats.created++ : stats.updated++
      }
    } catch (e) {
      console.error(`  ✗ ${catSlug}: ${e.message}`)
      stats.errors++
    }
    await new Promise(r => setTimeout(r, 400))
  }

  console.log(`\n── DONE ─────────────────────────────`)
  console.log(`Created: ${stats.created} | Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`)
  if (dryRun) console.log('(dry run — no WP changes)')
}

main().catch(e => { console.error(e.message); process.exit(1) })
