/**
 * PriceHawk G2 — Product Review generator
 * Kitchen beachhead Phase 1. Pushes WP draft pages.
 * No scraped prices/images/ratings displayed — compliance by construction.
 *
 * Usage:
 *   node scripts/generate-reviews.js               # all Phase 1 reviews
 *   node scripts/generate-reviews.js --cat air-fryers
 *   node scripts/generate-reviews.js --dry-run
 *   node scripts/generate-reviews.js --limit 10    # first N per run
 */

require('dotenv').config()
const fs   = require('fs')
const path = require('path')
const axios = require('axios')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD
const AUTH = {
  Authorization: `Basic ${Buffer.from(`${USER}:${PASS}`).toString('base64')}`,
  'Content-Type': 'application/json',
}

const PRODS_DIR  = path.join(__dirname, '../data/products')
const QUEUE_FILE = path.join(__dirname, '../data/content/phase1_queue.json')
const YEAR = new Date().getFullYear()

const TAG = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'

// ── Category labels ──────────────────────────────────────────────────────────
const CAT_LABELS = {
  'air-fryers': 'Air Fryer', 'mixer-grinders': 'Mixer Grinder',
  'coffee-machines': 'Coffee Machine', 'induction-cooktops': 'Induction Cooktop',
  'electric-kettles': 'Electric Kettle', 'food-processors': 'Food Processor',
  'hand-blenders': 'Hand Blender', 'sandwich-makers': 'Sandwich Maker',
  'rice-cookers': 'Rice Cooker',
}

