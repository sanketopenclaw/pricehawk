// scripts/generate-reviews.js
require('dotenv').config()
const fs   = require('fs')
const path = require('path')

const { makeAuth, wpUpsertPage } = require('./lib/wp')
const {
  resolveOffer, affiliateLink, specTable, featureHighlights,
  familySizeFromCapacity, getSpecVal, asciDisclosure,
  methodologyBlock, loadProducts, sparklineSVG,
  buildSlugIndex, relatedLinks, metaDescription,
} = require('./lib/content')
const { reviewSchema, slugify } = require('./lib/schema')
const { reviewIntroLead, trackingSinceNote, cantTellYouBlock, voiceLint } = require('./lib/voice')
const {
  prosConsFromSpecs, verdictBox, updatedLine, prosConsBlock,
  postShell, specScorecard, howItStacksUp, tocBlock, specsAccordion, telegramCTA, reviewsBlock, productImageGallery,
} = require('./lib/templates')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD
const TAG  = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'
const AUTH = makeAuth(USER, PASS)

const PRODS_DIR       = path.join(__dirname, '../data/products')
const QUEUE_FILE      = path.join(__dirname, '../data/content/phase1_queue.json')
const PRICE_SERIES_DIR = path.join(__dirname, '../data/price_series')
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

const CAT_BODY = {
  'air-fryers': (specs, seg) => {
    const cap  = getSpecVal(specs, 'Capacity', 'Volume')
    const ctrl = getSpecVal(specs, 'Controller Type', 'Control Method', 'Controls')
    const ctrlNote = ctrl && /digital|touch/i.test(ctrl)
      ? 'Digital controls let you set time and temperature without guesswork — useful once you learn a few go-to settings for your regular dishes.'
      : ctrl && /manual|knob/i.test(ctrl)
      ? 'The manual dial controls are simple and reliable, though you will rely on your own judgment for timing rather than preset programs.'
      : ''
    const capNote = cap
      ? `The ${cap} basket is the practical constraint to check first — it determines how many portions you can cook at once, which matters more than wattage for most households.`
      : ''
    const segNote = seg === 'budget'
      ? 'At this price point, the trade-off is usually simpler controls and a smaller basket, which is a fair exchange if you are trying air frying for the first time.'
      : seg === 'flagship' || seg === 'premium'
      ? 'Premium air fryers earn their price with better build quality, more precise temperature control, and larger capacities — the difference shows when you are cooking every day.'
      : 'Mid-range air fryers have improved significantly — you get most of what you need without paying for features that mainly add complexity.'
    return [capNote, ctrlNote, segNote].filter(Boolean).join(' ')
  },
  'mixer-grinders': (specs, seg) => {
    const w = getSpecVal(specs, 'Output Wattage', 'Wattage')
    return `A mixer grinder is one of the most-used appliances in an Indian kitchen — if you make chutneys, idli batter, or masala pastes from scratch, the motor wattage and jar quality matter more than most spec-sheet numbers. ${w ? `At ${w}, this model` : 'This model'} ${seg === 'budget' ? 'covers basic grinding well, though sustained heavy-duty use over years will reveal the limits of its motor.' : 'handles the full range of typical Indian kitchen grinding without straining.'}  The jar material and the warranty on the motor are the two things worth looking at most carefully when comparing options in this category.`
  },
  'coffee-machines': (specs, seg) => {
    return `Coffee machines in India cover a wide range of use cases — from South Indian filter coffee to espresso-style drinks — and the right machine depends entirely on what you actually drink at home. ${seg === 'budget' ? 'Entry-level machines simplify the process but limit your coffee styles.' : seg === 'premium' || seg === 'flagship' ? 'Premium machines give you proper brewing pressure and temperature control, which makes a real difference for espresso and pour-over.' : 'Mid-range machines strike a balance between convenience and quality that works for most daily coffee drinkers.'} Descaling regularly — especially in hard-water cities — will extend the machine's life significantly.`
  },
  'induction-cooktops': (specs, seg) => {
    const w = getSpecVal(specs, 'Output Wattage', 'Wattage')
    return `Induction cooktops have become a practical primary or backup cooking surface in Indian homes — they heat faster than most domestic gas burners, use significantly less energy, and the smooth surface is far easier to clean. ${w ? `At ${w}, this model` : 'This model'} ${parseInt(w) >= 1800 ? 'delivers high-heat performance suitable for stir-frying and rapid boiling.' : 'handles everyday cooking tasks well, including boiling, simmering, and frying.'} One practical check before buying: confirm your existing cookware is induction-compatible. Only ferromagnetic vessels work — if a fridge magnet does not stick to the base, it will not work on induction.`
  },
  'electric-kettles': (specs, seg) => {
    const cap = getSpecVal(specs, 'Capacity', 'Volume')
    return `Electric kettles are one of the simplest appliances to get right — the main variables are capacity, interior material, and wattage. ${cap ? `A ${cap} kettle` : 'This kettle'} ${seg === 'budget' ? 'covers the basics well; the plastic taste some cheaper models have fades after a few uses.' : 'builds quality where it counts.'} Look for a stainless-steel interior over plastic — it stays cleaner, does not pick up odours, and lasts longer in hard-water conditions. If you drink only chai or instant coffee, temperature control is not worth paying for; it mainly matters for green tea and pour-over.`
  },
  'food-processors': (specs, seg) => {
    return `A food processor handles the prep work that a mixer grinder does not — slicing, chopping, shredding, and sometimes kneading dough — which makes it most useful in kitchens where a lot of fresh ingredients are prepared daily. ${seg === 'budget' ? 'At the budget end, the motor is the trade-off — useful for occasional prep but not for sustained daily heavy use.' : 'This model is built for regular use with enough power to handle most household prep tasks without overheating.'} Bowl capacity and the number of included attachments both affect how useful it is in practice; check which ones are actually included versus sold separately.`
  },
  'hand-blenders': (specs, seg) => {
    return `Hand blenders — also called immersion blenders — solve one specific problem better than any other appliance: blending soups, sauces, and smoothies directly in the pot or container, without transferring hot liquids. ${seg === 'budget' ? 'Basic models handle soft blending tasks well; the limitation shows with fibrous vegetables or extended blending.' : 'This model has enough power to handle most Indian kitchen tasks including thicker chutneys and smoothies.'} The quality of the seal where the blade meets the shaft matters a lot for cleaning ease; check that the head is fully removable and dishwasher-safe.`
  },
  'sandwich-makers': (specs, seg) => {
    return `Sandwich makers are a morning staple in many Indian households — fast, low-fuss, and easy to clean compared to a pan. The main choice is between fixed plates (simpler, good for basic sandwiches) and removable plates (more versatile, easier to clean thoroughly). ${seg === 'budget' ? 'Budget models do the core job fine; the non-stick quality is the variable that shows over time.' : 'A non-stick coating that holds up over 2–3 years is worth the slight premium in this category.'} Preheat time and plate coverage are the two things that make a noticeable difference to the end result.`
  },
  'rice-cookers': (specs, seg) => {
    const cap = getSpecVal(specs, 'Capacity', 'Volume')
    return `Rice cookers take the monitoring out of cooking rice — one of the most common sources of kitchen frustration — and deliver consistent results. ${cap ? `A ${cap} capacity` : 'This capacity'} determines how many portions fit in a single batch, which is the most practical spec to match to your household size. ${seg === 'budget' ? 'Entry-level models handle plain rice well; for dal or khichdi, a multi-cook setting helps.' : 'This model is well-specified for the full range of typical rice dishes.'} The non-stick coating quality affects both cooking results and long-term durability — avoid metal utensils to preserve it.`
  },
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
  const article = (str) => /^[aeiou]/.test(str) ? 'an' : 'a'
  if (capacity && wattage) parts.push(`${article(capacity)} ${capacity}, ${wattage} ${catLabel.toLowerCase()}`)
  else if (capacity) parts.push(`${article(capacity)} ${capacity} ${catLabel.toLowerCase()}`)
  else if (wattage)  {
    const w = wattage.toLowerCase()
    parts.push(`${article(w)} ${w} ${catLabel.toLowerCase()}`)
  }
  else {
    const c = catLabel.toLowerCase()
    parts.push(`${article(c)} ${c}`)
  }

  if (ctrl) {
    const ctrlDisplay = ctrl.replace(/\s*controls?\s*$/i, '').trim()
    if (ctrlDisplay) parts.push(`with ${ctrlDisplay.toLowerCase()} controls`)
  }
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

  return `<ul style="font-size:15px;line-height:1.8;color:#c8c8c8;margin:0;padding-left:20px;">
${bullets.map(b => `  <li>${b}</li>`).join('\n')}
</ul>`
}

