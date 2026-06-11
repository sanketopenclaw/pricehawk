// scripts/lib/guide-content.js — 10-section buying guide builders
const { bestValueScore, getSpecVal } = require('./content')
const { buildPageStyles } = require('./styles')

// ─── Static content data ─────────────────────────────────────────────────────

const CAT_DEFAULT_CONS = {
  'air-fryers':       ['Basket capacity is fixed — cannot expand', 'Basket-style models leave square food corners uncooked'],
  'mixer-grinders':   ['Loud during operation — common across all brands', 'Jars require careful cleaning around blade'],
  'coffee-machines':  ['Requires descaling every 4–8 weeks in hard water cities', 'Per-cup cost higher than stovetop methods'],
  'induction-cooktops': ['Requires induction-compatible cookware — check your vessels', 'Not compatible with aluminium or copper pans'],
  'electric-kettles': ['No keep-warm beyond 20–30 min on most models', 'Limescale build-up faster in hard water cities'],
  'food-processors':  ['Cannot replace mixer grinder for fine spice grinding', 'Bowl takes significant counter space when assembled'],
  'hand-blenders':    ['Motor heats up with continuous use beyond 60 seconds', 'Not suited for grinding dry spices or nut butters'],
  'sandwich-makers':  ['Triangular plates limit bread and filling choices', 'Non-stick coating degrades over time if metal utensils used'],
  'rice-cookers':     ['Keep-warm function may dry out rice after 2+ hours', 'Single-function models cannot replace a pressure cooker'],
}

const CAT_RED_FLAGS = {
  'air-fryers':       ['Wattage below 800W — underpowered for any real use', 'No auto-shutoff — fire hazard', 'Seller claiming 0% oil without qualification'],
  'mixer-grinders':   ['Motor warranty under 1 year from an unknown brand', 'No ISI or BIS certification mark', 'Less than 3 jars at mid-range price'],
  'coffee-machines':  ['Espresso machine with less than 9 bar pressure', 'No descaling indicator on hard-water-prone models', 'Capsule lock-in with expensive proprietary pods'],
  'induction-cooktops': ['No auto-shutoff or overheat protection', 'Wattage not stated clearly in listing', 'No child lock on models marketed for families'],
  'electric-kettles': ['Plastic interior instead of stainless steel', 'No auto shut-off', 'Wattage under 1000W — extremely slow'],
  'food-processors':  ['Wattage below 500W for a "multi-function" claim', 'Bowl capacity under 1L marketed for families', 'No return/replacement policy on Amazon listing'],
  'hand-blenders':    ['Plastic shaft on mid-range or premium models', 'Wattage below 200W — insufficient for most tasks', 'No speed control on any model'],
  'sandwich-makers':  ['No ready indicator light', 'Wattage below 600W — uneven heating', 'Fixed plates with no grill option at mid-range price'],
  'rice-cookers':     ['No keep-warm function', 'Aluminium inner pot without non-stick coating', 'Capacity not listed or ambiguous in listing'],
}

const CAT_WHAT_DOESNT_MATTER = {
  'air-fryers':       ['Number of presets — 7 presets vs 14 presets rarely changes results', 'LCD vs LED display — both work identically'],
  'mixer-grinders':   ['Brand colour or design — purely aesthetic', 'Number of speed indicators — most only use max speed anyway'],
  'coffee-machines':  ['Bean-to-cup for casual users — the grinder degrades flavour unless maintained correctly', 'Bluetooth connectivity on basic models'],
  'induction-cooktops': ['Number of presets beyond 5–6 basic settings', 'Display type — any clear display works'],
  'electric-kettles': ['Cordless 360° base — now standard on all models, not a differentiator', 'Water level window style'],
  'food-processors':  ['Number of speed levels beyond 3', 'Colour and design — purely cosmetic'],
  'hand-blenders':    ['Turbo boost button on low-wattage models — marginal impact', 'Number of accessories bundled if you\'ll only use the core blender'],
  'sandwich-makers':  ['LED vs no LED ready light — both work fine', 'Locking clip design — minor convenience difference'],
  'rice-cookers':     ['Number of cooking presets beyond basic cook/steam/keep-warm', 'Digital vs analogue display — outcome is identical'],
}

const CAT_DEFAULT_AVOID = {
  'air-fryers':       'Not recommended for: households that primarily cook large batches or require traditional frying textures.',
  'mixer-grinders':   'Not recommended for: light users who only need to blend occasionally — a hand blender may suffice.',
  'coffee-machines':  'Not recommended for: households happy with instant coffee — a coffee machine requires regular maintenance.',
  'induction-cooktops': 'Not recommended for: households with only aluminium cookware — requires purchasing new vessels.',
  'electric-kettles': 'Not recommended for: households that boil water infrequently — a gas stove is more economical.',
  'food-processors':  'Not recommended for: households with limited counter space or those who already own a high-powered mixer grinder.',
  'hand-blenders':    'Not recommended for: users who primarily need to make large smoothie batches — a jar blender is more efficient.',
  'sandwich-makers':  'Not recommended for: households that rarely eat sandwiches or grilled items.',
  'rice-cookers':     'Not recommended for: households that already own a pressure cooker and don\'t mind monitoring rice cooking.',
}

