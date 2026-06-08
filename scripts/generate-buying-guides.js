// scripts/generate-buying-guides.js
require('dotenv').config()
const fs   = require('fs')
const path = require('path')

const { makeAuth, wpUpsertPage } = require('./lib/wp')
const {
  resolveOffer, featureHighlights,
  asciDisclosure, methodologyBlock, loadProducts, getSpecVal,
} = require('./lib/content')
const { guideSchema, slugify } = require('./lib/schema')

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
  'air-fryers': 'Air fryers are now India\'s fastest-growing kitchen appliance — delivering crispy results with significantly less oil than traditional frying. Whether you\'re making samosas, pakoras, or grilled chicken, the right air fryer transforms everyday cooking.',
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
    { factor: 'Capacity', tip: 'A 2–3L basket suits 1–2 people. For a family of 4, choose 4–6L. Larger baskets take longer to heat.' },
    { factor: 'Wattage', tip: 'Higher wattage (1500W+) preheats faster and maintains temperature better during use.' },
    { factor: 'Preset Programs', tip: 'Presets are convenient for beginners. Experienced cooks often prefer manual control.' },
    { factor: 'Controls', tip: 'Digital touchscreen offers precision. Analog dials are simpler and often more durable.' },
  ],
  'mixer-grinders': [
    { factor: 'Wattage', tip: '500W handles light daily use. 750W suits families grinding idli/dosa batter regularly.' },
    { factor: 'Number of Jars', tip: '3 jars (dry, wet, chutney) covers most Indian cooking needs.' },
    { factor: 'Motor Warranty', tip: 'Look for minimum 2-year motor warranty. Indian brands often offer 5-year warranties.' },
    { factor: 'Jar Material', tip: 'Stainless steel jars are more durable and do not stain.' },
  ],
  'coffee-machines': [
    { factor: 'Coffee Type', tip: 'Drip: bulk coffee. Espresso: café-style shots. Capsule: convenience at higher per-cup cost.' },
    { factor: 'Bar Pressure', tip: 'True espresso requires 9 bar minimum.' },
    { factor: 'Milk Frother', tip: 'Required for cappuccinos and lattes. Budget machines typically omit this.' },
    { factor: 'Descaling', tip: 'In hard-water cities, descale monthly. Choose models with descaling indicators.' },
  ],
  'induction-cooktops': [
    { factor: 'Wattage', tip: '1200W handles everyday cooking. 1800–2000W boils water faster.' },
    { factor: 'Cookware', tip: 'Only ferromagnetic cookware works — cast iron and most stainless steel.' },
    { factor: 'Presets', tip: 'Temperature presets for dal, milk, chai save effort for daily use.' },
    { factor: 'Safety', tip: 'Look for auto-shutoff, child lock, and overheating protection.' },
  ],
  'electric-kettles': [
    { factor: 'Capacity', tip: '1L for 2–3 cups. 1.5–1.7L suits most households. 2L+ for larger families.' },
    { factor: 'Material', tip: 'Stainless steel interior is essential — no plastic taste, more hygienic.' },
    { factor: 'Wattage', tip: '1500W boils 1 litre in ~3.5 minutes. 2200W cuts this to ~2 minutes.' },
    { factor: 'Temperature Control', tip: 'Variable temperature needed for green tea or specialty coffee only.' },
  ],
  'food-processors': [
    { factor: 'Wattage', tip: '600W handles most household tasks. 800–1000W for heavy continuous use.' },
    { factor: 'Bowl Capacity', tip: '1.5–2L suits 2–4 people. 3L+ for large families.' },
    { factor: 'Attachments', tip: 'Slicing disc, shredding disc, and chopping blade cover 90% of use cases.' },
    { factor: 'Cleaning', tip: 'Wide-mouth bowls with dishwasher-safe parts save significant time.' },
  ],
  'hand-blenders': [
    { factor: 'Wattage', tip: '250–400W handles smoothies, soups, and baby food. 600W+ for tough ingredients.' },
    { factor: 'Speed Settings', tip: 'Variable speed gives better control for different textures.' },
    { factor: 'Shaft Material', tip: 'Stainless steel shafts last significantly longer than plastic.' },
    { factor: 'Attachments', tip: 'Chopper bowl and whisk attachments expand functionality significantly.' },
  ],
  'sandwich-makers': [
    { factor: 'Plate Type', tip: 'Fixed triangular: basic sandwich only. Flat grill: paninis. Removable: swap between modes.' },
    { factor: 'Wattage', tip: '750–900W standard. Higher wattage preheats faster for multiple sandwiches.' },
    { factor: 'Non-Stick', tip: 'Quality coating reduces need for butter and makes cleaning easier.' },
    { factor: 'Indicator', tip: 'Ready indicator shows when maker has reached cooking temperature.' },
  ],
  'rice-cookers': [
    { factor: 'Capacity', tip: '1L for 1–2 people. 1.8L is the standard Indian household size. 2.8L+ for larger families.' },
    { factor: 'Inner Pot', tip: 'Non-stick coating prevents sticking. Thicker pots provide even heat distribution.' },
    { factor: 'Keep-Warm', tip: 'Auto keep-warm function essential for Indian households with staggered mealtimes.' },
    { factor: 'Multi-Cook', tip: 'Multi-cook handles rice, dal, khichdi, and steam — worth it for daily use.' },
  ],
}