function buildInYourKitchen(specs, catLabel, name, features) {
  const capacity = getSpecVal(specs, 'Capacity', 'Volume', 'Bowl Capacity', 'Jug Capacity')
  const wattage  = getSpecVal(specs, 'Output Wattage', 'Wattage')
  const ctrl     = getSpecVal(specs, 'Controller Type', 'Control Method')
  const presets  = getSpecVal(specs, 'Number of Presets', 'Cooking Presets', 'Preset Programs')
  const familySize = capacity ? familySizeFromCapacity(capacity) : null
  const w = wattage ? parseFloat(wattage.replace(/[^0-9.]/g, '')) : 0
  const c = capacity ? parseFloat(capacity.replace(/[^0-9.]/g, '')) : 0
  const scenarios = []

  // Scenario 1: family cooking
  if (familySize && c) {
    const batchExample = c >= 6 ? 'a whole chicken, 1kg of fries, or a tray of chicken wings' :
                         c >= 4 ? '500g of fries, chicken thighs, or a medium-sized fish' :
                         '2–3 portions of fries or a couple of chicken pieces'
    scenarios.push({
      icon: '🍽',
      heading: `Cooking for ${familySize}`,
      text: `The ${capacity} basket fits ${batchExample} in a single batch — no splitting across two rounds for a standard meal.`
    })
  }

  // Scenario 2: speed/power
  if (w >= 1500) {
    const preheat = w >= 2000 ? '2–3 minutes' : '3–4 minutes'
    scenarios.push({
      icon: '⚡',
      heading: 'Weeknight meals',
      text: `At ${wattage}, this preheats in roughly ${preheat}. Frozen chips are crispy in 12–15 minutes from cold. It's fast enough for a last-minute dinner without the oven warm-up wait.`
    })
  }

  // Scenario 3: controls
  if (ctrl && /touch|digital/i.test(ctrl) && presets) {
    scenarios.push({
      icon: '📱',
      heading: 'Using the presets',
      text: `The ${presets} preset programs cover the most common tasks — fries, chicken, fish, bake — with time and temperature pre-set. Useful if you don't want to look up temperatures for every recipe.`
    })
  } else if (ctrl && /manual|knob/i.test(ctrl)) {
    scenarios.push({
      icon: '🔧',
      heading: 'Manual control',
      text: `Dial controls mean no app or display to learn. Set the timer, set the temperature, and walk away. Simple to use for people who want a no-fuss appliance.`
    })
  }

  // Scenario 4: features highlight
  const hasKeepWarm = features.some(f => /keep.?warm/i.test(f))
  const hasFrost = features.some(f => /frozen|defrost/i.test(f))
  if (hasFrost) {
    scenarios.push({
      icon: '❄',
      heading: 'Straight from the freezer',
      text: `Frozen-to-crispy without defrosting first. Useful for frozen snacks, nuggets, and fish fingers — add 3–5 minutes to the usual cook time.`
    })
  } else if (hasKeepWarm) {
    scenarios.push({
      icon: '🌡',
      heading: 'Serving staggered meals',
      text: `Keep-warm mode holds food at serving temperature so if someone comes to the table late, the food isn't cold. Typical keep-warm sits around 60–70°C.`
    })
  }

  if (!scenarios.length) return ''

  const cards = scenarios.map(s => `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:16px 18px;flex:1;min-width:220px;">
  <p style="font-size:15px;font-weight:700;color:#f0f0f0;margin:0 0 6px;">${s.heading}</p>
  <p style="font-size:14px;line-height:1.7;color:#a0a0a0;margin:0;">${s.text}</p>
</div>`).join('\n')

  return `<h2 style="font-size:20px;font-weight:700;margin:32px 0 14px;color:#f0f0f0;">In Your Kitchen</h2>
<p style="font-size:14px;color:#888;margin:0 0 14px;">Concrete scenarios based on the documented specs — not a lab test.</p>
<div style="display:flex;gap:12px;flex-wrap:wrap;">
${cards}
</div>`
}