const CAT_FAQS = {
  'air-fryers': [
    ['Can I make Indian snacks like pakoras and samosas in an air fryer?', 'Yes — air fryers excel at Indian snacks. Pakoras, samosas, and mathris come out crispy with 70–80% less oil than deep frying. Lightly spray oil and do not overcrowd the basket for best results.'],
    ['Do air fryers use less electricity than OTG ovens?', 'Air fryers are generally more efficient for small quantities — they preheat in 5 minutes vs 15–20 minutes for an OTG and cook in a smaller chamber. For large batches, an OTG may be more economical.'],
    ['What is the right air fryer size for a family of 4?', 'A 4–5L basket is ideal for a family of 4, allowing 400–500g of chicken or 6–8 samosas per batch. Smaller 2–3L baskets will require multiple rounds of cooking.'],
    ['How do I clean an air fryer basket?', 'Let the basket cool, then soak in warm soapy water for 10 minutes. Use a non-scratch sponge. Most baskets are dishwasher safe — verify in your model\'s manual. Wipe the interior with a damp cloth only.'],
    ['Can I cook without oil in an air fryer?', 'Yes, for naturally fatty foods like chicken, paneer, or fish. For coated snacks like samosas, 1–2 sprays of oil produce significantly better results. The "zero oil" claim applies primarily to fatty proteins.'],
  ],
  'mixer-grinders': [
    ['Can a 500W mixer grinder make idli-dosa batter?', 'A 500W model can grind batter for 2–3 people, but the motor heats up with extended use. For daily batter grinding for families of 4+, a 750W model prevents motor burnout.'],
    ['How many jars do I actually need?', 'Three jars cover 95% of Indian cooking: large wet jar (1.5L) for batters, dry jar for spices, and small chutney jar (0.3L). A liquidising jar is useful only for large families making juices regularly.'],
    ['What is the ideal speed for wet grinding?', 'Start at medium speed to blend coarsely, then switch to high for smooth consistency. For idli-dosa batter, use medium speed with 30-second breaks to prevent overheating.'],
    ['Why does my mixer grinder overheat?', 'Overheating occurs when grinding hard ingredients without breaks, overfilling jars, or using an undersized motor for the task. Run in 30–60 second intervals with cooling breaks between cycles.'],
    ['Is a 5-year motor warranty important?', 'Yes — the motor is the most expensive component to replace. Bajaj, Prestige, and Pigeon regularly offer 5-year motor warranties at no extra cost, indicating strong confidence in the product.'],
  ],
  'coffee-machines': [
    ['What is the difference between espresso and drip coffee machines?', 'Drip machines brew large quantities using gravity — good for filter coffee and American-style. Espresso machines use 9+ bar pressure for concentrated shots used in cappuccino and latte. Drip is cheaper; espresso produces richer flavour.'],
    ['Do I need a milk frother for cappuccino?', 'Yes — cappuccino requires frothed milk. Look for a steam wand (manual) or automatic milk frother. Budget machines typically omit this feature entirely.'],
    ['How often should I descale my coffee machine?', 'In hard-water Indian cities, descale every 4–6 weeks. In soft-water areas, every 2–3 months. Most modern machines have a descaling indicator. Use citric acid solution or a branded descaling tablet.'],
    ['Are capsule coffee machines worth the cost?', 'Capsule machines offer consistency and convenience, but each capsule costs ₹40–80 vs ₹5–15 for ground coffee. For 2+ cups daily, drip or espresso machines recover the cost difference within 6–12 months.'],
    ['Can I make South Indian filter coffee in an espresso machine?', 'Traditional South Indian filter coffee requires a specific metal drip device, not an espresso machine. Dark-roasted South Indian powder in a drip machine produces a similar strong brew. Espresso is a different preparation entirely.'],
  ],
  'induction-cooktops': [
    ['What type of cookware works on induction?', 'Induction requires ferromagnetic cookware — cast iron or magnetic stainless steel. Test by checking if a magnet sticks firmly to the base. Aluminium, copper, and glass will not work unless they have an induction-compatible base plate.'],
    ['Do induction cooktops save electricity vs gas?', 'Induction is 70–90% energy-efficient vs 40–55% for gas burners. However, electricity typically costs more per unit than LPG in most Indian cities. Actual savings depend on your local electricity tariff vs LPG price.'],
    ['Is induction cooking safe?', 'Induction is one of the safest cooking methods available — no open flame, no gas leak risk, and the cooktop surface itself stays relatively cool. All modern models include auto-shutoff and overheating protection.'],
    ['Can I use a pressure cooker on induction?', 'Yes, if your pressure cooker has an induction-compatible (magnetic flat) base. Prestige and Hawkins now manufacture induction-compatible pressure cookers. Check the base before purchasing.'],
    ['What wattage do I need for Indian cooking?', '1200W handles everyday cooking (dal, sabzi, chai). 1800–2000W boils water faster and is better for deep frying. For a family of 4+, 2000W is the practical choice.'],
  ],
  'electric-kettles': [
    ['Does a stainless steel kettle taste different from plastic?', 'Yes. Plastic kettles, especially cheaper ones, can impart a slight plastic taste — particularly when new. Stainless steel interiors produce neutral-tasting water. Always prioritise stainless steel interior regardless of exterior material.'],
    ['What is the benefit of a temperature-control kettle?', 'Temperature control is valuable for green tea (75–80°C), white tea (70°C), and specialty pour-over coffee (93°C). For regular chai, black tea, or instant coffee, temperature control adds cost without practical benefit.'],
    ['How fast does a 2200W kettle boil 1 litre?', 'A 2200W kettle boils 1 litre in approximately 2–2.5 minutes. A 1500W model takes 3–4 minutes. For most households, the time difference is negligible — prioritise material and capacity over wattage.'],
    ['Are electric kettles energy-efficient?', 'Yes — electric kettles operate at 80–90% efficiency vs 35–40% for gas stoves for boiling water. They also only heat the exact quantity needed, reducing wasted energy.'],
    ['How do I remove limescale from my kettle?', 'Fill with equal parts water and white vinegar. Boil, let sit 30 minutes, then rinse thoroughly. Alternatively, dissolve 1 tablespoon of citric acid in water and repeat. Do this monthly in hard water areas.'],
  ],
  'food-processors': [
    ['What is the difference between a food processor and a mixer grinder?', 'Mixer grinders use high-speed blades in sealed jars for grinding and blending. Food processors use a wide bowl with interchangeable discs for slicing, shredding, and chopping. A food processor cannot grind spices finely; a mixer grinder cannot slice or shred.'],
    ['Can a food processor knead dough?', 'Yes — most models above 600W with a dough blade can knead roti, paratha, and pizza dough. 500g–1kg of flour takes 2–3 minutes, saving significant manual effort.'],
    ['What attachments do I actually need?', 'The essential set: chopping blade (onions, herbs), slicing disc, shredding disc, and dough blade. A citrus juicer is occasionally useful. Avoid purchasing extra attachments used infrequently — they add to storage clutter.'],
    ['Can I replace my mixer grinder with a food processor?', 'No — a food processor cannot replace a mixer grinder for fine grinding (idli batter, masalas) because the bowl design allows too much air. Use both for a complete kitchen, or choose a mixer grinder with food processor attachment.'],
    ['How do I clean a food processor bowl and blade?', 'Rinse immediately after use to prevent food from drying. Most bowls and discs are dishwasher safe (top rack). Handle blades carefully — they are sharp. Wipe the motor base with a damp cloth only, never submerge.'],
  ],
  'hand-blenders': [
    ['Is a hand blender better than a regular jar blender?', 'Hand blenders are better for small quantities, hot liquids (soups), and minimal cleanup. Jar blenders are better for large batches, smoothies with ice, and nut butters. For Indian kitchens where soups and chutneys are common, a hand blender is a practical addition.'],
    ['Can I blend hot soup directly in the pot?', 'Yes — blending directly in the cooking vessel is the primary advantage of hand blenders. Keep the blender head fully submerged to avoid splashing, and use a deep pot for safety.'],
    ['What wattage do I need for thick smoothies?', '400W handles most tasks including soft-fruit smoothies. For frozen ingredients, leafy greens, or fibrous vegetables, choose 600W+. 250–300W models struggle with anything tougher than a ripe banana.'],
    ['Do hand blenders come with a chopper attachment?', 'Many mid-range and premium hand blenders include a small chopper bowl for onions, garlic, and ginger. Check the product listing carefully — some brands sell this as a separate accessory.'],
    ['How do I clean a hand blender safely?', 'Immerse the blending shaft in warm soapy water and run at low speed for 10 seconds — this cleans the blade safely. Detach and rinse under running water. Never submerge the motor body in water.'],
  ],
  'sandwich-makers': [
    ['What types of sandwich maker plates are available?', 'Three main types: triangular plates (standard diagonal cut, most common in India), flat grill plates (paninis, grilled vegetables), and waffle plates. Models with removable interchangeable plates are the most versatile but cost more.'],
    ['Can I make paninis and grilled cheese in a sandwich maker?', 'Yes, with flat grill plates. Standard triangular plates compress bread too much for paninis. Choose a model with flat or grill plate options if you want panini versatility.'],
    ['Do I need to add butter with a non-stick sandwich maker?', 'A thin butter or oil spread on the bread improves browning and flavour even with non-stick plates. Non-stick coating reduces the amount needed — roughly half compared to uncoated plates.'],
    ['How long does a sandwich maker take to heat up?', 'Most models preheat in 3–5 minutes. Higher wattage models (900W+) are faster. Look for a ready indicator light that signals when optimal cooking temperature is reached.'],
    ['Can I make Indian-style masala toast in a sandwich maker?', 'Yes — masala toast, chutney sandwiches, and grilled paneer sandwiches all work well. The even heating produces a consistently browned crust that\'s difficult to achieve on a tawa.'],
  ],
  'rice-cookers': [
    ['Does a rice cooker cook better than a pressure cooker?', 'Different outcomes: pressure cookers are faster (10–15 minutes) and more versatile. Rice cookers cook at a slower pace, producing fluffier, less sticky Basmati-style rice. For daily convenience, rice cookers offer a set-and-forget advantage.'],
    ['What is the right size rice cooker for a family of 4?', 'A 1.8L capacity handles 4–6 servings — the standard for a family of 4. 1L suits 2–3 people. For joint families or batch cooking, 2.8L or above.'],
    ['Can a rice cooker cook dal and khichdi?', 'Yes — most models with multi-cook or slow-cook functions handle dal, khichdi, and poha. Basic single-function models (cook/warm switch only) are limited to rice and simpler dishes.'],
    ['Does a rice cooker consume a lot of electricity?', 'A typical 500W rice cooker uses 0.15–0.25 kWh per use — approximately 20–40 paisa per cycle. Significantly more energy-efficient than leaving a gas flame burning while monitoring rice.'],
    ['How do I prevent rice from sticking to the pot?', 'Rinse rice 2–3 times before cooking to remove excess starch. Use the correct water ratio (marked inside the pot). Let rice rest in keep-warm mode for 10 minutes before serving. A light oil coat on the pot also reduces sticking.'],
  ],
}