// ── Key buying signals per category ─────────────────────────────────────────
const CAT_SIGNALS = {
  'air-fryers': {
    good_for: 'oil-free cooking, crispy snacks, reheating',
    key_specs: ['capacity', 'wattage', 'presets', 'temperature'],
    faqs: [
      ['Is this air fryer good for Indian cooking?', 'Air fryers work well for Indian snacks like samosas, pakoras, and tandoori items. Most models reaching 200°C or above handle these well. Check the capacity to ensure it fits the quantities you cook.'],
      ['How much electricity does an air fryer use?', 'Most home air fryers (1200–1800W) cost approximately ₹4–8 per hour of use at standard Indian electricity rates. They are generally more energy-efficient than conventional ovens for small quantities.'],
      ['Does the capacity on the box match real usable space?', 'Marketed capacity includes the full basket volume. Usable cooking space is typically 60–70% of stated capacity. A "4.5L" air fryer realistically holds 2–3 servings at once.'],
      ['Can I use the air fryer without oil?', 'Yes — that is the primary use case. A light spray of oil on some foods (like samosas or breaded items) helps browning, but many foods (chips, frozen snacks, reheating) need none at all.'],
    ],
    verdict: {
      budget: 'A competitively priced option for households new to air frying. Covers the essentials and handles everyday Indian snacks.',
      'mid-range': 'A well-rounded choice for regular use. The capacity and power rating suit most Indian household cooking needs.',
      premium: 'A premium build with features for serious home cooks — larger capacity, precise temperature, and digital controls justify the price if you cook frequently.',
      flagship: 'Top-tier specification for households that cook multiple meals daily. Best suited to large families or frequent entertainers.',
    },
  },
  'mixer-grinders': {
    good_for: 'idli/dosa batter, chutneys, juicing, grinding spices',
    key_specs: ['wattage', 'jars', 'speed-settings', 'warranty'],
    faqs: [
      ['What wattage is enough for Indian cooking needs?', '500–750W handles most household grinding — chutneys, dry spices, idli batter for 4 people. 750W+ suits families grinding large batches of wet batter (idli/dosa) frequently.'],
      ['Are stainless steel jars better than polycarbonate?', 'Stainless steel is more durable, does not stain from turmeric, and is easier to clean thoroughly. Polycarbonate allows you to see the contents but can scratch and retain odours over time.'],
      ['What warranty should I look for?', 'Minimum 2 years on the motor, 1 year on jars and accessories. Indian brands like Preethi and Butterfly typically offer 5-year motor warranties on premium models.'],
      ['Can a mixer grinder make nut butters or ice cream?', 'Most standard mixer grinders are not designed for nut butters (require prolonged high-torque operation). For ice cream, use only machines specifically rated for frozen ingredients.'],
    ],
    verdict: {
      budget: 'An affordable entry point for light everyday use — chutneys and dry grinding. Adequate for smaller households.',
      'mid-range': 'The sweet spot for most Indian kitchens. Handles wet grinding for 4–6 people comfortably.',
      premium: 'Built for heavy daily use — large families, frequent batter grinding. Motor durability at this tier is significantly better.',
      flagship: 'Professional-grade power for demanding use. Overkill for most households but justifies cost for commercial-scale home cooking.',
    },
  },
  'coffee-machines': {
    good_for: 'espresso, filter coffee, drip coffee, milk frothing',
    key_specs: ['type', 'cups', 'pressure', 'milk-frother'],
    faqs: [
      ['Which type of coffee machine suits Indian tastes?', 'For South Indian filter coffee: stainless steel drip filters or South Indian-style percolators. For café-style espresso: pump machines (9+ bar). Capsule machines offer convenience but have ongoing pod costs.'],
      ['How often does a coffee machine need cleaning?', 'Daily rinse after each use. Monthly descaling is essential in India given hard water in most cities. Descaling neglect is the leading cause of machine failure within 2 years.'],
      ['Are pod/capsule machines worth it in India?', 'Capsule cost in India is ₹40–80 per cup versus ₹15–25 for ground coffee in a manual machine. Convenience is the main trade-off. Nespresso-compatible pods have the widest availability.'],
      ['What is bar pressure and does it matter?', 'Bar measures brewing pressure. True espresso requires 9 bar minimum. Machines labelled "1.5 bar" or similar produce strong coffee but not technically espresso — relevant if you want a proper espresso crema.'],
    ],
    verdict: {
      budget: 'Suitable for basic filter or drip coffee at home. A straightforward upgrade from instant powder.',
      'mid-range': 'Good daily driver for espresso-style drinks. The build quality at this tier lasts 3–5 years with regular descaling.',
      premium: 'Delivers consistent café-quality results. Worthwhile for households that currently spend ₹150+ per day at coffee shops.',
      flagship: 'Barista-level control for serious coffee enthusiasts. Pays for itself within 18 months for regular café visitors.',
    },
  },
  'induction-cooktops': {
    good_for: 'energy-efficient cooking, precise temperature control, safety',
    key_specs: ['wattage', 'presets', 'temperature-range', 'display'],
    faqs: [
      ['What cookware works on an induction cooktop?', 'Only ferromagnetic cookware — cast iron and most stainless steel. Test with a fridge magnet: if it sticks to the bottom, the cookware works. Aluminium, copper, and glass do not work.'],
      ['How much electricity does induction use versus gas?', 'Induction is 85–90% energy-efficient versus 40–55% for gas. In rupee terms, induction typically costs ₹5–8 per hour, which is lower than LPG per equivalent heat output at current Indian gas prices.'],
      ['Is induction safe for children in the kitchen?', 'The cooking surface does not get directly hot — only the cookware heats up. Residual heat from the pot can warm the surface, but there is no open flame or gas risk. Most models auto-shut off when cookware is removed.'],
      ['Can I cook on induction at full speed like a gas stove?', 'High-wattage induction (1800–2000W) heats faster than most domestic gas burners and offers instant power adjustment. Boiling water for chai or pressure cooking works well.'],
    ],
    verdict: {
      budget: 'Basic induction for everyday cooking. Covers boiling, sautéing, and simmering with compatible cookware.',
      'mid-range': 'A well-specified induction cooktop for Indian cooking styles. Enough power and presets for most households.',
      premium: 'Precise temperature control and robust build. Recommended for households cooking multiple meals daily.',
      flagship: 'Top performance for heavy cooking. The power and reliability match the price premium.',
    },
  },
  'electric-kettles': {
    good_for: 'fast boiling, tea, coffee, instant noodles',
    key_specs: ['capacity', 'wattage', 'temperature-control', 'material'],
    faqs: [
      ['How long does an electric kettle take to boil water?', 'A 1500W kettle boils 1 litre in approximately 3–4 minutes. Higher wattage (1800–2200W) cuts this to 2.5–3 minutes. Significantly faster than gas or microwave.'],
      ['Is stainless steel or plastic kettle better?', 'Stainless steel interior is recommended for hot beverages — no plastic taste or odour, more hygienic, and longer-lasting. Some budget models use plastic bodies with stainless inserts; check the interior material specifically.'],
      ['What capacity should I choose?', '1–1.2L suits 1–2 people (3–4 cups of tea). 1.5–1.7L is the standard for 3–4 people. 2L+ for larger households. Larger kettles take longer to boil if filled to capacity.'],
      ['Do I need a temperature control kettle?', 'Only if you brew green tea (70–80°C), white tea, or pour-over coffee. For standard chai, milk tea, or instant coffee, a single-boil kettle at 100°C is sufficient and costs significantly less.'],
    ],
    verdict: {
      budget: 'Fast and functional. Covers basic boiling for tea and coffee without any complexity.',
      'mid-range': 'Better build quality and typically stainless steel interior. Worth the step up for daily use.',
      premium: 'Temperature control and keep-warm function for serious tea and coffee drinkers.',
      flagship: 'Precision temperature for specialty brewing. Matches specialty café requirements at home.',
    },
  },
  'food-processors': {
    good_for: 'chopping, slicing, shredding, dough kneading, pureeing',
    key_specs: ['wattage', 'bowl-capacity', 'attachments', 'pulse'],
    faqs: [
      ['What is the difference between a food processor and a mixer grinder?', 'A mixer grinder is optimised for wet grinding (batter, chutneys, juices) and handles liquids well. A food processor is designed for solid food prep — chopping vegetables, shredding, slicing, kneading dough. Many households benefit from both.'],
      ['How many watts do I need?', '600W handles most household tasks comfortably. 800–1000W suits tougher jobs like kneading stiff dough or shredding large quantities of vegetables continuously.'],
      ['Are the attachments easy to clean?', 'Most modern food processors have dishwasher-safe plastic parts. Blade assemblies require careful hand washing. Wide-mouth bowls with few crevices are significantly easier to clean than narrow-neck designs.'],
      ['Can a food processor replace a mixer grinder for Indian cooking?', 'Partially. Food processors handle dry chopping and some wet grinding, but most lack the sustained high-speed wet grinding power needed for idli/dosa batter. A dedicated mixer grinder handles Indian wet grinding better.'],
    ],
    verdict: {
      budget: 'Handles basic chopping and slicing. A useful addition to a kitchen that already has a mixer grinder.',
      'mid-range': 'Versatile with multiple attachments. Reduces significant prep time for weekly batch cooking.',
      premium: 'Strong motor and quality blades for continuous heavy use. Suitable for large families or batch-cooking households.',
      flagship: 'Professional-grade food processor. The build quality and motor are built for daily intensive use.',
    },
  },
  'hand-blenders': {
    good_for: 'soups, smoothies, chutneys, baby food, whipping cream',
    key_specs: ['wattage', 'speed-settings', 'attachments', 'shaft-material'],
    faqs: [
      ['Is a hand blender better than a mixer grinder for soups?', 'For blending soups directly in the pot: yes. A hand blender eliminates the transfer step and the risk of hot liquid spills that come with pouring into a mixer jar. For chutneys and grinding, a mixer grinder is still preferable.'],
      ['What power is sufficient for a hand blender?', '250–400W covers smoothies, soups, and baby food. 600–800W is better for tougher tasks like crushing ice or extended continuous blending.'],
      ['Do the attachments make a significant difference?', 'A chopper attachment (small bowl + blade) effectively adds a mini food processor. A whisk attachment handles cream and egg whites. If you need these functions, buying a hand blender with attachments can replace two or three separate appliances.'],
      ['How do I avoid splatter?', 'Submerge the blade head fully before switching on. Start at low speed and increase. Keep the head tilted slightly rather than perfectly vertical. Wider pots and jugs give more room to manoeuvre.'],
    ],
    verdict: {
      budget: 'Basic immersion blending for soups and simple smoothies. Compact and easy to store.',
      'mid-range': 'Variable speed and better motor — noticeably smoother results with less effort.',
      premium: 'With attachments, replaces a chopper and whisk. The stainless shaft lasts significantly longer than plastic.',
      flagship: 'Near-commercial performance. Best for households that blend daily or in large quantities.',
    },
  },
  'sandwich-makers': {
    good_for: 'grilled sandwiches, toast, paninis, quick breakfast',
    key_specs: ['wattage', 'plate-type', 'non-stick', 'indicator'],
    faqs: [
      ['What is the difference between a sandwich maker and a grill?', 'Basic sandwich makers (triangular press) seal and toast sandwiches. Grill plates (flat ridged surface) add grill marks and work for paninis, vegetables, and meat. Multi-use models offer removable plates for both functions.'],
      ['How do I prevent sticking without butter?', 'Light cooking spray or brushing with oil before each use. Non-stick coatings on higher-quality models significantly reduce sticking without any addition.'],
      ['What wattage do I need for a sandwich maker?', '750–900W is standard and adequate. Higher wattage (1200W+) preheats faster and maintains temperature better when making multiple sandwiches back-to-back.'],
      ['Are removable plates worth the extra cost?', 'If you want versatility (sandwich + grill + waffle) and easier cleaning. Fixed-plate models are simpler but less flexible. For basic daily sandwich use, fixed plates are sufficient.'],
    ],
    verdict: {
      budget: 'Handles basic grilled sandwiches for a quick breakfast. Simple, reliable, easy to store.',
      'mid-range': 'Better non-stick and faster preheat. Noticeably better results and easier cleaning than budget options.',
      premium: 'Multi-function with removable plates. Versatile enough to replace a standalone grill for light use.',
      flagship: 'Restaurant-quality output at home. Justified for households that grill daily.',
    },
  },
  'rice-cookers': {
    good_for: 'perfect rice every time, dal, khichdi, steaming',
    key_specs: ['capacity', 'keep-warm', 'non-stick-pot', 'multi-cook'],
    faqs: [
      ['What capacity rice cooker do I need?', '1L cooks up to 2 cups dry rice (serves 2–3). 1.8L handles 4 cups dry rice (serves 4–6) — the most common Indian household size. 2.8L+ suits large families or batch cooking.'],
      ['Is an electric rice cooker more efficient than a pressure cooker?', 'Different tools. Rice cookers deliver perfectly consistent results without monitoring. Pressure cookers are faster and more versatile (dal, biryani, meat) but require attention. Many households use both.'],
      ['Can I cook dal or khichdi in a rice cooker?', 'Yes — most rice cookers handle simple dal and khichdi in the main bowl. For heavily spiced or layered dishes, a rice cooker with a "multi-cook" setting works better than a basic model.'],
      ['How important is the non-stick inner pot?', 'Significant for cleaning ease and preventing rice from sticking to the bottom. Quality non-stick coatings (Teflon or ceramic) last 3–5 years with gentle utensils. Metal utensils will damage the coating.'],
    ],
    verdict: {
      budget: 'Simple and reliable for everyday rice. Set it and forget it — frees up a burner for other dishes.',
      'mid-range': 'Better non-stick pot and keep-warm function. The right choice for households cooking rice daily.',
      premium: 'Multi-cook functions and precise control. Handles rice, dal, khichdi, and steam cooking.',
      flagship: 'Induction-based or advanced fuzzy logic. Best-in-class rice texture. For households where rice quality is paramount.',
    },
  },
}