function buildSpecsExplained(specs, catLabel) {
  const rows = []
  const w = getSpecVal(specs, 'Output Wattage', 'Wattage')
  const c = getSpecVal(specs, 'Capacity', 'Volume', 'Bowl Capacity', 'Jug Capacity')
  const ctrl = getSpecVal(specs, 'Controller Type', 'Control Method')
  const temp = getSpecVal(specs, 'Temperature Range', 'Max Temperature', 'Temperature Control')
  const material = getSpecVal(specs, 'Basket Material', 'Inner Material', 'Non-Stick Coating')
  const wVal = w ? parseFloat(w.replace(/[^0-9.]/g, '')) : 0
  const cVal = c ? parseFloat(c.replace(/[^0-9.]/g, '')) : 0

  if (w) rows.push({
    label: 'Wattage',
    value: w,
    explain: wVal >= 2000
      ? 'High power. Faster preheat (~2 min), better performance cooking large batches from frozen.'
      : wVal >= 1500
      ? 'Standard power for this category. Preheats in 3–4 minutes, adequate for everyday cooking.'
      : 'Lower wattage — fine for small portions but may need a couple of extra minutes on larger batches.'
  })

  if (c) rows.push({
    label: 'Capacity',
    value: c,
    explain: cVal >= 6
      ? 'Large basket — good for families of 4+. You can cook a whole chicken or 1kg of fries in one go.'
      : cVal >= 4
      ? 'Mid-size — works for 3–4 portions. Most popular size for Indian households.'
      : "Compact — best for 1–2 people. Easy to store but won’t handle large batches."
  })

  if (ctrl) rows.push({
    label: 'Controls',
    value: ctrl,
    explain: /touch|digital/i.test(ctrl)
      ? 'Digital/touch panel with preset programs. More features but slightly more to learn up front.'
      : /manual|knob|mechanical/i.test(ctrl)
      ? 'Mechanical knobs — zero learning curve. Set time and temp, go.'
      : `${ctrl} — check the product page for preset details.`
  })

  if (temp) rows.push({
    label: 'Temperature range',
    value: temp,
    explain: 'Higher maximum (200°C+) lets you get a proper crisp on chips and frozen foods. Lower temps (80–120°C) are used for dehydrating or gentle baking.'
  })

  if (material) rows.push({
    label: 'Basket coating',
    value: material,
    explain: /pfoa/i.test(material)
      ? 'PFOA-free coating noted explicitly — avoids the chemical linked to older non-stick concerns.'
      : 'Non-stick coating. Avoid metal utensils; hand-wash recommended to preserve the coating.'
  })

  if (!rows.length) return ''

  const tableRows = rows.map(r => `<tr>
  <td style="padding:10px 14px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#888;font-weight:700;white-space:nowrap;vertical-align:top;border-bottom:1px solid #2a2a2a;width:22%;">${r.label}</td>
  <td style="padding:10px 14px;font-size:13px;color:#e67e22;font-weight:700;font-family:'JetBrains Mono',ui-monospace,monospace;vertical-align:top;border-bottom:1px solid #2a2a2a;white-space:nowrap;width:18%;">${r.value}</td>
  <td style="padding:10px 14px;font-size:13.5px;color:#c8c8c8;vertical-align:top;border-bottom:1px solid #2a2a2a;line-height:1.6;">${r.explain}</td>
</tr>`).join('\n')

  return `<h2 style="font-size:20px;font-weight:700;margin:32px 0 14px;color:#f0f0f0;">Key Specs Explained</h2>
<p style="font-size:14px;color:#888;margin:0 0 12px;">What the spec sheet means in plain language.</p>
<table style="width:100%;border-collapse:collapse;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;">
${tableRows}
</table>`
}