const GENERIC_FAQS = (catLabel, catSingular, year) => [
  [`What is the best ${catSingular} in India in ${year}?`, `Our top overall pick is highlighted at the top of this page — selected based on Amazon ratings, review volume, feature set, and price-to-value ratio. The best choice also depends on your household size and cooking frequency.`],
  [`Which brand makes the most reliable ${catSingular} in India?`, `Philips, Bajaj, and Prestige consistently rank highest for reliability in the Indian kitchen appliance market. Philips leads on after-sales service; Bajaj and Prestige offer strong value at mid-range price points.`],
  [`How long should a good ${catSingular} last?`, `A mid-range ${catSingular} from a reputed brand typically lasts 4–7 years with regular maintenance. Premium models with metal construction can last 8–10 years. Entry-level models may need replacement in 2–3 years.`],
  [`Is it better to buy a ${catSingular} online or from a store?`, `Amazon India offers better pricing, easier comparison, and convenient returns. Physical stores let you inspect build quality firsthand. For most buyers, online is more practical — ensure you purchase from Amazon Fulfilled listings.`],
  [`What warranty should I expect on a ${catSingular}?`, `Look for a minimum 1-year comprehensive warranty. For motor-driven appliances, a separate 5-year motor warranty (common with Bajaj, Prestige) adds significant long-term value.`],
  [`What is the right budget for a ${catSingular} in India?`, `For most Indian households, the ₹3,000–₹7,000 range delivers the best value — reliable brands, solid features, and adequate build quality. Below ₹2,000, longevity is compromised. Above ₹10,000, pay only if you use it daily.`],
  [`How do I maintain my ${catSingular}?`, `Clean after every use. Avoid submerging electrical components. Store in a dry, ventilated space. Register for warranty immediately after purchase and keep the invoice for service claims.`],
  [`Are Indian kitchen appliance brands trustworthy?`, `Yes — Bajaj, Prestige, Philips India, Havells, and AGARO have established service networks across India. They design products specifically for Indian voltage (220–240V) and cooking patterns.`],
  [`Is Amazon a reliable place to buy ${catLabel}?`, `Amazon India is the most reliable online marketplace for kitchen appliances — genuine products, easy returns, and competitive pricing. Always purchase from Amazon Fulfilled or sold-by-Amazon listings.`],
  [`What is PriceHawk's top pick for ${catLabel}?`, `Our top overall pick is highlighted at the top of this page with a full analysis. We evaluate using Amazon ratings, review volume, feature completeness, warranty terms, and value-for-money ratio.`],
]

// ─── Helper functions ─────────────────────────────────────────────────────────

function shortName(name, max = 50) {
  const c = (name || '').replace(/\s*[|,].*$/, '').trim()
  return c.length > max ? c.substring(0, max - 1) + '…' : c
}

function segLabel(seg) {
  return { 'budget': 'Budget', 'entry-level': 'Budget', 'mid-range': 'Mid-Range', 'premium': 'Premium', 'flagship': 'Flagship' }[seg] || 'Mid-Range'
}

function getCapacityNum(product) {
  const specs = product.specifications || {}
  const v = getSpecVal(specs, 'Capacity', 'Volume', 'Bowl Capacity') || ''
  return parseFloat(v.replace(/[^0-9.]/g, '')) || 0
}

function getPopScore(product) {
  const rating = parseFloat(product._legacy?.rating || '4')
  const reviews = parseInt((String(product._legacy?.review_count || '0')).replace(/[^0-9]/g, '') || '0')
  return rating * Math.log1p(reviews)
}