function titleCase(s) { return (s||'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) }
function shortName(name, max=50) {
  const c=(name||'').replace(/\s*[\\|,].*$/,'').trim()
  return c.length>max ? c.substring(0,max-1)+'…' : c
}

function getProductsForCat(catSlug, productIndex, n=5) {
  return Object.values(productIndex)
    .filter(p => p._catSlug === catSlug)
    .map(p => {
      const offer = resolveOffer(p)
      return { ...p, _price: offer.last_price || p._legacy?.current_price || 0 }
    })
    .sort((a, b) => a._price - b._price)
    .slice(0, n)
}

function buildProductCard(product, catSlug, position) {
  const name    = product.product_name || product._legacy?.name || 'Product'
  const brand   = titleCase(product.brand_id || '')
  const offer   = resolveOffer(product)
  const asin    = offer.external_id || product._legacy?.asin || ''
  const link    = offer.affiliate_url || `https://www.amazon.in/dp/${asin}?tag=${TAG}`
  const specs   = product.specifications || {}
  const features = specs._features || []

  const wattage  = getSpecVal(specs, 'Output Wattage', 'Wattage')
  const capacity = getSpecVal(specs, 'Capacity', 'Volume', 'Bowl Capacity')
  const ctrl     = getSpecVal(specs, 'Controller Type', 'Control Method')
  const specBits = [wattage, capacity, ctrl].filter(Boolean)

  const topFeature = features[0] || null

  return `<div style="border:1px solid #e0e0e0;border-radius:6px;padding:16px 20px;margin-bottom:16px;">
  <p style="font-size:12px;color:#888;font-weight:700;text-transform:uppercase;margin:0 0 4px;">#${position} · ${brand}</p>
  <h3 style="font-size:16px;font-weight:700;margin:0 0 8px;line-height:1.4;">${shortName(name, 70)}</h3>
  ${specBits.length ? `<p style="font-size:13px;color:#555;margin:0 0 8px;">${specBits.join(' · ')}</p>` : ''}
  ${topFeature ? `<p style="font-size:13px;color:#333;margin:0 0 12px;font-style:italic;">"${topFeature}"</p>` : ''}
  <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
    Check price on Amazon →
  </a>
</div>`
}

function buildGuideHTML(products, catSlug, subtype, useCase) {
  const catLabel    = CAT_LABELS[catSlug] || titleCase(catSlug)
  const catSingular = CAT_LABEL_SINGULAR[catSlug] || catLabel.toLowerCase()
  const intro       = CAT_INTROS[catSlug] || `Find the best ${catSingular} for Indian homes.`
  const factors     = CAT_BUYING_FACTORS[catSlug] || []
  const guideSlug   = `best-${catSlug}${useCase ? '-' + slugify(useCase) : ''}${subtype === 'budget' ? '-budget' : ''}`

  const productList = products.map((p) => ({
    name: shortName(p.product_name || p._legacy?.name || '', 60),
    link: (() => { const o = resolveOffer(p); return o.affiliate_url || `https://www.amazon.in/dp/${o.external_id || p._legacy?.asin}?tag=${TAG}` })()
  }))

  const schema = guideSchema({ catLabel, catSlug, slug: guideSlug, products: productList })

  const cardsHTML = products.map((p, i) => buildProductCard(p, catSlug, i + 1)).join('\n')

  const factorsHTML = factors.length ? `
<h2 style="font-size:20px;font-weight:700;margin:32px 0 12px;">What to Look For</h2>
${factors.map(({ factor, tip }) => `<div style="margin-bottom:12px;">
  <p style="font-size:15px;font-weight:700;margin:0 0 4px;">${factor}</p>
  <p style="font-size:14px;color:#444;margin:0;line-height:1.6;">${tip}</p>
</div>`).join('\n')}` : ''

  const methodCtx = `This guide covers ${catLabel} available on Amazon India. Selections are based on published specifications, price-to-feature value across segments, and analysis of user review patterns.`

  return `${asciDisclosure()}

<nav style="font-size:13px;color:#888;margin-bottom:20px;">
<a href="/" style="color:#666;">Home</a> › ${catLabel} Buying Guide
</nav>

<p style="font-size:16px;line-height:1.7;color:#333;">${intro}</p>

<h2 style="font-size:20px;font-weight:700;margin:28px 0 16px;">Top Picks</h2>
${cardsHTML}

${factorsHTML}

${methodologyBlock(methodCtx)}

<hr style="margin:32px 0;border:none;border-top:1px solid #e0e0e0;">
<p style="font-size:13px;color:#888;">
  <a href="/best-${catSlug}/" style="color:#e65100;font-weight:600;">← See all ${catLabel} options in India ${YEAR}</a>
</p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
</script>`
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
      const html   = buildGuideHTML(products, catSlug, sub, useCase)
      const result = await wpUpsertPage({ title, slug: guideSlug, content: html }, { wp: WP, auth: AUTH, dryRun })
      if (result) {
        console.log(`  ✓ [${result.action}] ${catSlug} | ${sub} | ${useCase || 'general'}`)
        result.action === 'created' ? stats.created++ : stats.updated++
      }
    } catch (e) {
      console.error(`  ✗ ${catSlug}: ${e.message}`)
      stats.errors++
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n── DONE ────────────────────────`)
  console.log(`Created: ${stats.created} | Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`)
  if (dryRun) console.log('(dry run — no WP changes)')
}

main().catch(e => { console.error(e.message); process.exit(1) })