function buildReviewHTML(product, catSlug, slugIndex = {}, categoryProducts = []) {
  const name     = product.product_name || product._legacy?.name || 'Product'
  const brand    = titleCase(product.brand_id || '')
  const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
  const offer    = resolveOffer(product)
  const asin     = offer.external_id || product._legacy?.asin || ''
  const link     = affiliateLink(offer, 'rev')
  const seg      = product.price_segment || product._legacy?.price_segment || 'mid-range'
  const specs    = product.specifications || {}
  const features = specs._features || []
  const faqs     = CAT_FAQS[catSlug] || []

  const intro         = buildIntro(name, specs, catLabel, seg)
  const bodyCopy      = (CAT_BODY[catSlug] || (() => ''))(specs, seg)
  const rating        = product._legacy?.rating
  const reviewCount   = product._legacy?.review_count
  const reviewsHTML   = reviewsBlock(product.reviews, rating, reviewCount)
  const specsHTML     = specTable(specs)
  const specsAccHTML  = specsAccordion(specsHTML || '<p style="color:#888;font-size:14px;">Refer to the Amazon product page for full specifications.</p>', 'Full Specifications')
  const featuresHTML  = featureHighlights(features)
  const whoHTML       = buildWhoShouldBuy(specs, catLabel, features)
  const galleryHTML   = productImageGallery(product)
  const kitchenHTML   = buildInYourKitchen(specs, catLabel, name, features)
  const specsExplHTML = buildSpecsExplained(specs, catLabel)
  const asinSlug      = `review-${slugify(brand)}-${asin.toLowerCase()}`
  const productId     = product.product_id || null
  const sparkline     = productId ? sparklineSVG(productId, PRICE_SERIES_DIR) : ''
  const introLead     = reviewIntroLead(asin)
  const trackNote     = productId ? trackingSinceNote(productId, PRICE_SERIES_DIR) : null

  const productImg = product._legacy?.img || ''
  const { pros, cons } = prosConsFromSpecs(product, categoryProducts, catLabel)
  const capacity  = getSpecVal(specs, 'Capacity', 'Volume', 'Bowl Capacity', 'Jug Capacity')
  const whoFor    = (capacity && familySizeFromCapacity(capacity)) || 'everyday home use'
  const keyStrength = pros[0]
    ? pros[0].split('—')[0].trim().replace(/^./, c => c.toLowerCase())
    : 'its overall spec balance for the price'
  const verdictName = (() => {
    const raw = name.replace(/\s*[\\|,(].*$/, '').trim()
    return raw.length > 55 ? raw.substring(0, 52).replace(/\s+\S*$/, '') + '…' : raw
  })()
  const verdictHTML  = verdictBox({ name: verdictName, catLabel, seg, whoFor, keyStrength, link, seed: asin })
  const scorecardHTML = specScorecard(product, categoryProducts, catLabel)
  const stacksUpHTML  = howItStacksUp(product, categoryProducts, catLabel)
  const tocHTML = tocBlock([
    scorecardHTML && { id: 'scorecard', label: 'Spec Score' },
    (pros.length || cons.length) && { id: 'pros-cons', label: 'Good & Not-So-Good' },
    stacksUpHTML && { id: 'stacks-up', label: 'vs Rivals' },
    { id: 'who-for', label: 'Who Should Buy' },
    { id: 'specs', label: 'Specifications' },
    faqs.length && { id: 'faq', label: 'FAQ' },
  ].filter(Boolean))

  const schema = reviewSchema({ name, brand, catLabel, catSlug, link, faqs, asinSlug })

  const methodCtx = `This assessment is based on published specifications for the ${name}, aggregated user feedback, competitive positioning against comparable models, and PriceHawk's tracked price history.`

  return postShell(`${asciDisclosure()}

<nav style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#5f5f5f;margin-bottom:24px;">
<a href="/" style="color:#888;text-decoration:none;">Home</a> <span style="color:#3a3a3a;">›</span> <a href="/best-${catSlug}/" style="color:#888;text-decoration:none;">Best ${catLabel}s in India ${YEAR}</a> <span style="color:#3a3a3a;">›</span> <span style="color:#c8c8c8;">${name.substring(0, 50)}…</span>
</nav>

<h1 style="font-size:32px;font-weight:800;line-height:1.15;margin:0 0 20px;color:#f0f0f0;letter-spacing:-0.02em;">${verdictName} Review — Worth Buying in India ${YEAR}?</h1>

${verdictHTML}
${updatedLine()}
${tocHTML}

<p style="font-size:16px;line-height:1.8;color:#c8c8c8;">${introLead} ${intro}</p>
${bodyCopy ? `<p style="font-size:15px;line-height:1.9;color:#a0a0a0;margin:14px 0 20px;">${bodyCopy}</p>` : ''}

<div style="display:flex;gap:20px;flex-wrap:wrap;margin:24px 0;align-items:stretch;">
<div style="flex:1.2;min-width:300px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px;display:flex;gap:18px;align-items:flex-start;">
  ${productImg ? `<img src="${productImg}" alt="${name}" loading="lazy" style="width:120px;height:120px;object-fit:contain;border-radius:6px;background:#141414;flex:0 0 120px;border:1px solid #2a2a2a;">` : ''}
  <div style="flex:1;min-width:0;">
    <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 6px;">${brand}</p>
    <h2 style="font-size:17px;font-weight:700;margin:0 0 10px;line-height:1.4;color:#f0f0f0;">${name}</h2>
    ${sparkline ? `<p style="font-size:12px;color:#888;margin:0 0 8px;font-family:'JetBrains Mono',ui-monospace,monospace;">Price trend (${YEAR}) ${sparkline}</p>` : ''}
    ${trackNote ? `<p style="font-size:12px;color:#888;margin:0 0 10px;font-style:italic;">${trackNote}</p>` : ''}
    <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
       style="display:inline-block;background:#e67e22;color:#140a02;text-decoration:none;font-size:14px;font-weight:700;padding:9px 20px;border-radius:4px;">
      Check price on Amazon →
    </a>
  </div>
</div>
${scorecardHTML ? `<div style="flex:1;min-width:300px;">${scorecardHTML.replace('margin:24px 0;', 'margin:0;')}</div>` : ''}
</div>

${galleryHTML}

${prosConsBlock(pros, cons)}

${stacksUpHTML}

${featuresHTML ? `<h2 style="font-size:20px;font-weight:700;margin:28px 0 10px;color:#f0f0f0;">What Makes This Stand Out</h2>\n${featuresHTML}` : ''}

${kitchenHTML}

${specsExplHTML}

<h2 id="who-for" style="font-size:20px;font-weight:700;margin:28px 0 10px;color:#f0f0f0;">Who Should Buy This?</h2>
${whoHTML}

${cantTellYouBlock(catLabel)}

${specsAccHTML}

${reviewsHTML}

${methodologyBlock(methodCtx)}

<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-left:3px solid #e67e22;border-radius:0 6px 6px 0;padding:14px 20px;margin:24px 0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
  <div style="flex:1;min-width:180px;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#e67e22;font-family:'JetBrains Mono',ui-monospace,monospace;">Track this price automatically</p>
    <p style="margin:4px 0 0;font-size:13px;color:#888;">Get an email when this product hits its lowest tracked price on Amazon India.</p>
  </div>
  <a href="/get-price-alerts/" style="display:inline-block;background:#e67e22;color:#140a02;text-decoration:none;font-size:13px;font-weight:700;padding:9px 18px;border-radius:4px;white-space:nowrap;">
    Set up price alert →
  </a>
</div>

${telegramCTA()}

<div style="background:#1a1a1a;border:1px solid rgba(230,126,34,0.35);border-radius:6px;padding:16px 20px;margin:24px 0;">
  <p style="margin:0 0 10px;font-weight:700;font-size:15px;color:#f0f0f0;">Ready to buy or want to check the latest price?</p>
  <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#e67e22;color:#140a02;text-decoration:none;font-size:14px;font-weight:700;padding:9px 20px;border-radius:4px;">
    Check price on Amazon India →
  </a>
  <p style="margin:10px 0 0;font-size:12px;color:#5f5f5f;font-family:'JetBrains Mono',ui-monospace,monospace;">Amazon prices change frequently. Click to see the current price.</p>
</div>

${faqs.length ? `<h2 id="faq" style="font-size:20px;font-weight:700;margin:32px 0 12px;color:#f0f0f0;">Frequently Asked Questions</h2>
${faqs.map(([q, a]) => `<details style="border:1px solid #2a2a2a;border-radius:4px;margin-bottom:8px;background:#1a1a1a;">
  <summary style="padding:12px 16px;cursor:pointer;font-weight:600;font-size:14px;color:#f0f0f0;background:#1a1a1a;">${q}</summary>
  <div style="padding:12px 16px;font-size:14px;line-height:1.7;color:#c8c8c8;border-top:1px solid #2a2a2a;">${a}</div>
</details>`).join('\n')}` : ''}

${relatedLinks(asin, catSlug, slugIndex, catLabel)}

<hr style="margin:32px 0;border:none;border-top:1px solid #2a2a2a;">
<p style="font-size:13px;color:#888;font-family:'JetBrains Mono',ui-monospace,monospace;">
  <a href="/best-${catSlug}/" style="color:#e67e22;font-weight:600;">← Compare all ${catLabel}s in India ${YEAR}</a>
</p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
</script>`)
}

async function main() {
  const args      = process.argv.slice(2)
  const dryRun    = args.includes('--dry-run')
  const catFilter = args.includes('--cat') ? args[args.indexOf('--cat') + 1] : null
  const asinFilter = args.includes('--asin') ? String(args[args.indexOf('--asin') + 1]).toUpperCase() : null
  const limit     = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) || 9999 : 9999

  if (!WP || !USER || !PASS) { console.error('Missing WP credentials in .env'); process.exit(1) }
  if (!fs.existsSync(QUEUE_FILE)) { console.error('Run content-opportunity-engine.js first'); process.exit(1) }

  const productIndex = loadProducts(KITCHEN, PRODS_DIR)
  const byCat = {}
  for (const p of Object.values(productIndex)) (byCat[p._catSlug] = byCat[p._catSlug] || []).push(p)
  const slugIndex = buildSlugIndex(JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')))

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))
    .filter(o => o.type === 'review')
    .filter(o => !catFilter || o.category === catFilter)
    .filter(o => !asinFilter || String(o.asin).toUpperCase() === asinFilter)
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
    // Slug: readable name-based e.g. ninja-air-fryer-max-pro-6-2l-review
    const _ns0 = name
      .replace(/\s*[\[(][^\])]*/g, '')    // strip (AF180IN...) and [...]
      .replace(/\s*[|\\].*/g, '')         // strip at pipe separator
      .trim()
    // Strip at wattage only if ≥3 words remain after the strip
    const _nsW = _ns0.replace(/\s+\d+\s*W\b.*/i, '').trim()
    const nameForSlug = (_nsW.split(/\s+/).length >= 3 ? _nsW : _ns0)
      .split(/\s+/).slice(0, 6).join(' ')
    const slug    = `${slugify(nameForSlug)}-review`
    const rawName = name.replace(/\s*[\\|,].*$/, '').trim()
    const short   = rawName.length > 55 ? rawName.substring(0, 52) + '…' : rawName
    const title   = `${short} Review — Worth Buying in India ${YEAR}?`

    try {
      const specs    = product.specifications || {}
      const seg      = product.price_segment || product._legacy?.price_segment || 'mid-range'
      const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
      const metaDesc = metaDescription(name, catLabel, specs, seg)
      const brandName = brand.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      const focusKw  = `${brandName} ${CAT_LABELS[catSlug] || catLabel} review`.toLowerCase()
      const html   = buildReviewHTML(product, catSlug, slugIndex, byCat[catSlug] || [])
      const lintHits = voiceLint(html)
      if (lintHits.length) console.warn(`  ⚠ voice lint [${slug}]: ${lintHits.map(h => h.match).join(', ')}`)
      const result = await wpUpsertPage({ title, slug, content: html }, { wp: WP, auth: AUTH, dryRun, metaDesc, focusKw, postType: 'posts', featuredMediaId: product.wp_image_id || null })
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