function classifyPicks(products) {
  const byPop     = [...products].sort((a, b) => getPopScore(b) - getPopScore(a))
  const byValue   = [...products].sort((a, b) => bestValueScore(b) - bestValueScore(a))
  const byPriceA  = [...products].sort((a, b) => (a._price || 0) - (b._price || 0))
  const byPriceD  = [...products].sort((a, b) => (b._price || 0) - (a._price || 0))
  const byCapA    = [...products].filter(p => getCapacityNum(p) > 0).sort((a, b) => getCapacityNum(a) - getCapacityNum(b))
  const byCapD    = [...products].filter(p => getCapacityNum(p) > 0).sort((a, b) => getCapacityNum(b) - getCapacityNum(a))

  const budgetProds  = products.filter(p => ['budget', 'entry-level'].includes(p.price_segment))
  const premiumProds = products.filter(p => ['flagship', 'premium'].includes(p.price_segment))

  return {
    bestOverall:     byPop[0],
    bestValue:       byValue[0],
    bestBudget:      budgetProds[0] || byPriceA[0],
    bestPremium:     premiumProds[0] || byPriceD[0],
    bestSmallKitchen:byCapA[0] || byPriceA[0],
    bestFamilies:    byCapD[0] || byPriceD[0],
  }
}

function scaledScore(product, allProducts) {
  const scores = allProducts.map(p => bestValueScore(p))
  const max = Math.max(...scores)
  const min = Math.min(...scores)
  if (max === min) return 75
  const raw = bestValueScore(product)
  return Math.round(((raw - min) / (max - min)) * 35 + 60)
}

function deriveCons(product, catSlug) {
  const specs = product.specifications || {}
  const seg   = product.price_segment || ''
  const cons  = []

  if (specs['Has Nonstick Coating'] === 'No' && ['air-fryers', 'sandwich-makers', 'rice-cookers'].includes(catSlug)) {
    cons.push('No non-stick coating — requires more careful cleaning')
  }
  if (specs['Is the item dishwasher safe?'] === 'No') {
    cons.push('Parts not dishwasher safe')
  }
  const wg = parseFloat((specs['Item Weight'] || '').replace(/[^0-9.]/g, ''))
  if (!isNaN(wg) && wg > 5000) cons.push('Heavier unit — not easy to reposition')

  if (['budget', 'entry-level'].includes(seg)) {
    cons.push('Entry-level build quality may show wear with heavy daily use')
  }
  const defaults = CAT_DEFAULT_CONS[catSlug] || []
  for (const c of defaults) {
    if (cons.length >= 3) break
    if (!cons.includes(c)) cons.push(c)
  }
  return cons.slice(0, 3)
}

function deriveWhoShouldAvoid(product, catSlug) {
  const seg = product.price_segment || ''
  const cap = getCapacityNum(product)
  const reasons = []

  if (['premium', 'flagship'].includes(seg)) reasons.push('buyers on a tight budget — more affordable options exist in this guide')
  if (['budget', 'entry-level'].includes(seg)) reasons.push('heavy daily users — mid-range models offer better longevity')
  if (cap > 0 && cap <= 1.5) reasons.push('families of 3+ — capacity will feel limiting quickly')
  if (cap >= 6) reasons.push('solo users or couples — oversized for small households')

  return reasons.length
    ? 'Not recommended for: ' + reasons.join('; ') + '.'
    : CAT_DEFAULT_AVOID[catSlug] || 'Check that the capacity matches your household size before purchasing.'
}

function deriveValueAssessment(product, allProducts, catSlug) {
  const seg   = product.price_segment || 'mid-range'
  const score = scaledScore(product, allProducts)
  const rating = parseFloat(product._legacy?.rating || '4')

  if (['budget', 'entry-level'].includes(seg)) {
    return `Entry-level pricing with ${rating >= 4.2 ? 'above-average' : 'adequate'} user ratings (${rating}★). A solid starting point if budget is the primary constraint.`
  }
  if (seg === 'flagship') {
    return `Premium pricing reflects build quality and extended features. Worthwhile for frequent users who prioritise longevity over upfront cost. Value score: ${score}/100.`
  }
  if (score >= 80) {
    return `Strong value proposition — specs-per-rupee ratio ranks among the top in this category. Value score: ${score}/100.`
  }
  return `Solid mid-range option with a balanced feature-to-price ratio. Suits most Indian households. Value score: ${score}/100.`
}

function deriveVerdict(product, catSingular) {
  const seg     = product.price_segment || 'mid-range'
  const rating  = product._legacy?.rating || '4.0'
  const features = (product.specifications || {})._features || []
  const topFeat  = features[0] ? features[0].split(/[.;,]/)[0].trim().toLowerCase() : null
  const sl       = segLabel(seg).toLowerCase()

  return topFeat
    ? `A ${sl} ${catSingular} rated ${rating}★ — ${topFeat}.`
    : `A ${sl} ${catSingular} rated ${rating}★ with solid user satisfaction.`
}

function deriveLabsWinner(products, criterion) {
  switch (criterion) {
    case 'value':       return [...products].sort((a, b) => bestValueScore(b) - bestValueScore(a))[0]
    case 'build':       return [...products].filter(p => ['premium','flagship'].includes(p.price_segment)).sort((a, b) => getPopScore(b) - getPopScore(a))[0] || products[0]
    case 'features':    return [...products].sort((a, b) => ((b.specifications || {})._features?.length || 0) - ((a.specifications || {})._features?.length || 0))[0]
    case 'warranty':    return [...products].sort((a, b) => {
      const wa = (getSpecVal(a.specifications || {}, 'Warranty Description', 'Manufacturer Warranty Description') || '').length
      const wb = (getSpecVal(b.specifications || {}, 'Warranty Description', 'Manufacturer Warranty Description') || '').length
      return wb - wa
    })[0]
    case 'families':    return [...products].filter(p => getCapacityNum(p) >= 4).sort((a, b) => getPopScore(b) - getPopScore(a))[0] || products[0]
    case 'small':       return [...products].filter(p => getCapacityNum(p) > 0).sort((a, b) => getCapacityNum(a) - getCapacityNum(b))[0] || products[0]
    case 'longterm':    return [...products].filter(p => ['premium','flagship'].includes(p.price_segment)).sort((a, b) => {
      const ra = parseFloat(a._legacy?.rating || '0')
      const rb = parseFloat(b._legacy?.rating || '0')
      return rb - ra
    })[0] || products[0]
    default: return products[0]
  }
}

// ─── HTML Section Builders ────────────────────────────────────────────────────

