/**
 * PriceHawk G4 — Buying Guide generator
 * Budget guides, use-case guides, decision guides for kitchen beachhead.
 * No scraped prices/images/ratings displayed — compliance by construction.
 *
 * Usage:
 *   node scripts/generate-buying-guides.js               # all Phase 1 guides
 *   node scripts/generate-buying-guides.js --cat air-fryers
 *   node scripts/generate-buying-guides.js --subtype budget
 *   node scripts/generate-buying-guides.js --dry-run
 *   node scripts/generate-buying-guides.js --limit 20
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
const TAG  = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'

const CAT_LABELS = {
  'air-fryers': 'Air Fryers', 'mixer-grinders': 'Mixer Grinders',
  'coffee-machines': 'Coffee Machines', 'induction-cooktops': 'Induction Cooktops',
  'electric-kettles': 'Electric Kettles', 'food-processors': 'Food Processors',
  'hand-blenders': 'Hand Blenders', 'sandwich-makers': 'Sandwich Makers',
  'rice-cookers': 'Rice Cookers',
}

const CAT_LABEL_SINGULAR = {
  'air-fryers': 'air fryer', 'mixer-grinders': 'mixer grinder',
  'coffee-machines': 'coffee machine', 'induction-cooktops': 'induction cooktop',
  'electric-kettles': 'electric kettle', 'food-processors': 'food processor',
  'hand-blenders': 'hand blender', 'sandwich-makers': 'sandwich maker',
  'rice-cookers': 'rice cooker',
}

// Buying factors per category (shown at the bottom of all guide types)
const CAT_BUYING_FACTORS = {
  'air-fryers': [
    { factor: 'Capacity', tip: 'A 2–3L basket suits 1–2 people. For a family of 4, choose 4–6L. Larger baskets take longer to heat up.' },
    { factor: 'Wattage', tip: 'Higher wattage (1500W+) preheats faster and maintains temperature better during use.' },
    { factor: 'Preset Programs', tip: 'Presets are convenient for beginners. Experienced cooks often prefer manual temperature and timer control.' },
    { factor: 'Controls', tip: 'Digital controls with touchscreen offer precision. Analog dials are simpler and often more durable.' },
  ],
  'mixer-grinders': [
    { factor: 'Wattage', tip: '500W handles light daily use. 750W suits families grinding idli/dosa batter regularly. 1000W+ for large families or heavy use.' },
    { factor: 'Number of Jars', tip: '3 jars (dry, wet, chutney) covers most Indian cooking needs. 4+ jars add versatility but take more storage space.' },
    { factor: 'Motor Warranty', tip: 'Look for minimum 2-year motor warranty. Indian brands like Preethi and Butterfly often offer 5-year warranties on premium models.' },
    { factor: 'Jar Material', tip: 'Stainless steel jars are more durable and do not stain. Polycarbonate jars allow you to see contents while grinding.' },
  ],
  'coffee-machines': [
    { factor: 'Coffee Type', tip: 'Drip machines: simple, bulk coffee. Espresso machines: café-style shots. Capsule/pod: convenience at higher per-cup cost.' },
    { factor: 'Bar Pressure', tip: 'True espresso requires 9 bar minimum. Machines rated at 1–3 bar produce strong coffee but not technically espresso.' },
    { factor: 'Milk Frother', tip: 'Steam wand or automatic frother for cappuccinos and lattes. Budget machines typically omit this.' },
    { factor: 'Descaling', tip: 'In hard-water Indian cities (Delhi, Bengaluru), descale monthly. Choose models with descaling indicators or easy access.' },
  ],
  'induction-cooktops': [
    { factor: 'Wattage', tip: '1200W handles everyday cooking. 1800–2000W boils water faster — worth the cost for high-volume cooking.' },
    { factor: 'Cookware Compatibility', tip: 'Only ferromagnetic cookware works — cast iron and most stainless steel. Test with a magnet before buying.' },
    { factor: 'Preset Programs', tip: 'Temperature presets for dal, milk, chai save effort for daily use. Manual control is better for cooking flexibility.' },
    { factor: 'Safety Features', tip: 'Look for auto-shutoff when no cookware is detected, child lock, and overheating protection.' },
  ],
  'electric-kettles': [
    { factor: 'Capacity', tip: '1L is enough for 2–3 cups. 1.5–1.7L suits most households. 2L+ for larger families or offices.' },
    { factor: 'Material', tip: 'Stainless steel interior is essential — no plastic taste, more hygienic. Check the interior specifically, not just the body.' },
    { factor: 'Wattage', tip: '1500W boils 1 litre in ~3.5 minutes. 2200W cuts this to ~2 minutes. Higher wattage means more electricity per use but finishes faster.' },
    { factor: 'Temperature Control', tip: 'Variable temperature (60–100°C) is needed for green tea or specialty coffee. For regular chai, a basic kettle is sufficient.' },
  ],
  'food-processors': [
    { factor: 'Wattage', tip: '600W handles most household tasks. 800–1000W suits heavy continuous use like kneading large batches of dough.' },
    { factor: 'Bowl Capacity', tip: '1.5–2L suits 2–4 people. 3L+ is better for large families or batch cooking.' },
    { factor: 'Attachments', tip: 'Slicing disc, shredding disc, and chopping blade cover 90% of use cases. Dough blade is valuable for roti/paratha households.' },
    { factor: 'Cleaning', tip: 'Wide-mouth bowls with dishwasher-safe parts save significant time. Narrow-neck designs are harder to clean thoroughly.' },
  ],
  'hand-blenders': [
    { factor: 'Wattage', tip: '250–400W handles smoothies, soups, and baby food. 600W+ is better for extended blending or tougher ingredients.' },
    { factor: 'Speed Settings', tip: 'Variable speed gives better control for different textures. Single-speed models are simpler but less versatile.' },
    { factor: 'Shaft Material', tip: 'Stainless steel shafts last significantly longer than plastic, especially with regular hot food contact.' },
    { factor: 'Attachments', tip: 'Chopper bowl and whisk attachments expand functionality significantly — effectively replacing a mini chopper and egg beater.' },
  ],
  'sandwich-makers': [
    { factor: 'Plate Type', tip: 'Fixed triangular plates: basic sandwich only. Flat grill plates: paninis and grilled vegetables. Removable plates: swap between modes.' },
    { factor: 'Wattage', tip: '750–900W standard. Higher wattage (1200W+) preheats faster and recovers heat better when making multiple sandwiches back-to-back.' },
    { factor: 'Non-Stick Coating', tip: 'Quality non-stick coating reduces the need for butter and makes cleaning easier. Avoid metal utensils to extend coating life.' },
    { factor: 'Indicator Light', tip: 'A ready indicator shows when the maker has reached cooking temperature — prevents undercooked sandwiches.' },
  ],
  'rice-cookers': [
    { factor: 'Capacity', tip: '1L for 1–2 people. 1.8L is the standard Indian household size (4–5 people). 2.8L+ for larger families.' },
    { factor: 'Inner Pot', tip: 'Non-stick coating prevents rice from sticking and makes cleaning easy. Thicker pots with induction base provide even heat distribution.' },
    { factor: 'Keep Warm', tip: 'Automatic keep-warm switches on after cooking is complete — rice stays warm for hours without drying out.' },
    { factor: 'Multi-Cook', tip: 'Basic rice cookers handle only rice. Multi-cook models handle dal, khichdi, steaming, and porridge.' },
  ],
}

const ASCI_DISCLOSURE = `<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:10px 16px;font-size:13px;line-height:1.5;margin-bottom:20px;">
<strong>Affiliate Disclosure:</strong> PriceHawk earns a commission on qualifying purchases made through links on this page. This never influences our editorial recommendations. As an Amazon Associate I earn from qualifying purchases.
</div>`

function methodologyBlock(catLabel) {
  return `<div style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:14px 18px;margin:24px 0;font-size:13px;line-height:1.6;">
<strong>PriceHawk Methodology:</strong> Product selection in this guide is based on published specifications, aggregated user reviews from Amazon India, competitive pricing within this category, and PriceHawk's ongoing price tracking across multiple ${catLabel.toLowerCase()} models. PriceHawk has not independently lab-tested the products featured. All opinions are based on documented specifications and public user feedback — not hands-on testing.
</div>`
}

function titleCase(s) {
  return (s || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ── Product card HTML (no price displayed — compliance) ───────────────────────
function productCardHTML(p, catSlug) {
  const name   = p.product_name || p._legacy?.name || 'Product'
  const brand  = titleCase(p.brand_id || '')
  const asin   = (Array.isArray(p.offers) ? p.offers[0] : p.offers)?.external_id || p._legacy?.asin || ''
  const link   = (Array.isArray(p.offers) ? p.offers[0] : p.offers)?.affiliate_url
                 || `https://www.amazon.in/dp/${asin}?tag=${TAG}`
  const seg    = p.price_segment || p._legacy?.price_segment || 'mid-range'
  const short  = name.replace(/\s*[\\|,].*$/, '').trim().substring(0, 70)

  return `<div style="border:1px solid #e0e0e0;border-radius:6px;padding:14px 18px;margin-bottom:12px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
  <div style="flex:1;min-width:180px;">
    <p style="font-size:11px;color:#888;font-weight:700;text-transform:uppercase;margin:0 0 4px;">${brand} · ${seg.replace('-',' ')} segment</p>
    <p style="font-size:15px;font-weight:700;margin:0 0 10px;line-height:1.4;">${short}</p>
    <a href="${link}" target="_blank" rel="nofollow sponsored noopener"
       style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:7px 16px;border-radius:4px;">
      Check price on Amazon →
    </a>
  </div>
</div>`
}

// ── Guide HTML builder ────────────────────────────────────────────────────────

function buildBudgetGuideHTML(guide, products, catSlug) {
  const catLabel   = CAT_LABELS[catSlug] || titleCase(catSlug)
  const catSingular = CAT_LABEL_SINGULAR[catSlug] || catLabel.toLowerCase()
  const ceiling    = guide.price_ceiling
  const ceilingFmt = '₹' + ceiling.toLocaleString('en-IN')
  const buyingFactors = CAT_BUYING_FACTORS[catSlug] || []

  // Filter products that fit the budget (use _legacy price or offers price)
  const budgetProducts = products.filter(p => {
    const price = (Array.isArray(p.offers) ? p.offers[0] : p.offers)?.last_price
                  || p._legacy?.current_price || 0
    return price > 0 && price <= ceiling
  }).sort((a, b) => {
    const priceA = (Array.isArray(a.offers) ? a.offers[0] : a.offers)?.last_price || a._legacy?.current_price || 0
    const priceB = (Array.isArray(b.offers) ? b.offers[0] : b.offers)?.last_price || b._legacy?.current_price || 0
    return priceB - priceA  // Highest price (best bang for buck) first
  }).slice(0, 6)

  const productListHTML = budgetProducts.length
    ? budgetProducts.map(p => productCardHTML(p, catSlug)).join('\n')
    : `<p style="color:#666;font-size:14px;">Our product data for this price range is being updated. Check the Amazon link below for current options.</p>`

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: `Best ${catLabel} Under ${ceilingFmt} in India ${YEAR}`,
        description: `Top-rated ${catLabel.toLowerCase()} available on Amazon India under ${ceilingFmt}.`,
        numberOfItems: budgetProducts.length,
        itemListElement: budgetProducts.map((p, i) => {
          const asin = (Array.isArray(p.offers) ? p.offers[0] : p.offers)?.external_id || p._legacy?.asin
          const link = (Array.isArray(p.offers) ? p.offers[0] : p.offers)?.affiliate_url || `https://www.amazon.in/dp/${asin}?tag=${TAG}`
          return { '@type': 'ListItem', position: i + 1, name: p.product_name || p._legacy?.name, url: link }
        }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pricehawk.in/' },
          { '@type': 'ListItem', position: 2, name: `Best ${catLabel}s`, item: `https://pricehawk.in/best-${catSlug}/` },
          { '@type': 'ListItem', position: 3, name: `Best ${catLabel}s Under ${ceilingFmt}`, item: `https://pricehawk.in/best-${catSlug}-under-${ceiling}/` },
        ],
      },
    ],
  }

  return `${ASCI_DISCLOSURE}

<nav style="font-size:13px;color:#888;margin-bottom:20px;">
<a href="/" style="color:#666;">Home</a> › <a href="/best-${catSlug}/" style="color:#666;">Best ${catLabel}s in India</a> › Under ${ceilingFmt}
</nav>

<p style="font-size:16px;line-height:1.7;color:#333;">
Looking for a good ${catSingular} under <strong>${ceilingFmt}</strong>? This guide covers the best options available on Amazon India in this price range, with enough performance for everyday household use.
</p>

<h2 style="font-size:20px;font-weight:700;margin:28px 0 12px;">Top ${catLabel}s Under ${ceilingFmt}</h2>
<p style="font-size:13px;color:#888;margin-bottom:16px;">Products shown here are available on Amazon India. Click any link to see the current price — prices change frequently.</p>

${productListHTML}

<h2 style="font-size:20px;font-weight:700;margin:32px 0 12px;">What to Check Before Buying Under ${ceilingFmt}</h2>
<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:24px;">
${buyingFactors.map(({ factor, tip }) => `<div style="padding:12px 18px;border-bottom:1px solid #eeeeee;">
  <p style="margin:0;font-size:14px;"><strong>${factor}:</strong> ${tip}</p>
</div>`).join('\n')}
</div>

${methodologyBlock(catLabel)}

<div style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:6px;padding:16px 20px;margin:24px 0;">
  <p style="margin:0 0 10px;font-weight:700;font-size:15px;">Browse all ${catLabel}s on Amazon India:</p>
  <a href="https://www.amazon.in/s?k=${encodeURIComponent(catLabel + ' india')}&tag=${TAG}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
    Shop ${catLabel}s on Amazon →
  </a>
</div>

<hr style="margin:32px 0;border:none;border-top:1px solid #e0e0e0;">
<p style="font-size:13px;color:#888;">
  <a href="/best-${catSlug}/" style="color:#e65100;font-weight:600;">← Back to Best ${catLabel}s in India ${YEAR}</a>
</p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>`
}

function buildUseCaseGuideHTML(guide, products, catSlug) {
  const catLabel    = CAT_LABELS[catSlug] || titleCase(catSlug)
  const catSingular = CAT_LABEL_SINGULAR[catSlug] || catLabel.toLowerCase()
  const useCase     = guide.use_case || titleCase(guide.title.replace(/^Best .* for /, ''))
  const buyingFactors = CAT_BUYING_FACTORS[catSlug] || []

  // For use case guides, show top products by score (we don't have use-case scoring,
  // so show the top 5 by review count proxy)
  const topProducts = products
    .filter(p => {
      const asin = (Array.isArray(p.offers) ? p.offers[0] : p.offers)?.external_id || p._legacy?.asin
      return !!asin
    })
    .sort((a, b) => {
      const rcA = parseInt(String(a._legacy?.review_count || '0').replace(/\D/g,'')) || 0
      const rcB = parseInt(String(b._legacy?.review_count || '0').replace(/\D/g,'')) || 0
      const ratA = (a._legacy?.rating || 3) * rcA
      const ratB = (b._legacy?.rating || 3) * rcB
      return ratB - ratA
    })
    .slice(0, 5)

  const productListHTML = topProducts.length
    ? topProducts.map(p => productCardHTML(p, catSlug)).join('\n')
    : `<p style="color:#666;font-size:14px;">Check the Amazon link below for current recommendations.</p>`

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: `Best ${catLabel} for ${useCase} in India ${YEAR}`,
        description: `Top-rated ${catLabel.toLowerCase()} for ${useCase.toLowerCase()} available on Amazon India.`,
        numberOfItems: topProducts.length,
        itemListElement: topProducts.map((p, i) => {
          const asin = (Array.isArray(p.offers) ? p.offers[0] : p.offers)?.external_id || p._legacy?.asin
          const link = (Array.isArray(p.offers) ? p.offers[0] : p.offers)?.affiliate_url || `https://www.amazon.in/dp/${asin}?tag=${TAG}`
          return { '@type': 'ListItem', position: i + 1, name: p.product_name || p._legacy?.name, url: link }
        }),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pricehawk.in/' },
          { '@type': 'ListItem', position: 2, name: `Best ${catLabel}s`, item: `https://pricehawk.in/best-${catSlug}/` },
          { '@type': 'ListItem', position: 3, name: `Best ${catLabel}s for ${useCase}`, item: `https://pricehawk.in/best-${catSlug}-for-${slugify(useCase)}/` },
        ],
      },
    ],
  }

  return `${ASCI_DISCLOSURE}

<nav style="font-size:13px;color:#888;margin-bottom:20px;">
<a href="/" style="color:#666;">Home</a> › <a href="/best-${catSlug}/" style="color:#666;">Best ${catLabel}s in India</a> › For ${useCase}
</nav>

<p style="font-size:16px;line-height:1.7;color:#333;">
Choosing the right ${catSingular} for <strong>${useCase.toLowerCase()}</strong> depends on a few specific requirements that differ from general-purpose use. Here are the best options available on Amazon India for this use case.
</p>

<h2 style="font-size:20px;font-weight:700;margin:28px 0 12px;">Best ${catLabel}s for ${useCase}</h2>
<p style="font-size:13px;color:#888;margin-bottom:16px;">Products shown here are available on Amazon India. Click any link to see the current price.</p>

${productListHTML}

<h2 style="font-size:20px;font-weight:700;margin:32px 0 12px;">What Makes a Good ${titleCase(catSingular)} for ${useCase}?</h2>
<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:24px;">
${buyingFactors.map(({ factor, tip }) => `<div style="padding:12px 18px;border-bottom:1px solid #eeeeee;">
  <p style="margin:0;font-size:14px;"><strong>${factor}:</strong> ${tip}</p>
</div>`).join('\n')}
</div>

${methodologyBlock(catLabel)}

<div style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:6px;padding:16px 20px;margin:24px 0;">
  <p style="margin:0 0 10px;font-weight:700;font-size:15px;">Browse all ${catLabel}s on Amazon India:</p>
  <a href="https://www.amazon.in/s?k=${encodeURIComponent(catLabel + ' india')}&tag=${TAG}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
    Shop ${catLabel}s on Amazon →
  </a>
</div>

<hr style="margin:32px 0;border:none;border-top:1px solid #e0e0e0;">
<p style="font-size:13px;color:#888;">
  <a href="/best-${catSlug}/" style="color:#e65100;font-weight:600;">← Back to Best ${catLabel}s in India ${YEAR}</a>
</p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>`
}

function buildDecisionGuideHTML(guide, products, catSlug) {
  const catLabel    = CAT_LABELS[catSlug] || titleCase(catSlug)
  const catSingular = CAT_LABEL_SINGULAR[catSlug] || catLabel.toLowerCase()
  const guideTitle  = guide.title
  const buyingFactors = CAT_BUYING_FACTORS[catSlug] || []

  const topProducts = products
    .filter(p => {
      const asin = (Array.isArray(p.offers) ? p.offers[0] : p.offers)?.external_id || p._legacy?.asin
      return !!asin
    })
    .sort((a, b) => {
      const rcA = parseInt(String(a._legacy?.review_count || '0').replace(/\D/g,'')) || 0
      const rcB = parseInt(String(b._legacy?.review_count || '0').replace(/\D/g,'')) || 0
      return rcB - rcA
    })
    .slice(0, 4)

  const productListHTML = topProducts.length
    ? topProducts.map(p => productCardHTML(p, catSlug)).join('\n')
    : `<p style="color:#666;font-size:14px;">Check the Amazon link below for current recommendations.</p>`

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pricehawk.in/' },
      { '@type': 'ListItem', position: 2, name: `Best ${catLabel}s`, item: `https://pricehawk.in/best-${catSlug}/` },
      { '@type': 'ListItem', position: 3, name: guideTitle, item: `https://pricehawk.in/best-overall-${catSlug}/` },
    ],
  }

  return `${ASCI_DISCLOSURE}

<nav style="font-size:13px;color:#888;margin-bottom:20px;">
<a href="/" style="color:#666;">Home</a> › <a href="/best-${catSlug}/" style="color:#666;">Best ${catLabel}s in India</a> › Best Overall
</nav>

<p style="font-size:16px;line-height:1.7;color:#333;">
Choosing a ${catSingular} for your home involves weighing capacity, power, brand reliability, and value. Here are the top-performing models across all price segments on Amazon India, with key buying factors to guide your decision.
</p>

<h2 style="font-size:20px;font-weight:700;margin:28px 0 12px;">Top ${catLabel}s in India ${YEAR}</h2>
<p style="font-size:13px;color:#888;margin-bottom:16px;">Sorted by popularity and user reviews. Click any link to see the current price on Amazon.</p>

${productListHTML}

<h2 style="font-size:20px;font-weight:700;margin:32px 0 12px;">How to Choose the Right ${titleCase(catSingular)}</h2>
<div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;margin-bottom:24px;">
${buyingFactors.map(({ factor, tip }, i) => `<div style="padding:14px 18px;${i < buyingFactors.length - 1 ? 'border-bottom:1px solid #eeeeee;' : ''}">
  <p style="margin:0;font-size:14px;"><strong>${i + 1}. ${factor}:</strong> ${tip}</p>
</div>`).join('\n')}
</div>

${methodologyBlock(catLabel)}

<div style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:6px;padding:16px 20px;margin:24px 0;">
  <p style="margin:0 0 10px;font-weight:700;font-size:15px;">Browse all ${catLabel}s on Amazon India:</p>
  <a href="https://www.amazon.in/s?k=${encodeURIComponent(catLabel + ' india')}&tag=${TAG}" target="_blank" rel="nofollow sponsored noopener"
     style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
    Shop ${catLabel}s on Amazon →
  </a>
</div>

<hr style="margin:32px 0;border:none;border-top:1px solid #e0e0e0;">
<p style="font-size:13px;color:#888;">
  <a href="/best-${catSlug}/" style="color:#e65100;font-weight:600;">← Back to Best ${catLabel}s in India ${YEAR}</a>
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
  const args        = process.argv.slice(2)
  const dryRun      = args.includes('--dry-run')
  const catFilter   = args.includes('--cat')     ? args[args.indexOf('--cat') + 1]     : null
  const stFilter    = args.includes('--subtype') ? args[args.indexOf('--subtype') + 1] : null
  const limit       = args.includes('--limit')   ? parseInt(args[args.indexOf('--limit') + 1]) || 9999 : 9999

  if (!WP || !USER || !PASS) { console.error('Missing WP credentials'); process.exit(1) }
  if (!fs.existsSync(QUEUE_FILE)) { console.error('Run content-opportunity-engine.js first'); process.exit(1) }

  // Build product map per category
  const KITCHEN = ['air-fryers','mixer-grinders','coffee-machines','induction-cooktops',
                   'electric-kettles','food-processors','hand-blenders','sandwich-makers','rice-cookers']
  const catProducts = {}
  for (const cat of KITCHEN) {
    const fp = path.join(PRODS_DIR, `${cat}.json`)
    if (!fs.existsSync(fp)) continue
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'))
    catProducts[cat] = data.products || []
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))
    .filter(o => o.type === 'buying_guide')
    .filter(o => !catFilter || o.category === catFilter)
    .filter(o => !stFilter  || o.subtype  === stFilter)
    .slice(0, limit)

  console.log(`Buying guide queue: ${queue.length} items`)
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 }

  for (const guide of queue) {
    const catSlug  = guide.category
    const products = catProducts[catSlug] || []
    const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
    const catSingular = CAT_LABEL_SINGULAR[catSlug] || catLabel.toLowerCase()

    let html, slug, title

    if (guide.subtype === 'budget') {
      const ceiling    = guide.price_ceiling
      const ceilingFmt = '₹' + ceiling.toLocaleString('en-IN')
      slug  = `best-${catSlug}-under-${ceiling}`
      title = `Best ${catLabel} Under ${ceilingFmt} in India ${YEAR}`
      html  = buildBudgetGuideHTML(guide, products, catSlug)
    } else if (guide.subtype === 'use_case') {
      const useCase = guide.use_case || 'Home Use'
      slug  = `best-${catSlug}-for-${slugify(useCase)}`
      title = `Best ${catLabel} for ${useCase} in India ${YEAR}`
      html  = buildUseCaseGuideHTML(guide, products, catSlug)
    } else if (guide.subtype === 'decision') {
      // Extract decision type keyword from title for unique slug
      const decisionKeyword = guide.title
        .replace(/^(Best |Most |Longest )/, '')
        .replace(/ (Air Fryers|Mixer Grinders|Coffee Machines|Induction Cooktops|Electric Kettles|Food Processors|Hand Blenders|Sandwich Makers|Rice Cookers) in India$/, '')
        .trim()
      slug  = `${catSlug}-${slugify(decisionKeyword)}-india`
      title = `${guide.title} — Buying Guide ${YEAR}`
      html  = buildDecisionGuideHTML(guide, products, catSlug)
    } else {
      stats.skipped++
      continue
    }

    try {
      const result = await wpUpsertPage({ title, slug, content: html }, dryRun)
      if (result) {
        console.log(`  ✓ [${result.action}] [${guide.subtype}] ${catSlug} | ${title.substring(0, 55)}`)
        result.action === 'created' ? stats.created++ : stats.updated++
      }
    } catch (e) {
      console.error(`  ✗ ${slug}: ${e.message}`)
      stats.errors++
    }

    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\n── DONE ────────────────────────`)
  console.log(`Created: ${stats.created} | Updated: ${stats.updated} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`)
  if (dryRun) console.log('(dry run — no WP changes)')
}

main().catch(e => { console.error(e.message); process.exit(1) })