// ── Spec extraction from product name ────────────────────────────────────────

function extractSpecs(name) {
  const specs = {}
  const n = name || ''

  const watt = n.match(/(\d{3,4})\s*W(?:att)?s?\b/i)
  if (watt) specs.wattage = watt[1] + 'W'

  const litre = n.match(/(\d+(?:\.\d+)?)\s*(?:L|Litre|Liter|Litres|Liters)\b/i)
  if (litre) specs.capacity = litre[1] + ' Litre'

  const qt = n.match(/(\d+(?:\.\d+)?)\s*QT\b/i)
  if (qt && !specs.capacity) specs.capacity = qt[1] + ' QT'

  const cup = n.match(/(\d+)\s*[-–]?\s*Cup\b/i)
  if (cup) specs.cups = cup[1] + ' Cup'

  const jar = n.match(/(\d+)\s*Jar\b/i)
  if (jar) specs.jars = jar[1] + ' Jar' + (parseInt(jar[1]) > 1 ? 's' : '')

  const bar = n.match(/(\d+)\s*Bar\b/i)
  if (bar) specs.pressure = bar[1] + ' Bar'

  const preset = n.match(/(\d+)\s*Preset/i)
  if (preset) specs.presets = preset[1] + ' Preset Menu'

  if (/digital/i.test(n)) specs.controls = 'Digital'
  if (/smart/i.test(n)) specs.controls = 'Smart / App Control'
  if (/touchscreen/i.test(n)) specs.controls = 'Touchscreen'
  if (/non.?stick/i.test(n)) specs.coating = 'Non-stick'
  if (/stainless.?steel/i.test(n)) specs.material = 'Stainless Steel'
  if (/temperature.?control/i.test(n) || /variable.?temp/i.test(n)) specs.temp_control = 'Variable Temperature'

  return specs
}