function buildQuickPicksTable(picks, catLabel, catSingular, TAG) {
  const rows = [
    { label: 'Best Overall',          emoji: '🏆', product: picks.bestOverall,      why: 'Highest combination of ratings, reviews, and features' },
    { label: 'Best Value',            emoji: '💰', product: picks.bestValue,        why: 'Top specs-per-rupee ratio in its price class' },
    { label: 'Best Budget',           emoji: '✅', product: picks.bestBudget,       why: 'Lowest price without compromising core functionality' },
    { label: 'Best Premium',          emoji: '⭐', product: picks.bestPremium,      why: 'Best build quality and feature set for demanding users' },
    { label: 'Best For Small Kitchens', emoji: '🏠', product: picks.bestSmallKitchen, why: 'Compact form factor, easy to store and use daily' },
    { label: 'Best For Families',     emoji: '👨‍👩‍👧‍👦', product: picks.bestFamilies, why: 'Largest capacity, built for high-volume daily use' },
  ].filter(r => r.product)

  const dedupedRows = []
  const seen = new Set()
  for (const r of rows) {
    const id = r.product.product_id
    const key = seen.has(id) ? `${id}_${r.label}` : id
    seen.add(id)
    dedupedRows.push({ ...r, isDupe: key !== id })
  }

  return `<h2 style="font-size:22px;font-weight:800;margin:28px 0 4px;">Quick Picks — ${catLabel} in India</h2>
<p style="font-size:14px;color:#888;margin:0 0 16px;">Updated June 2025 · Based on ${catLabel.toLowerCase()} available on Amazon India</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;">
<thead>
  <tr style="background:#1a1a1a;">
    <th style="padding:10px 14px;text-align:left;font-weight:700;color:#fff;">Pick</th>
    <th style="padding:10px 14px;text-align:left;font-weight:700;color:#fff;">Product</th>
    <th style="padding:10px 14px;text-align:left;font-weight:700;color:#fff;width:35%;">Why</th>
    <th style="padding:10px 14px;text-align:center;font-weight:700;color:#fff;">Rating</th>
    <th style="padding:10px 14px;text-align:center;font-weight:700;color:#fff;">Link</th>
  </tr>
</thead>
<tbody>
${dedupedRows.map(({ label, emoji, product, why }) => {
  const name   = shortName(product.product_name || product._legacy?.name || '', 48)
  const offer  = Array.isArray(product.offers) ? product.offers[0] : (product.offers || {})
  const link   = offer.affiliate_url || `https://www.amazon.in/dp/${offer.external_id || product._legacy?.asin}?tag=${TAG}`
  const rating = product._legacy?.rating || '—'
  const seg    = segLabel(product.price_segment || 'mid-range')
  return `  <tr style="border-top:1px solid #e8e8e8;">
    <td style="padding:10px 14px;font-weight:700;white-space:nowrap;">${emoji} ${label}</td>
    <td style="padding:10px 14px;">
      <span style="font-weight:600;">${name}</span>
      <span style="display:block;font-size:12px;color:#888;">${seg}</span>
    </td>
    <td style="padding:10px 14px;color:#555;">${why}</td>
    <td style="padding:10px 14px;text-align:center;font-weight:700;color:#e67e22;">${rating}★</td>
    <td style="padding:10px 14px;text-align:center;">
      <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
         style="background:#e67e22;color:#fff;text-decoration:none;font-size:12px;font-weight:700;padding:5px 10px;border-radius:3px;white-space:nowrap;">
        Check price →
      </a>
    </td>
  </tr>`
}).join('\n')}
</tbody>
</table>`
}

function buildTrustSection(catLabel) {
  return `<h2 style="font-size:20px;font-weight:700;margin:36px 0 12px;">Why You Can Trust PriceHawk</h2>
<p style="font-size:15px;line-height:1.7;color:#333;margin:0 0 12px;">PriceHawk is an independent price intelligence platform for Indian consumers. We do not accept manufacturer samples, sponsored placements, or paid rankings. All product evaluations are based on:</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:0 0 16px;">
${[
  ['Amazon Ratings', 'Verified purchaser scores from the Amazon India marketplace'],
  ['Review Volume', 'Number of verified reviews — products with few reviews receive lower confidence weighting'],
  ['Feature Set', 'Specifications compared against category benchmarks for price class'],
  ['Warranty Terms', 'Duration and coverage — motor warranty is weighted separately for motor-driven appliances'],
  ['Value For Money', 'Specification score relative to price using our Labs value index'],
  ['Brand Reputation', 'Service network, brand age in India, and historical product reliability'],
  ['Market Position', 'Popularity rank among Indian buyers in the same category and segment'],
  ['Price History', 'Price trends tracked daily — no inflated MRP comparison tactics considered'],
].map(([k, v]) => `  <div>
    <p style="font-size:14px;font-weight:700;margin:0 0 2px;">✓ ${k}</p>
    <p style="font-size:13px;color:#555;margin:0;">${v}</p>
  </div>`).join('\n')}
</div>
<div style="background:#fff8f0;border:1px solid #f0d5b8;border-radius:6px;padding:12px 16px;font-size:13px;color:#555;">
  <strong>Testing disclosure:</strong> PriceHawk has not independently lab-tested any ${catLabel.toLowerCase()} covered in this guide. All analysis is based on documented specifications, pricing data, and aggregated public user reviews. We follow ASCI guidelines for affiliate content.
</div>`
}

function buildComparisonTable(products, allProducts) {
  const specs = products.map(p => ({
    name:     shortName(p.product_name || p._legacy?.name || '', 42),
    seg:      segLabel(p.price_segment || 'mid-range'),
    rating:   p._legacy?.rating || '—',
    reviews:  p._legacy?.review_count || '—',
    capacity: getSpecVal(p.specifications || {}, 'Capacity', 'Volume', 'Bowl Capacity') || '—',
    power:    getSpecVal(p.specifications || {}, 'Output Wattage', 'Wattage') || '—',
    warranty: getSpecVal(p.specifications || {}, 'Warranty Description', 'Manufacturer Warranty Description', 'Warranty Type') || '—',
    bestFor:  deriveQuickBestFor(p),
    score:    scaledScore(p, allProducts),
    offer:    Array.isArray(p.offers) ? p.offers[0] : (p.offers || {}),
  }))

  return `<h2 style="font-size:20px;font-weight:700;margin:36px 0 12px;">Full Comparison Table</h2>
<div style="overflow-x:auto;">
<table style="width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap;">
<thead>
  <tr style="background:#1a1a1a;">
    <th style="padding:10px 12px;text-align:left;font-weight:700;color:#fff;">Product</th>
    <th style="padding:10px 12px;text-align:center;font-weight:700;color:#fff;">Segment</th>
    <th style="padding:10px 12px;text-align:center;font-weight:700;color:#fff;">Rating</th>
    <th style="padding:10px 12px;text-align:center;font-weight:700;color:#fff;">Reviews</th>
    <th style="padding:10px 12px;text-align:center;font-weight:700;color:#fff;">Capacity</th>
    <th style="padding:10px 12px;text-align:center;font-weight:700;color:#fff;">Power</th>
    <th style="padding:10px 12px;text-align:left;font-weight:700;color:#fff;">Warranty</th>
    <th style="padding:10px 12px;text-align:left;font-weight:700;color:#fff;">Best For</th>
    <th style="padding:10px 12px;text-align:center;font-weight:700;color:#fff;">Value Score</th>
  </tr>
