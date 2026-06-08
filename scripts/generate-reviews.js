// scripts/generate-reviews.js
require('dotenv').config()
const fs   = require('fs')
const path = require('path')

const { makeAuth, wpUpsertPage } = require('./lib/wp')
const {
  resolveOffer, specTable, featureHighlights,
  familySizeFromCapacity, getSpecVal, asciDisclosure,
  methodologyBlock, loadProducts,
} = require('./lib/content')
const { reviewSchema, slugify } = require('./lib/schema')

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

const SEGMENT_COPY = {
  budget:      'A cost-effective entry point for households new to this category.',
  'mid-range': 'A well-specified option for regular everyday use.',
  premium:     'A premium build with more precise controls — suited for frequent, heavy use.',
  flagship:    'Top-tier specification. Best for large families or daily intensive cooking.',
}

const CAT_FAQS = {
  'air-fryers': [
    ['Is this air fryer good for Indian cooking?', 'Air fryers work well for Indian snacks like samosas, pakoras, and tandoori items. Most models reaching 200°C handle these well. Check the capacity to ensure it fits the quantities you cook.'],
    ['How much electricity does an air fryer use?', 'Most home air fryers (1200–1800W) cost approximately ₹4–8 per hour at standard Indian electricity rates. They are generally more energy-efficient than conventional ovens for small quantities.'],
    ['Does the capacity on the box match real usable space?', 'Marketed capacity includes the full basket volume. Usable cooking space is typically 60–70% of stated capacity. A "4.5L" air fryer realistically holds 2–3 servings at once.'],
    ['Can I use the air fryer without oil?', 'Yes — that is the primary use case. A light spray of oil on some foods helps browning, but many foods (chips, frozen snacks, reheating) need none at all.'],
  ],
  'mixer-grinders': [
    ['What wattage is enough for Indian cooking?', '500–750W handles most household grinding. 750W+ suits families grinding large batches of wet batter frequently.'],
    ['Are stainless steel jars better than polycarbonate?', 'Stainless steel is more durable, does not stain from turmeric, and is easier to clean. Polycarbonate allows you to see contents but can scratch and retain odours.'],
    ['What warranty should I look for?', 'Minimum 2 years on the motor. Indian brands like Preethi and Butterfly typically offer 5-year motor warranties on premium models.'],
    ['Can a mixer grinder make nut butters?', 'Most standard mixer grinders are not designed for nut butters — they require prolonged high-torque operation.'],
  ],
  'coffee-machines': [
    ['Which type suits Indian tastes?', 'For South Indian filter coffee: stainless drip filters. For café-style espresso: pump machines (9+ bar). Capsule machines offer convenience but have ongoing pod costs.'],
    ['How often does a coffee machine need cleaning?', 'Daily rinse after each use. Monthly descaling is essential in India given hard water in most cities.'],
    ['Are pod machines worth it in India?', 'Capsule cost in India is ₹40–80 per cup versus ₹15–25 for ground coffee. Convenience is the main trade-off.'],
    ['What is bar pressure?', 'Bar measures brewing pressure. True espresso requires 9 bar minimum. Lower-rated machines produce strong coffee but not technically espresso.'],
  ],
  'induction-cooktops': [
    ['What cookware works on induction?', 'Only ferromagnetic cookware — cast iron and most stainless steel. Test with a fridge magnet: if it sticks to the bottom, it works.'],
    ['How much electricity does induction use vs gas?', 'Induction is 85–90% efficient versus 40–55% for gas. Typically costs ₹5–8 per hour, lower than LPG per equivalent heat output.'],
    ['Is induction safe for children?', 'The surface does not get directly hot — only the cookware heats. Most models auto-shut off when cookware is removed.'],
    ['Can I cook at full speed like a gas stove?', 'High-wattage induction (1800–2000W) heats faster than most domestic gas burners and offers instant power adjustment.'],
  ],
  'electric-kettles': [
    ['How long does boiling take?', 'A 1500W kettle boils 1 litre in ~3–4 minutes. 1800–2200W cuts this to ~2.5 minutes.'],
    ['Stainless steel or plastic kettle?', 'Stainless steel interior is recommended — no plastic taste, more hygienic, longer-lasting. Check the interior material specifically.'],
    ['What capacity should I choose?', '1–1.2L suits 1–2 people. 1.5–1.7L is standard for 3–4 people. 2L+ for larger households.'],
    ['Do I need temperature control?', 'Only if you brew green tea (70–80°C) or pour-over coffee. For chai and instant coffee, single-boil at 100°C is sufficient.'],
  ],
  'food-processors': [
    ['Food processor vs mixer grinder?', 'A mixer grinder handles wet grinding (batter, chutneys). A food processor handles solid prep (chopping, slicing, dough). Most households benefit from both.'],
    ['How many watts do I need?', '600W handles most household tasks. 800–1000W suits heavy continuous use.'],
    ['Are attachments easy to clean?', 'Most modern food processors have dishwasher-safe parts. Wide-mouth bowls with few crevices clean significantly faster.'],
    ['Can it replace a mixer grinder?', 'Partially. Food processors handle some wet grinding but most lack sustained power for idli/dosa batter.'],
  ],
  'hand-blenders': [
    ['Better than a mixer grinder for soups?', 'For blending soups directly in the pot: yes. Eliminates the transfer step and risk of hot liquid spills.'],
    ['What power is sufficient?', '250–400W covers smoothies, soups, and baby food. 600–800W is better for tougher tasks or extended blending.'],
    ['Do attachments make a difference?', 'A chopper attachment effectively adds a mini food processor. A whisk handles cream and egg whites. Buying with attachments can replace two or three separate appliances.'],
    ['How do I avoid splatter?', 'Submerge the blade head fully before switching on. Start at low speed and increase gradually.'],
  ],
  'sandwich-makers': [
    ['Sandwich maker vs grill?', 'Basic sandwich makers seal and toast. Grill plates add grill marks and work for paninis and vegetables. Multi-use models offer removable plates for both.'],
    ['How do I prevent sticking?', 'Light cooking spray or brushing with oil before each use. Quality non-stick coatings significantly reduce sticking without any addition.'],
    ['What wattage is needed?', '750–900W is standard and adequate. Higher wattage preheats faster and maintains temperature better for multiple sandwiches.'],
    ['Are removable plates worth it?', 'For cleaning ease: yes. For basic daily sandwiches, fixed plates are simpler and equally effective.'],
  ],
  'rice-cookers': [
    ['What capacity do I need?', '1L for 1–2 people. 1.8L for 3–4 people — the most common Indian household size. 2.8L+ for larger families.'],
    ['More efficient than a pressure cooker?', 'Different tools. Rice cookers deliver consistent results without monitoring. Pressure cookers are faster and more versatile. Many households use both.'],
    ['Can I cook dal or khichdi?', 'Yes — most rice cookers handle simple dal and khichdi. A multi-cook setting works better for heavily spiced dishes.'],
    ['How important is non-stick?', 'Significant for cleaning ease. Quality coatings last 3–5 years with gentle utensils. Metal utensils will damage the coating.'],
  ],
}