function titleCase(s) {
  return (s || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Compliance blocks ────────────────────────────────────────────────────────

const ASCI_DISCLOSURE = `<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:10px 16px;font-size:13px;line-height:1.5;margin-bottom:20px;">
<strong>Affiliate Disclosure:</strong> PriceHawk earns a commission on qualifying purchases made through links on this page. This never influences our editorial recommendations. As an Amazon Associate I earn from qualifying purchases.
</div>`

function methodologyBlock(name, reviewCount) {
  const reviewNote = reviewCount && parseInt(String(reviewCount).replace(/\D/g, '')) > 500
    ? `an analysis of user reviews on Amazon India,`
    : `published user feedback,`
  return `<div style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:14px 18px;margin:24px 0;font-size:13px;line-height:1.6;">
<strong>PriceHawk Methodology:</strong> This assessment is based on published specifications for the <em>${name}</em>, ${reviewNote} competitive positioning against comparable models in this category, and PriceHawk's tracked price history. PriceHawk has not independently lab-tested this unit. Where we state opinions, they are based on documented specifications and aggregated user experience — not hands-on testing.
</div>`
}

// ── Review HTML builder ───────────────────────────────────────────────────────

function buildReviewHTML(product, catSlug) {
  const name    = product.product_name || product._legacy?.name || 'Product'
  const brand   = titleCase(product.brand_id || '')
  const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
  const link    = product.offers?.affiliate_url || `https://www.amazon.in/dp/${product.offers?.external_id || product._legacy?.asin}?tag=${TAG}`
  const seg     = product.price_segment || product._legacy?.price_segment || 'mid-range'
  const asin    = product.offers?.external_id || product._legacy?.asin || ''
  const reviewCount = product._legacy?.review_count || null
  const signals = CAT_SIGNALS[catSlug] || {}
  const verdict = signals.verdict?.[seg] || signals.verdict?.['mid-range'] || 'A well-regarded option in the Indian market.'
  const goodFor = signals.good_for || catLabel.toLowerCase()
  const faqs    = signals.faqs || []
  const specs   = extractSpecs(name)

  const specsHTML = Object.entries(specs).length
    ? `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
${Object.entries(specs).map(([k, v]) =>
  `  <tr style="border-bottom:1px solid #e8e8e8;">
    <td style="padding:8px 12px;color:#666;width:40%;font-weight:600;">${titleCase(k.replace(/_/g,' '))}</td>
    <td style="padding:8px 12px;">${v}</td>
  </tr>`).join('\n')}
</table>`
    : `<p style="color:#666;font-size:14px;">Refer to the Amazon product page for full specifications.</p>`

  const faqHTML = faqs.length ? `
<h2 style="font-size:20px;font-weight:700;margin:32px 0 12px;">Frequently Asked Questions</h2>
${faqs.map(([q, a]) => `<details style="border:1px solid #e0e0e0;border-radius:4px;margin-bottom:8px;overflow:hidden;">
  <summary style="padding:12px 16px;cursor:pointer;font-weight:600;font-size:14px;background:#fafafa;">${q}</summary>
  <div style="padding:12px 16px;font-size:14px;line-height:1.7;color:#333;">${a}</div>
</details>`).join('\n')}` : ''

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Review',
        name: `${name} Review`,
        reviewBody: `${verdict} Good for: ${goodFor}.`,
        author: { '@type': 'Organization', name: 'PriceHawk' },
        publisher: { '@type': 'Organization', name: 'PriceHawk', url: 'https://pricehawk.in' },
        datePublished: new Date().toISOString().split('T')[0],
        itemReviewed: {
          '@type': 'Product',
          name,
          brand: { '@type': 'Brand', name: brand },
          category: catLabel,
          offers: {
            '@type': 'Offer',
            url: link,
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: 'Amazon India' },
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pricehawk.in/' },
          { '@type': 'ListItem', position: 2, name: `Best ${catLabel}s`, item: `https://pricehawk.in/best-${catSlug}/` },
          { '@type': 'ListItem', position: 3, name: `${name} Review`, item: `https://pricehawk.in/review-${slugify(brand)}-${asin.toLowerCase()}/` },
        ],
      },
      ...(faqs.length ? [{
        '@type': 'FAQPage',
        mainEntity: faqs.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      }] : []),
    ],
  }

  return `${ASCI_DISCLOSURE}

<nav style="font-size:13px;color:#888;margin-bottom:20px;">
<a href="/" style="color:#666;">Home</a> › <a href="/best-${catSlug}/" style="color:#666;">Best ${catLabel}s in India ${YEAR}</a> › ${name.substring(0, 50)}… Review
</nav>

<p style="font-size:16px;line-height:1.7;color:#333;">${verdict} It is designed for <strong>${goodFor}</strong>.</p>

<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;padding:16px 20px;margin:20px 0;display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
  <div style="flex:1;min-width:200px;">
    <p style="font-size:12px;color:#888;font-weight:700;text-transform:uppercase;margin:0 0 4px;">${brand}</p>
    <h2 style="font-size:17px;font-weight:700;margin:0 0 12px;line-height:1.4;">${name}</h2>
    <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
       style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:14px;font-weight:700;padding:9px 20px;border-radius:4px;">
      Check price on Amazon →
    </a>
  </div>
</div>

<h2 style="font-size:20px;font-weight:700;margin:28px 0 10px;">Key Specifications</h2>
${specsHTML}

<h2 style="font-size:20px;font-weight:700;margin:28px 0 10px;">Who Should Buy This?</h2>
<ul style="font-size:15px;line-height:1.8;color:#333;margin:0;padding-left:20px;">
  <li>Households looking for a <strong>${seg.replace('-', ' ')}</strong> ${catLabel.toLowerCase()} for everyday use</li>
  <li>Buyers wanting a trusted product with a track record of Indian customer reviews</li>
  <li>Anyone comparing multiple ${catLabel.toLowerCase()} options in this price range</li>
</ul>

${methodologyBlock(name, reviewCount)}

<div style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:6px;padding:16px 20px;margin:24px 0;">
  <p style="margin:0 0 10px;font-weight:700;font-size:15px;">Ready to buy or want to check the latest price?</p>
  <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:14px;font-weight:700;padding:9px 20px;border-radius:4px;">
    Check price on Amazon India →
  </a>
  <p style="margin:10px 0 0;font-size:12px;color:#999;">Amazon prices change frequently. Click to see the current price.</p>
</div>

${faqHTML}

<hr style="margin:32px 0;border:none;border-top:1px solid #e0e0e0;">
<p style="font-size:13px;color:#888;">
  <a href="/best-${catSlug}/" style="color:#e65100;font-weight:600;">← Compare all ${catLabel}s in India ${YEAR}</a>
</p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>`
}