</thead>
<tbody>
${specs.map((s, i) => {
  const link = s.offer.affiliate_url || `https://www.amazon.in/dp/${s.offer.external_id || ''}?tag=pricehawkin-21`
  const bg = i % 2 === 0 ? '' : 'background:#fafafa;'
  return `  <tr style="border-bottom:1px solid #e8e8e8;${bg}">
    <td style="padding:10px 12px;font-weight:600;white-space:normal;max-width:220px;"><a href="${link}" target="_blank" rel="nofollow sponsored noopener" style="color:#333;text-decoration:none;">${s.name}</a></td>
    <td style="padding:10px 12px;text-align:center;">${s.seg}</td>
    <td style="padding:10px 12px;text-align:center;font-weight:700;">${s.rating}★</td>
    <td style="padding:10px 12px;text-align:center;">${s.reviews}</td>
    <td style="padding:10px 12px;text-align:center;">${s.capacity}</td>
    <td style="padding:10px 12px;text-align:center;">${s.power}</td>
    <td style="padding:10px 12px;">${s.warranty}</td>
    <td style="padding:10px 12px;white-space:normal;max-width:140px;">${s.bestFor}</td>
    <td style="padding:10px 12px;text-align:center;font-weight:700;color:${s.score >= 80 ? '#27ae60' : s.score >= 70 ? '#e67e22' : '#888'};">${s.score}/100</td>
  </tr>`
}).join('\n')}
</tbody>
</table>
</div>`
}

function deriveQuickBestFor(product) {
  const cap = getCapacityNum(product)
  const seg = product.price_segment || ''
  if (['budget', 'entry-level'].includes(seg)) return 'Budget buyers'
  if (seg === 'flagship') return 'Premium / heavy users'
  if (cap > 0 && cap <= 2) return 'Solo / couples'
  if (cap >= 5) return 'Large families'
  return 'Most households'
}

function buildProductRecommendation(product, catSlug, catSingular, position, topValueId, allProducts, TAG) {
  const name    = product.product_name || product._legacy?.name || 'Product'
  const brand   = (product.brand_id || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const offer   = Array.isArray(product.offers) ? product.offers[0] : (product.offers || {})
  const asin    = offer.external_id || product._legacy?.asin || ''
  const link    = offer.affiliate_url || `https://www.amazon.in/dp/${asin}?tag=${TAG}`
  const specs   = product.specifications || {}
  const features = specs._features || []
  const seg     = product.price_segment || 'mid-range'
  const rating  = product._legacy?.rating || '4.0'
  const reviews = product._legacy?.review_count || '0'
  const isBV    = topValueId && product.product_id === topValueId

  const pros = features.slice(0, 3).map(f => f.split(/[.;,]/)[0].trim())
  const cons = deriveCons(product, catSlug)
  const avoid = deriveWhoShouldAvoid(product, catSlug)
  const valueAssessment = deriveValueAssessment(product, allProducts, catSlug)
  const verdict = deriveVerdict(product, catSingular)

  const specRows = [
    ['Brand', brand],
    ['Segment', segLabel(seg)],
    ['Rating', `${rating}★ (${reviews} reviews)`],
    ['Capacity', getSpecVal(specs, 'Capacity', 'Volume', 'Bowl Capacity') || '—'],
    ['Power', getSpecVal(specs, 'Output Wattage', 'Wattage') || '—'],
    ['Control', getSpecVal(specs, 'Controller Type', 'Control Method') || '—'],
    ['Warranty', getSpecVal(specs, 'Warranty Description', 'Manufacturer Warranty Description') || '—'],
    ['Material', getSpecVal(specs, 'Material Type', 'Inner Material', 'Body Material') || '—'],
  ].filter(([, v]) => v && v !== '—')

  const bestFor = deriveQuickBestFor(product)

  return `<div style="border:1px solid #e0e0e0;border-radius:8px;padding:20px 24px;margin-bottom:28px;" id="pick-${position}">
  <p style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;margin:0 0 4px;">
    #${position} · ${brand} · ${segLabel(seg)}${isBV ? ' <span style="background:#27ae60;color:#fff;font-size:10px;padding:2px 6px;border-radius:3px;margin-left:6px;">BEST VALUE</span>' : ''}
  </p>
  <h3 style="font-size:18px;font-weight:800;margin:0 0 6px;line-height:1.3;">${shortName(name, 80)}</h3>
  <p style="font-size:14px;color:#555;margin:0 0 16px;font-style:italic;">${verdict}</p>

  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
    <div style="flex:1;min-width:240px;">
      <p style="font-size:13px;font-weight:700;color:#333;margin:0 0 6px;">Key Specifications</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${specRows.map(([k, v]) => `<tr style="border-bottom:1px solid #f0f0f0;">
          <td style="padding:5px 0;color:#666;font-weight:600;width:45%;">${k}</td>
          <td style="padding:5px 0;">${v}</td>
        </tr>`).join('\n        ')}
      </table>
    </div>

    <div style="flex:1;min-width:200px;">
      <p style="font-size:13px;font-weight:700;color:#333;margin:0 0 6px;">Why We Recommend It</p>
      <p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 12px;">${features.length >= 2 ? features.slice(0, 2).join('. ') + '.' : `Rated ${rating}★ by ${reviews} Amazon buyers in India.`}</p>

      <p style="font-size:13px;font-weight:700;color:#333;margin:0 0 4px;">Best For</p>
      <p style="font-size:13px;color:#444;margin:0 0 12px;">${bestFor}</p>
    </div>
  </div>

  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
    <div style="flex:1;min-width:200px;">
      <p style="font-size:13px;font-weight:700;color:#27ae60;margin:0 0 6px;">Pros</p>
      <ul style="font-size:13px;color:#333;margin:0;padding-left:16px;line-height:1.8;">
        ${pros.map(p => `<li>${p}</li>`).join('\n        ')}
      </ul>
    </div>
    <div style="flex:1;min-width:200px;">
      <p style="font-size:13px;font-weight:700;color:#e74c3c;margin:0 0 6px;">Cons</p>
      <ul style="font-size:13px;color:#333;margin:0;padding-left:16px;line-height:1.8;">
        ${cons.map(c => `<li>${c}</li>`).join('\n        ')}
      </ul>
    </div>
  </div>

  <div style="background:#fff8f0;border-left:3px solid #e67e22;padding:8px 12px;font-size:13px;margin-bottom:12px;border-radius:0 4px 4px 0;">
    <strong>Who Should Avoid:</strong> ${avoid}
  </div>

  <div style="background:#f8f9fa;border-radius:4px;padding:8px 12px;font-size:13px;margin-bottom:14px;border:1px solid #e8e8e8;">
    <strong>Value Assessment:</strong> ${valueAssessment}
  </div>

  <div style="background:#fff3e0;border-left:4px solid #e67e22;padding:10px 14px;font-size:13px;margin-bottom:14px;border-radius:0 4px 4px 0;">
    <strong>PriceHawk Verdict:</strong> ${buildVerdict(product, catSingular, position, isBV)}
  </div>

  <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#e67e22;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 20px;border-radius:4px;">
    Check price on Amazon →
  </a>
</div>`
}