function titleCase(s) {
  return (s || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function buildIntro(name, specs, catLabel, seg) {
  const wattage  = getSpecVal(specs, 'Output Wattage', 'Wattage', 'Wattage Rating')
  const capacity = getSpecVal(specs, 'Capacity', 'Volume', 'Bowl Capacity', 'Jug Capacity')
  const ctrl     = getSpecVal(specs, 'Controller Type', 'Control Method', 'Controls')
  const minT     = getSpecVal(specs, 'Min Temperature Setting', 'Minimum Temperature')
  const maxT     = getSpecVal(specs, 'Max Temperature Setting', 'Maximum Temperature')

  const parts = []
  if (capacity && wattage) parts.push(`a ${capacity}, ${wattage} ${catLabel.toLowerCase()}`)
  else if (capacity) parts.push(`a ${capacity} ${catLabel.toLowerCase()}`)
  else if (wattage)  parts.push(`a ${wattage} ${catLabel.toLowerCase()}`)
  else parts.push(`a ${catLabel.toLowerCase()}`)

  if (ctrl) parts.push(`with ${ctrl.toLowerCase()} controls`)
  if (minT && maxT) parts.push(`operating between ${minT.replace(' Degrees Celsius','°C')} and ${maxT.replace(' Degrees Celsius','°C')}`)

  const familySize = capacity ? familySizeFromCapacity(capacity) : null
  const familyNote = familySize ? ` Suited for ${familySize}.` : ''

  const segCopy = SEGMENT_COPY[seg] || SEGMENT_COPY['mid-range']
  return `${name} is ${parts.join(', ')}. ${segCopy}${familyNote}`
}

function buildWhoShouldBuy(specs, catLabel, features) {
  const capacity = getSpecVal(specs, 'Capacity', 'Volume', 'Bowl Capacity')
  const ctrl     = getSpecVal(specs, 'Controller Type', 'Control Method')
  const wattage  = getSpecVal(specs, 'Output Wattage', 'Wattage')

  const bullets = []
  if (capacity) {
    const fs = familySizeFromCapacity(capacity)
    if (fs) bullets.push(`Households cooking for ${fs}`)
  }
  if (ctrl && /touch|digital/i.test(ctrl)) {
    bullets.push('Users who prefer digital preset controls over manual dials')
  } else if (ctrl && /manual|knob|analog/i.test(ctrl)) {
    bullets.push('Users who prefer simple manual controls')
  }
  if (wattage) {
    const w = parseFloat(wattage.replace(/[^0-9.]/g, ''))
    if (!isNaN(w) && w >= 1800) bullets.push('High-power cooking: faster preheat and better performance for larger batches')
  }
  const hasKeepWarm = features.some(f => /keep.?warm/i.test(f))
  if (hasKeepWarm) bullets.push('Households that need food to stay warm after cooking')
  const hasAutoShut = features.some(f => /auto.?shut|overheat/i.test(f))
  if (hasAutoShut) bullets.push('Safety-conscious buyers — auto shut-off and overheat protection included')

  if (!bullets.length) {
    bullets.push(`Buyers looking for a reliable everyday ${catLabel.toLowerCase()}`)
    bullets.push('Households comparing multiple options in this price segment')
  }

  return `<ul style="font-size:15px;line-height:1.8;color:#333;margin:0;padding-left:20px;">
${bullets.map(b => `  <li>${b}</li>`).join('\n')}
</ul>`
}

function buildReviewHTML(product, catSlug) {
  const name     = product.product_name || product._legacy?.name || 'Product'
  const brand    = titleCase(product.brand_id || '')
  const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
  const offer    = resolveOffer(product)
  const asin     = offer.external_id || product._legacy?.asin || ''
  const link     = offer.affiliate_url || `https://www.amazon.in/dp/${asin}?tag=${TAG}`
  const seg      = product.price_segment || product._legacy?.price_segment || 'mid-range'
  const specs    = product.specifications || {}
  const features = specs._features || []
  const faqs     = CAT_FAQS[catSlug] || []

  const intro         = buildIntro(name, specs, catLabel, seg)
  const specsHTML     = specTable(specs)
  const featuresHTML  = featureHighlights(features)
  const whoHTML       = buildWhoShouldBuy(specs, catLabel, features)
  const asinSlug      = `review-${slugify(brand)}-${asin.toLowerCase()}`

  const schema = reviewSchema({ name, brand, catLabel, catSlug, link, faqs, asinSlug })

  const methodCtx = `This assessment is based on published specifications for the ${name}, aggregated user feedback, competitive positioning against comparable models, and PriceHawk's tracked price history.`

  return `${asciDisclosure()}

<nav style="font-size:13px;color:#888;margin-bottom:20px;">
<a href="/" style="color:#666;">Home</a> › <a href="/best-${catSlug}/" style="color:#666;">Best ${catLabel}s in India ${YEAR}</a> › ${name.substring(0, 50)}… Review
</nav>

<p style="font-size:16px;line-height:1.7;color:#333;">${intro}</p>

<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:16px 20px;margin:20px 0;">
  <p style="font-size:12px;color:#888;font-weight:700;text-transform:uppercase;margin:0 0 4px;">${brand}</p>
  <h2 style="font-size:17px;font-weight:700;margin:0 0 12px;line-height:1.4;">${name}</h2>
  <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:14px;font-weight:700;padding:9px 20px;border-radius:4px;">
    Check price on Amazon →
  </a>
</div>

<h2 style="font-size:20px;font-weight:700;margin:28px 0 10px;">Full Specifications</h2>
${specsHTML || '<p style="color:#666;font-size:14px;">Refer to the Amazon product page for full specifications.</p>'}

${featuresHTML ? `<h2 style="font-size:20px;font-weight:700;margin:28px 0 10px;">What Makes This Stand Out</h2>\n${featuresHTML}` : ''}

<h2 style="font-size:20px;font-weight:700;margin:28px 0 10px;">Who Should Buy This?</h2>
${whoHTML}

${methodologyBlock(methodCtx)}

<div style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:6px;padding:16px 20px;margin:24px 0;">
  <p style="margin:0 0 10px;font-weight:700;font-size:15px;">Ready to buy or want to check the latest price?</p>
  <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:14px;font-weight:700;padding:9px 20px;border-radius:4px;">
    Check price on Amazon India →
  </a>
  <p style="margin:10px 0 0;font-size:12px;color:#999;">Amazon prices change frequently. Click to see the current price.</p>
</div>

${faqs.length ? `<h2 style="font-size:20px;font-weight:700;margin:32px 0 12px;">Frequently Asked Questions</h2>
${faqs.map(([q, a]) => `<details style="border:1px solid #e0e0e0;border-radius:4px;margin-bottom:8px;">
  <summary style="padding:12px 16px;cursor:pointer;font-weight:600;font-size:14px;background:#fafafa;">${q}</summary>
  <div style="padding:12px 16px;font-size:14px;line-height:1.7;color:#333;">${a}</div>
</details>`).join('\n')}` : ''}

<hr style="margin:32px 0;border:none;border-top:1px solid #e0e0e0;">
<p style="font-size:13px;color:#888;">
  <a href="/best-${catSlug}/" style="color:#e65100;font-weight:600;">← Compare all ${catLabel}s in India ${YEAR}</a>
</p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
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

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))
    .filter(o => o.type === 'review')
    .filter(o => !catFilter || o.category === catFilter)
    .slice(0, limit)

  console.log(`Review queue: ${queue.length} items`)
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 }

  for (const op of queue) {
    const product = productIndex[op.asin]
    if (!product) { console.log(`  skip ${op.asin} — not in product index`); stats.skipped++; continue }

    const name    = product.product_name || product._legacy?.name || ''
    const brand   = product.brand_id || 'product'
    const asin    = op.asin
    const catSlug = op.category
    const slug    = `review-${slugify(brand)}-${asin.toLowerCase()}`
    const rawName = name.replace(/\s*[\\|,].*$/, '').trim()
    const short   = rawName.length > 55 ? rawName.substring(0, 52) + '…' : rawName
    const title   = `${short} Review — Worth Buying in India ${YEAR}?`

    try {
      const html   = buildReviewHTML(product, catSlug)
      const result = await wpUpsertPage({ title, slug, content: html }, { wp: WP, auth: AUTH, dryRun })
      if (result) {
        console.log(`  ✓ [${result.action}] ${catSlug} | ${short.substring(0, 45)}`)
        result.action === 'created' ? stats.created++ : stats.updated++
      }
    } catch (e) {
      console.error(`  ✗ ${asin}: ${e.message}`)
      stats.errors++
    }

    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n── DONE ────────────────────────`)
  console.log(`Created: ${stats.created} | Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`)
  if (dryRun) console.log('(dry run — no WP changes)')
}

main().catch(e => { console.error(e.message); process.exit(1) })