// ── WP helpers ───────────────────────────────────────────────────────────────

async function wpFindPage(slug) {
  try {
    const r = await axios.get(`${WP}/wp-json/wp/v2/pages?slug=${slug}&per_page=1&status=draft,publish,private`, { headers: AUTH })
    return r.data?.[0] || null
  } catch { return null }
}

async function wpUpsertPage({ title, slug, content }, dryRun) {
  if (dryRun) { console.log(`    [dry] ${slug}`); return null }
  const existing = await wpFindPage(slug)
  const payload  = { title, content, slug, status: 'draft', comment_status: 'closed' }
  try {
    if (existing) {
      const r = await axios.post(`${WP}/wp-json/wp/v2/pages/${existing.id}`, payload, { headers: AUTH })
      return { action: 'updated', id: r.data.id, link: r.data.link }
    } else {
      const r = await axios.post(`${WP}/wp-json/wp/v2/pages`, payload, { headers: AUTH })
      return { action: 'created', id: r.data.id, link: r.data.link }
    }
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message)
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const args      = process.argv.slice(2)
  const dryRun    = args.includes('--dry-run')
  const catFilter = args.includes('--cat') ? args[args.indexOf('--cat') + 1] : null
  const limit     = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) || 9999 : 9999

  if (!WP || !USER || !PASS) { console.error('Missing WP credentials'); process.exit(1) }
  if (!fs.existsSync(QUEUE_FILE)) { console.error('Run content-opportunity-engine.js first'); process.exit(1) }

  // Build ASIN → product index across all kitchen cats
  const productIndex = {}
  const KITCHEN = ['air-fryers','mixer-grinders','coffee-machines','induction-cooktops',
                   'electric-kettles','food-processors','hand-blenders','sandwich-makers','rice-cookers']

  for (const cat of KITCHEN) {
    const fp = path.join(PRODS_DIR, `${cat}.json`)
    if (!fs.existsSync(fp)) continue
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'))
    for (const p of (data.products || [])) {
      const asin = p.offers?.external_id || p._legacy?.asin
      if (asin) productIndex[asin] = p
    }
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))
    .filter(o => o.type === 'review')
    .filter(o => !catFilter || o.category === catFilter)
    .slice(0, limit)

  console.log(`Review queue: ${queue.length} items`)
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 }

  for (const op of queue) {
    const product = productIndex[op.asin]
    if (!product) {
      console.log(`  skip ${op.asin} — not in product index`)
      stats.skipped++
      continue
    }

    const name    = product.product_name || product._legacy?.name || ''
    const brand   = product.brand_id || 'product'
    const asin    = op.asin
    const catSlug = op.category
    const slug    = `review-${brand}-${asin.toLowerCase()}`
    // SEO title: strip trailing garbage, keep under 65 chars
    const rawName = name.replace(/\s*[\\|,].*$/, '').trim()
    const shortName = rawName.length > 55 ? rawName.substring(0, 52) + '…' : rawName
    const title   = `${shortName} Review — Worth Buying in India ${YEAR}?`

    try {
      const html   = buildReviewHTML(product, catSlug)
      const result = await wpUpsertPage({ title, slug, content: html }, dryRun)
      if (result) {
        console.log(`  ✓ [${result.action}] ${catSlug} | ${shortName.substring(0, 45)}`)
        result.action === 'created' ? stats.created++ : stats.updated++
      }
    } catch (e) {
      console.error(`  ✗ ${asin}: ${e.message}`)
      stats.errors++
    }

    // Polite delay — avoid hammering WP REST
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n── DONE ────────────────────────`)
  console.log(`Created: ${stats.created} | Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`)
  if (dryRun) console.log('(dry run — no WP changes)')
}

main().catch(e => { console.error(e.message); process.exit(1) })