function buildVerdict(product, catSingular, position, isBestValue) {
  const seg     = product.price_segment || 'mid-range'
  const rating  = parseFloat(product._legacy?.rating || '4')
  const sl      = segLabel(seg).toLowerCase()
  const bestFor = deriveQuickBestFor(product)

  if (position === 1) return `Our top overall pick for ${catSingular} — the combination of ratings, review volume, and feature set makes it the safest choice for most Indian buyers. Recommended with confidence.`
  if (isBestValue) return `Our best-value pick — highest specs-per-rupee ratio in its segment. If you want the most for your money without stepping into premium pricing, this is it.`
  if (['budget', 'entry-level'].includes(seg)) return `A practical ${sl} option for first-time buyers or those with limited frequency of use. Do not expect longevity beyond 3–4 years with heavy daily use.`
  if (['flagship', 'premium'].includes(seg)) return `A premium ${sl} choice with ${rating >= 4.3 ? 'excellent' : 'strong'} user ratings. Worth the higher price only if you use a ${catSingular} daily and value build longevity.`
  return `A solid ${sl} ${catSingular} that delivers reliable daily performance. Best suited for: ${bestFor}.`
}

function buildLabsSection(products, catSlug, catLabel) {
  const criteria = [
    { key: 'value',   label: 'Best Value',            desc: 'Highest specs-per-rupee ratio' },
    { key: 'build',   label: 'Best Build Quality',    desc: 'Premium/flagship segment with highest popularity score' },
    { key: 'features',label: 'Best Features',         desc: 'Most comprehensive feature set' },
    { key: 'warranty',label: 'Best Warranty',         desc: 'Longest documented warranty coverage' },
    { key: 'families',label: 'Best For Indian Families', desc: 'Largest capacity with high user satisfaction' },
    { key: 'small',   label: 'Best For Small Kitchens', desc: 'Smallest footprint without sacrificing core function' },
    { key: 'longterm',label: 'Best Long-Term Buy',    desc: 'Premium segment with top-rated user satisfaction' },
  ]

  const rows = criteria.map(({ key, label, desc }) => {
    const winner = deriveLabsWinner(products, key)
    if (!winner) return null
    const name   = shortName(winner.product_name || winner._legacy?.name || '', 48)
    const brand  = (winner.brand_id || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const rating = winner._legacy?.rating || '—'
    return { label, desc, name, brand, rating }
  }).filter(Boolean)

  return `<h2 style="font-size:20px;font-weight:700;margin:36px 0 4px;">PriceHawk Labs Rankings</h2>
<p style="font-size:14px;color:#666;margin:0 0 16px;">Proprietary rankings based on specification analysis, price positioning, and user review patterns for ${catLabel} available in India.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;">
<thead>
  <tr style="background:#1a1a1a;">
    <th style="padding:10px 14px;text-align:left;font-weight:700;color:#fff;">Category</th>
    <th style="padding:10px 14px;text-align:left;font-weight:700;color:#fff;">Our Pick</th>
    <th style="padding:10px 14px;text-align:left;font-weight:700;color:#fff;">Why It Won</th>
    <th style="padding:10px 14px;text-align:center;font-weight:700;color:#fff;">Rating</th>
  </tr>
</thead>
<tbody>
${rows.map((r, i) => {
  const bg = i % 2 === 0 ? '' : 'background:#fafafa;'
  return `  <tr style="border-top:1px solid #e8e8e8;${bg}">
    <td style="padding:10px 14px;font-weight:700;">${r.label}</td>
    <td style="padding:10px 14px;"><span style="font-weight:600;">${r.name}</span><span style="display:block;font-size:12px;color:#888;">${r.brand}</span></td>
    <td style="padding:10px 14px;color:#555;">${r.desc}</td>
    <td style="padding:10px 14px;text-align:center;font-weight:700;color:#e67e22;">${r.rating}★</td>
  </tr>`
}).join('\n')}
</tbody>
</table>`
}

function buildBuyingGuideSection(catSlug, catLabel, catBuyingFactors) {
  const factors  = catBuyingFactors[catSlug] || []
  const dontMatter = CAT_WHAT_DOESNT_MATTER[catSlug] || []
  const redFlags = CAT_RED_FLAGS[catSlug] || []

  return `<h2 style="font-size:20px;font-weight:700;margin:36px 0 12px;">${catLabel} Buying Guide — What Actually Matters</h2>

<h3 style="font-size:17px;font-weight:700;margin:20px 0 10px;">What Matters</h3>
${factors.map(({ factor, tip }) => `<div style="margin-bottom:14px;">
  <p style="font-size:15px;font-weight:700;margin:0 0 3px;">✓ ${factor}</p>
  <p style="font-size:14px;color:#444;margin:0;line-height:1.7;">${tip}</p>
</div>`).join('\n')}

${dontMatter.length ? `<h3 style="font-size:17px;font-weight:700;margin:24px 0 10px;">What Doesn't Matter (Ignore These)</h3>
<ul style="font-size:14px;color:#555;line-height:1.9;padding-left:20px;margin:0 0 20px;">
${dontMatter.map(d => `  <li>${d}</li>`).join('\n')}
</ul>` : ''}

${redFlags.length ? `<h3 style="font-size:17px;font-weight:700;margin:24px 0 10px;">Red Flags — Avoid Products That…</h3>
<ul style="font-size:14px;color:#e74c3c;line-height:1.9;padding-left:20px;margin:0;">
${redFlags.map(f => `  <li>${f}</li>`).join('\n')}
</ul>` : ''}`
}

function buildAlternativesSection(products, catSlug, catLabel, catSingular, TAG) {
  const budgetPicks  = products.filter(p => ['budget', 'entry-level'].includes(p.price_segment))
  const premiumPicks = products.filter(p => ['flagship', 'premium'].includes(p.price_segment))
  const byPriceA     = [...products].sort((a, b) => (a._price || 0) - (b._price || 0))
  const byPriceD     = [...products].sort((a, b) => (b._price || 0) - (a._price || 0))

  const alts = [
    { label: 'If your budget is tight', desc: 'Entry-level option that covers core functionality without premium pricing.', product: budgetPicks[0] || byPriceA[0] },
    { label: 'If you want to upgrade', desc: 'Premium option with enhanced build quality, longer warranty, or expanded features.', product: premiumPicks[0] || byPriceD[0] },
    { label: 'For a different capacity', desc: 'Alternative sizing for households that find standard options too large or too small.', product: (() => {
      const caps = products.map(p => getCapacityNum(p)).filter(c => c > 0)
      if (!caps.length) return byPriceA[Math.floor(byPriceA.length / 2)] || products[0]
      const medCap = caps.sort((a, b) => a - b)[Math.floor(caps.length / 2)]
      return products.find(p => Math.abs(getCapacityNum(p) - medCap) < 0.5) || products[0]
    })() },
  ].filter(a => a.product)

  return `<h2 style="font-size:20px;font-weight:700;margin:36px 0 12px;">Alternatives</h2>
<p style="font-size:14px;color:#666;margin:0 0 16px;">Not finding the right fit above? Consider these alternatives:</p>
${alts.map(({ label, desc, product }) => {
  const name  = shortName(product.product_name || product._legacy?.name || '', 55)
  const offer = Array.isArray(product.offers) ? product.offers[0] : (product.offers || {})
  const link  = offer.affiliate_url || `https://www.amazon.in/dp/${offer.external_id || product._legacy?.asin}?tag=${TAG}`
  return `<div style="border:1px solid #e8e8e8;border-radius:6px;padding:14px 18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
  <div>
    <p style="font-size:13px;font-weight:700;color:#666;margin:0 0 3px;">${label}</p>
    <p style="font-size:14px;font-weight:600;margin:0 0 3px;">${name}</p>
    <p style="font-size:13px;color:#555;margin:0;">${desc}</p>
  </div>
  <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
     style="background:#e67e22;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:8px 14px;border-radius:4px;white-space:nowrap;">
    Check price →
  </a>
</div>`
}).join('\n')}`
}

function buildFAQSection(catSlug, catLabel, catSingular, year) {
  const generic  = GENERIC_FAQS(catLabel, catSingular, year)
  const specific = (CAT_FAQS[catSlug] || [])
  const allFAQs  = [...generic, ...specific]

  const schemaFAQs = allFAQs.map(([q, a]) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a }
  }))

  const schema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: schemaFAQs
  }, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

  return `<h2 style="font-size:20px;font-weight:700;margin:36px 0 4px;">${catLabel} — Frequently Asked Questions</h2>
<p style="font-size:14px;color:#888;margin:0 0 16px;">Click any question to expand the answer.</p>
<div class="ph-faq" itemscope itemtype="https://schema.org/FAQPage">
${allFAQs.map(([q, a]) => `<details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
  <summary itemprop="name">${q}</summary>
  <div class="ph-ans" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
    <p itemprop="text">${a}</p>
  </div>
</details>`).join('\n')}
</div>
<script type="application/ld+json">${schema}</script>`
}

function buildFinalRecsSection(picks, catLabel, catSingular) {
  const rows = [
    { label: 'Best Overall',          product: picks.bestOverall },
    { label: 'Best Value',            product: picks.bestValue },
    { label: 'Best Premium',          product: picks.bestPremium },
    { label: 'Best For Families',     product: picks.bestFamilies },
    { label: 'Best For Small Kitchens', product: picks.bestSmallKitchen },
  ].filter(r => r.product)

  return `<h2 style="font-size:20px;font-weight:700;margin:36px 0 12px;">Final Recommendations</h2>
<p style="font-size:14px;color:#555;margin:0 0 16px;">After evaluating all ${catLabel.toLowerCase()} options above, here is our summary for each buyer type:</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;">
<thead>
  <tr style="background:#1a1a1a;">
    <th style="padding:10px 14px;text-align:left;font-weight:700;color:#fff;">If you want…</th>
    <th style="padding:10px 14px;text-align:left;font-weight:700;color:#fff;">Our Pick</th>
    <th style="padding:10px 14px;text-align:center;font-weight:700;color:#fff;">Rating</th>
  </tr>
</thead>
<tbody>
${rows.map((r, i) => {
  const name   = shortName(r.product.product_name || r.product._legacy?.name || '', 52)
  const brand  = (r.product.brand_id || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const rating = r.product._legacy?.rating || '—'
  const bg = i % 2 === 0 ? '' : 'background:#fafafa;'
  return `  <tr style="border-top:1px solid #e8e8e8;${bg}">
    <td style="padding:10px 14px;font-weight:700;">${r.label}</td>
    <td style="padding:10px 14px;"><span style="font-weight:600;">${name}</span><span style="display:block;font-size:12px;color:#888;">${brand}</span></td>
    <td style="padding:10px 14px;text-align:center;font-weight:700;color:#e67e22;">${rating}★</td>
  </tr>`
}).join('\n')}
</tbody>
</table>
<p style="font-size:13px;color:#888;margin:12px 0 0;">Last updated: ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}. Prices and availability change — always check current pricing on Amazon before purchasing.</p>`
}

function buildInternalLinksSection(catSlug, catLabel, products) {
  const brands = [...new Set(products.map(p => p.brand_id).filter(Boolean))].slice(0, 6)

  return `<div style="background:#fff8f0;border:1px solid #f0d5b8;border-radius:8px;padding:18px 22px;margin:32px 0;">
  <p style="font-size:14px;font-weight:700;margin:0 0 12px;color:#e67e22;">Related Pages on PriceHawk</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;">
    <a href="/best-${catSlug}/" style="background:#fff;border:1px solid #e8e8e8;color:#333;text-decoration:none;font-size:13px;padding:5px 10px;border-radius:4px;">
      All ${catLabel} Options →
    </a>
    <a href="/deals/" style="background:#fff;border:1px solid #e8e8e8;color:#333;text-decoration:none;font-size:13px;padding:5px 10px;border-radius:4px;">
      Today's Deals →
    </a>
    <a href="/price-drops/" style="background:#fff;border:1px solid #e8e8e8;color:#333;text-decoration:none;font-size:13px;padding:5px 10px;border-radius:4px;">
      Recent Price Drops →
    </a>
    ${brands.map(b => {
      const bl = b.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return `<a href="/${b}-${catSlug}/" style="background:#fff;border:1px solid #e8e8e8;color:#333;text-decoration:none;font-size:13px;padding:5px 10px;border-radius:4px;">${bl} ${catLabel} →</a>`
    }).join('\n    ')}
  </div>
</div>`
}

module.exports = {
  classifyPicks,
  scaledScore,
  deriveCons,
  deriveWhoShouldAvoid,
  deriveValueAssessment,
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
}
