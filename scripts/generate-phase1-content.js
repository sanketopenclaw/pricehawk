/**
 * PriceHawk Phase 1 content generator — category hubs + brand pages
 * Kitchen beachhead: air-fryers, mixer-grinders, coffee-machines, etc.
 *
 * Generates and pushes WP draft pages. Never auto-publishes.
 * All content compliance: no scraped prices/images/ratings displayed.
 * SiteStripe affiliate links only.
 *
 * Usage:
 *   node scripts/generate-phase1-content.js                      # all kitchen cats
 *   node scripts/generate-phase1-content.js --cat air-fryers     # single category
 *   node scripts/generate-phase1-content.js --dry-run            # no WP writes
 *   node scripts/generate-phase1-content.js --type category_page # skip brand pages
 *   node scripts/generate-phase1-content.js --brands 5           # brand pages per cat (default 3)
 */

require('dotenv').config()
const fs   = require('fs')
const path = require('path')
const { makeAuth, wpUpsertPage } = require('./lib/wp')
const { asciDisclosure, methodologyBlock, resolveOffer, affiliateLink, metaDescription } = require('./lib/content')
const { buildPageStyles } = require('./lib/styles')
const { postShell } = require('./lib/templates')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD
const AUTH = makeAuth(USER, PASS)
const TAG  = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'

const PRODS_DIR = path.join(__dirname, '../data/products')
const YEAR = new Date().getFullYear()

// Only generate brand pages for known legitimate brands — prevents descriptor slugs like
// 'cordless', 'portable', 'stainless', 'coffee', 'new', 'lazy' becoming brand pages.
const TRUSTED_BRAND_SLUGS = new Set([
  'philips','bajaj','prestige','pigeon','havells','inalsa','agaro','wonderchef','usha',
  'bosch','preethi','butterfly','lifelong','glen','faber','elica','sunflame','vidiem',
  'sujata','kenstar','maharaja-whiteline','singer','morphy-richards','russell-hobbs',
  'borosil','bergner','oster','braun','kenwood','panasonic','haier','tefal','moulinex',
  'ibell','longway','wipro','crompton','cello','milton','hawkins','vinod','stovekraft',
  'eureka-forbes','kent','ao-smith','livpure','pureit','bluestar','whirlpool','ifb',
  // Coffee machine brands
  'delonghi','nespresso','bialetti','coffeeza','instacuppa','cafe-zest','kaapi',
  'hamilton-beach','black-decker','lavazza','saeco','smeg','breville','cuisinart',
])

const KITCHEN_BEACHHEAD = [
  'air-fryers', 'mixer-grinders', 'coffee-machines',
  'induction-cooktops', 'electric-kettles', 'food-processors',
  'hand-blenders', 'sandwich-makers', 'rice-cookers',
]

const CAT_LABELS = {
  'air-fryers':         'Air Fryers',
  'mixer-grinders':     'Mixer Grinders',
  'coffee-machines':    'Coffee Machines',
  'induction-cooktops': 'Induction Cooktops',
  'electric-kettles':   'Electric Kettles',
  'food-processors':    'Food Processors',
  'hand-blenders':      'Hand Blenders',
  'sandwich-makers':    'Sandwich Makers',
  'rice-cookers':       'Rice Cookers',
}

const CAT_INTROS = {
  'air-fryers':         'Air fryers are now India\'s fastest-growing kitchen appliance — delivering crispy results with 80% less oil than traditional frying. Whether you\'re making samosas, french fries, or grilled chicken, the right air fryer transforms everyday cooking while cutting calories.',
  'mixer-grinders':     'A good mixer grinder is the backbone of an Indian kitchen. From morning idli batter to evening chutneys, it handles everything. The right one saves time, lasts years, and handles the heavy-duty grinding that softer Western blenders can\'t match.',
  'coffee-machines':    'India\'s coffee culture has outgrown instant powder. Whether you\'re a filter coffee loyalist or an espresso enthusiast, a coffee machine delivers café-quality results at home — and pays for itself within months compared to daily coffee shop visits.',
  'induction-cooktops': 'Induction cooktops offer precise temperature control, energy efficiency, and safety — no open flame, no gas leak risk. They\'re ideal for Indian cooking styles that demand quick high-heat sautéing and patient low-heat simmering.',
  'electric-kettles':   'Electric kettles boil water faster than any stovetop, with lower energy consumption. Modern models with temperature control unlock pour-over coffee, green tea, and French press at their intended temperatures.',
  'food-processors':    'Food processors cut prep time dramatically for Indian cooking — from grating coconut and making fresh paneer to kneading dough and slicing vegetables. A good processor handles tasks that would take 30 minutes by hand in under 5.',
  'hand-blenders':      'Hand blenders (immersion blenders) are the space-saving workhorse of the modern kitchen. Blend soups directly in the pot, make smoothies in the glass, whip cream in the bowl — no transfer, minimal cleanup.',
  'sandwich-makers':    'Sandwich makers and grills are quick breakfast essentials that go beyond sandwiches. The right one handles everything from classic grilled cheese to paninis and Indian-style toast, with even browning and non-stick cleanup.',
  'rice-cookers':       'Electric rice cookers deliver perfectly cooked rice every time — no watching, no overflow, no burning. They also handle dal, khichdi, and steam cooking. Set it, forget it, eat it.',
}

const CAT_BUYING_FACTORS = {
  'air-fryers':         ['Capacity (litres) — 2–3L for 1–2 people, 4–6L for families', 'Motor wattage (1200–1800W)', 'Temperature range and precision', 'Preset functions', 'Non-stick basket quality', 'Timer and digital controls', 'Easy cleaning / dishwasher-safe basket'],
  'mixer-grinders':     ['Motor power (500–1000W)', 'Number of jars and sizes', 'Jar material (stainless steel vs polycarbonate)', 'Speed settings', 'Overload protection', 'Warranty (minimum 2 years)', 'Noise dampening'],
  'coffee-machines':    ['Type (drip, espresso, pour-over, capsule/pod)', 'Brewing pressure in bar (espresso needs 9+ bar)', 'Capacity (cups per brew)', 'Milk frothing capability', 'Ease of cleaning', 'Filter type', 'Brew temperature control'],
  'induction-cooktops': ['Wattage (1200–2000W)', 'Temperature range and precision', 'Compatible cookware requirements', 'Keep-warm function', 'Auto shut-off safety feature', 'Boost/fast-heat mode', 'Display type (digital vs touch)'],
  'electric-kettles':   ['Capacity (1–1.5L standard for home use)', 'Wattage (1200–2200W)', 'Temperature control vs single-boil', 'Keep-warm function', 'Material (stainless steel inside vs plastic)', 'Cordless design with 360° base', 'Boil-dry protection'],
  'food-processors':    ['Motor wattage (600–1200W)', 'Bowl capacity', 'Attachments included (blades, discs, dough hook)', 'Blade material quality', 'Pulse function', 'Dishwasher-safe removable parts', 'Storage footprint'],
  'hand-blenders':      ['Motor power (250–800W)', 'Variable speed settings', 'Attachments (chopper bowl, whisk, beaker)', 'Shaft material (stainless steel preferred)', 'Detachable shaft for cleaning', 'Splatter guard', 'Ergonomic grip and button layout'],
  'sandwich-makers':    ['Plate type (flat grill, triangular toast, waffle, multi-use)', 'Non-stick coating quality', 'Power (750–1500W)', 'Floating hinge for thick bread', 'Ready indicator lights', 'Cool-touch exterior', 'Easy wipe-down or removable plates'],
  'rice-cookers':       ['Capacity — 1L for 2 people, 1.8L for 4, 2.8L+ for large households', 'Keep-warm function duration', 'Non-stick inner pot quality', 'Steam tray included', 'Auto shut-off and thermal cut-off', 'Multi-cook functions (steam, slow cook)', 'Ease of cleaning'],
}

function titleCase(slug) {
  return (slug || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function reviewCountInt(raw) {
  return parseInt(String(raw || '0').replace(/[^0-9]/g, '')) || 0
}

function sortByPopularity(products) {
  return [...products].sort((a, b) => {
    const ra = reviewCountInt(a._legacy?.review_count)
    const rb = reviewCountInt(b._legacy?.review_count)
    return rb - ra
  })
}

function buildProductSummary(product) {
  const specs = product.specifications || {}
  const cap  = specs['Capacity'] || specs['Volume'] || specs['Bowl Capacity'] || ''
  const w    = specs['Output Wattage'] || specs['Wattage'] || ''
  const ctrl = specs['Control Method'] || specs['Controller Type'] || ''
  const parts = []
  if (cap)  parts.push(cap.replace(/\s*lit(re|er)s?\b/i, 'L'))
  if (w)    parts.push(w.replace(/\s*Watts?\b/i, 'W'))
  if (ctrl && ctrl.length < 20) parts.push(ctrl + ' controls')
  return parts.slice(0, 3).join(' · ')
}

function buildProductProse(product) {
  const feats = product.specifications?._features || []
  for (const f of feats) {
    const clean = f
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\n[\s\S]*/m, '')
      .replace(/^\s*[-•]\s*/, '')
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}\u{2B00}-\u{2BFF}]/gu, '')
      .trim()
    if (clean.length >= 25 && clean.length <= 180) return clean
  }
  // Fallback: sentence from specs
  const specs = product.specifications || {}
  const cap   = specs['Capacity'] || specs['Volume'] || ''
  const w     = specs['Output Wattage'] || specs['Wattage'] || ''
  const parts = []
  if (cap) parts.push(cap.replace(/\s*lit(re|er)s?\b/i, 'L') + ' capacity')
  if (w)   parts.push(w.replace(/\s*Watts?\b/i, 'W'))
  return parts.length ? parts.join(', ') + '.' : ''
}

function buildStarRating(rating, reviewCount) {
  const r = parseFloat(rating)
  if (!r || isNaN(r)) return ''
  let stars = ''
  for (let i = 1; i <= 5; i++) {
    const fill = r >= i - 0.25 ? '#e67e22' : r >= i - 0.75 ? null : '#2a2a2a'
    if (fill) {
      stars += `<span style="color:${fill};">★</span>`
    } else {
      stars += `<span style="color:#e67e22;opacity:0.45;">★</span>`
    }
  }
  const cnt = parseInt(String(reviewCount || '0').replace(/[^0-9]/g, '')) || 0
  const cntStr = cnt > 0
    ? ` <span style="color:#666;font-size:11px;">(${cnt >= 1000 ? (cnt/1000).toFixed(1)+'k' : cnt} reviews)</span>`
    : ''
  return `<div style="margin:3px 0 7px;line-height:1;">${stars} <span style="color:#c8c8c8;font-size:12px;">${r.toFixed(1)}</span>${cntStr}</div>`
}

function cleanProductName(name, maxLen = 82) {
  const s = (name || '').trim()
  if (s.length <= maxLen) return s
  const cut = s.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > maxLen * 0.7 ? cut.slice(0, lastSpace) : cut) + '…'
}

const CAT_SINGULAR = {
  'Air Fryers': 'Air Fryer', 'Mixer Grinders': 'Mixer Grinder',
  'Coffee Machines': 'Coffee Machine', 'Induction Cooktops': 'Induction Cooktop',
  'Electric Kettles': 'Electric Kettle', 'Food Processors': 'Food Processor',
  'Hand Blenders': 'Hand Blender', 'Sandwich Makers': 'Sandwich Maker',
  'Rice Cookers': 'Rice Cooker',
}

const SEG_BADGE = {
  'budget':    { label: 'Budget Pick', color: '#27ae60' },
  'mid-range': { label: 'Mid-Range',   color: '#e67e22' },
  'premium':   { label: 'Premium',     color: '#3498db' },
  'flagship':  { label: 'Flagship',    color: '#9b59b6' },
}

// ── Category Hub HTML ─────────────────────────────────────────────────────────

function buildCategoryHubHTML(catSlug, products) {
  const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
  const intro = CAT_INTROS[catSlug] || `Find the best ${catLabel} available in India with prices, specifications, and honest buying advice.`
  const factors = CAT_BUYING_FACTORS[catSlug] || []
  const sorted = sortByPopularity(products).slice(0, 20)

  // Keep slug+label pairs for brand page links
  const brandEntries = [...new Map(
    sorted.map(p => p.brand_id).filter(Boolean).map(b => [b, titleCase(b)])
  ).entries()]

  const productRows = sorted.map((p, i) => {
    const offer    = resolveOffer(p)
    const link     = affiliateLink(offer, 'hub')
    const name     = cleanProductName(p.product_name || p._legacy?.name || 'Product')
    const brand    = titleCase(p.brand_id || '')
    const imgSrc   = p.wp_image_url || p._legacy?.img || ''
    const specLine = buildProductSummary(p)
    const prose    = buildProductProse(p)
    const starHtml = buildStarRating(p._legacy?.rating, p._legacy?.review_count)
    const seg      = p.price_segment || 'mid-range'
    const badge    = SEG_BADGE[seg] || SEG_BADGE['mid-range']
    const isTop3   = i < 3

    return `<div style="border:1px solid ${isTop3 ? 'rgba(230,126,34,0.3)' : '#2a2a2a'};border-radius:8px;padding:16px 20px;margin-bottom:12px;display:flex;gap:16px;align-items:flex-start;background:${isTop3 ? 'rgba(230,126,34,0.04)' : '#1a1a1a'};">
  <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;font-weight:700;color:${isTop3 ? '#e67e22' : '#5f5f5f'};flex:0 0 24px;padding-top:2px;">#${i+1}</div>
  ${imgSrc ? `<img src="${imgSrc}" alt="${name}" loading="lazy" style="width:88px;height:88px;object-fit:contain;border-radius:6px;background:#141414;flex:0 0 88px;border:1px solid #2a2a2a;">` : `<div style="width:88px;height:88px;flex:0 0 88px;background:#141414;border:1px solid #2a2a2a;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#5f5f5f;font-family:'JetBrains Mono',monospace;">IMG</div>`}
  <div style="flex:1;min-width:0;">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
      <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">${brand}</span>
      <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,0.06);color:${badge.color};border:1px solid ${badge.color}44;">${badge.label}</span>
    </div>
    <h3 style="font-size:15px;font-weight:600;line-height:1.4;margin:0 0 2px;color:#f0f0f0;">${name}</h3>
    ${starHtml}
    ${specLine ? `<p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:#5f5f5f;margin:0 0 5px;line-height:1.4;">${specLine}</p>` : ''}
    ${prose ? `<p style="font-size:13px;color:#a0a0a0;margin:0 0 10px;line-height:1.55;">${prose}</p>` : ''}
    <a href="${link}" target="_blank" rel="nofollow sponsored noopener" style="display:inline-block;background:#e67e22;color:#140a02;text-decoration:none;font-size:13px;font-weight:700;padding:7px 16px;border-radius:4px;">Check price on Amazon →</a>
  </div>
</div>`
  }).join('\n')

  const factorItems = factors.map(f => `<li style="margin-bottom:5px;">${f}</li>`).join('\n')

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `Best ${catLabel} in India ${YEAR} — Prices, Reviews & Deals`,
        description: `Comprehensive guide to the best ${catLabel} available in India. Compare prices, specifications, and features across all budgets.`,
        url: `https://pricehawk.in/best-${catSlug}/`,
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pricehawk.in/' },
            { '@type': 'ListItem', position: 2, name: `Best ${catLabel}`, item: `https://pricehawk.in/best-${catSlug}/` },
          ]
        }
      },
      {
        '@type': 'ItemList',
        name: `Best ${catLabel} in India ${YEAR}`,
        numberOfItems: sorted.length,
        itemListElement: sorted.slice(0, 10).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.product_name || p._legacy?.name,
          url: resolveOffer(p).affiliate_url,
        }))
      }
    ]
  }

  return postShell(`${buildPageStyles()}

${asciDisclosure()}

<p style="font-size:16px;line-height:1.7;color:#c8c8c8;">${intro}</p>

${methodologyBlock(`This page covers ${products.length} ${catLabel} models available on Amazon India.`)}

<nav style="background:#1a1a1a;border:1px solid #2a2a2a;padding:10px 16px;border-radius:4px;margin-bottom:24px;font-size:13px;font-family:'JetBrains Mono',ui-monospace,monospace;color:#888;">
<span style="color:#e67e22;font-weight:700;">Browse by brand:</span> ${brandEntries.slice(0, 10).map(([slug, label]) => `<a href="/${catSlug}-${slug}/" style="margin:0 6px;color:#c8c8c8;text-decoration:none;border-bottom:1px solid #3a3a3a;">${label}</a>`).join('<span style="color:#3a3a3a;">·</span>')}
</nav>

<h2 style="font-size:22px;font-weight:700;margin:24px 0 4px;color:#f0f0f0;letter-spacing:-0.02em;">Top ${catLabel} in India ${YEAR}</h2>
<p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#888;margin-bottom:16px;">Sorted by popularity on Amazon India. Click any product to check the latest price.</p>

${productRows}

${factors.length ? `<h2 style="font-size:20px;font-weight:700;margin:32px 0 12px;color:#f0f0f0;">What to look for when buying ${CAT_SINGULAR[catLabel] ? 'an' : 'a'} ${CAT_SINGULAR[catLabel] || catLabel}</h2>
<ul style="font-size:15px;line-height:1.7;color:#c8c8c8;">
${factorItems}
</ul>` : ''}

<hr style="margin:32px 0;border:none;border-top:1px solid #2a2a2a;">
<p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#5f5f5f;line-height:1.6;">Prices on Amazon India change frequently. Click "Check price on Amazon" to see the current price. PriceHawk is not responsible for price changes after page publication.</p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
</script>`)
}

// ── Brand Hub HTML ─────────────────────────────────────────────────────────────

function buildBrandPageHTML(brand, catSlug, brandProducts) {
  const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
  const sorted = sortByPopularity(brandProducts)

  const productRows = sorted.map((p, i) => {
    const offer = resolveOffer(p)
    const link  = affiliateLink(offer, 'hub')
    const name  = p.product_name || p._legacy?.name || 'Product'
    const img   = p._legacy?.img || ''
    const summary = buildProductSummary(p)
    const seg   = p.price_segment || 'mid-range'
    const badge = SEG_BADGE[seg] || SEG_BADGE['mid-range']

    return `<div style="border:1px solid #2a2a2a;border-radius:8px;padding:16px 20px;margin-bottom:10px;display:flex;gap:16px;align-items:flex-start;background:#1a1a1a;">
  ${img ? `<img src="${img}" alt="${name}" loading="lazy" style="width:80px;height:80px;object-fit:contain;border-radius:6px;background:#141414;flex:0 0 80px;border:1px solid #2a2a2a;">` : `<div style="width:80px;height:80px;flex:0 0 80px;background:#141414;border:1px solid #2a2a2a;border-radius:6px;"></div>`}
  <div style="flex:1;min-width:0;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <span style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;font-weight:700;color:#5f5f5f;">#${i+1}</span>
      <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;color:${badge.color};border:1px solid ${badge.color}44;background:rgba(255,255,255,0.04);">${badge.label}</span>
    </div>
    <h3 style="font-size:15px;font-weight:600;margin:0 0 6px;line-height:1.4;color:#f0f0f0;">${name}</h3>
    ${summary ? `<p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:#888;margin:0 0 10px;">${summary}</p>` : ''}
    <a href="${link}" target="_blank" rel="nofollow sponsored noopener" style="display:inline-block;background:#e67e22;color:#140a02;text-decoration:none;font-size:13px;font-weight:700;padding:7px 16px;border-radius:4px;">Check price on Amazon →</a>
  </div>
</div>`
  }).join('\n')

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${brand} ${catLabel} India — Best Prices & Reviews`,
    description: `All ${brand} ${catLabel} models available on Amazon India. Compare features and find the best price.`,
    url: `https://pricehawk.in/${catSlug}-${brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pricehawk.in/' },
        { '@type': 'ListItem', position: 2, name: `Best ${catLabel}`, item: `https://pricehawk.in/best-${catSlug}/` },
        { '@type': 'ListItem', position: 3, name: brand, item: `https://pricehawk.in/${catSlug}-${brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/` },
      ]
    }
  }

  return postShell(`${buildPageStyles()}

${asciDisclosure()}

<p style="font-size:16px;line-height:1.7;color:#c8c8c8;">${brand} is one of the most widely reviewed ${catLabel} brands on Amazon India. Below is the complete ${brand} ${catLabel} range — updated regularly by PriceHawk.</p>

${methodologyBlock(`This page covers ${sorted.length} ${brand} ${catLabel} models available on Amazon India.`)}

<h2 style="font-size:22px;font-weight:700;margin:24px 0 12px;color:#f0f0f0;letter-spacing:-0.02em;">${brand} ${catLabel} — All Models</h2>

${productRows}

<hr style="margin:28px 0;border:none;border-top:1px solid #2a2a2a;">
<p><a href="/best-${catSlug}/" style="color:#e67e22;font-weight:600;">← Back to Best ${catLabel} in India ${YEAR}</a></p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
</script>`)
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dryRun    = args.includes('--dry-run')
  const catFilter = args.includes('--cat') ? args[args.indexOf('--cat') + 1] : null
  const typeFilter = args.includes('--type') ? args[args.indexOf('--type') + 1] : null
  const topBrands = args.includes('--brands') ? parseInt(args[args.indexOf('--brands') + 1]) || 3 : 3

  if (!WP || !USER || !PASS) { console.error('Missing WP credentials in .env'); process.exit(1) }

  const stats = { category_page: 0, brand_page: 0, errors: 0 }
  const cats = catFilter ? [catFilter] : KITCHEN_BEACHHEAD

  for (const catSlug of cats) {
    const file = path.join(PRODS_DIR, `${catSlug}.json`)
    if (!fs.existsSync(file)) { console.log(`\n[${catSlug}] skip — no data file`); continue }

    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const products = (data.products || [])
      .filter(p => p.product_id && p.status === 'active')
      .filter(p => !/\bchopper\b/i.test(p.product_name || p._legacy?.name || ''))
    if (!products.length) { console.log(`\n[${catSlug}] skip — 0 migrated products`); continue }

    const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
    console.log(`\n[${catSlug}] ${products.length} products`)

    // Category hub
    if (!typeFilter || typeFilter === 'category_page') {
      try {
        const productCount = products.length
        const hubMeta = `Best ${catLabel} in India ${YEAR} — ${productCount} models compared by specs, brand, and value for Indian buyers.`
        const hubMd = hubMeta.length > 160 ? hubMeta.substring(0, 157) + '…' : hubMeta
        const hubImg = products.find(p => p.wp_image_id)?.wp_image_id || null
        const result = await wpUpsertPage({
          title:   `Best ${catLabel} in India ${YEAR} — Prices, Reviews & Deals`,
          slug:    `best-${catSlug}`,
          content: buildCategoryHubHTML(catSlug, products),
        }, { wp: WP, auth: AUTH, dryRun, metaDesc: hubMd, focusKw: `best ${catLabel.toLowerCase()} in india`, postType: 'posts', featuredMediaId: hubImg })
        if (result) console.log(`  ✓ category hub [${result.action}]: ${result.link}`)
        stats.category_page++
      } catch (e) {
        console.error(`  ✗ category hub: ${e.message}`)
        stats.errors++
      }
    }

    // Brand pages — top N brands by product count
    if (!typeFilter || typeFilter === 'brand_page') {
      const brandMap = {}
      for (const p of products) {
        if (!p.brand_id || p.brand_id === 'unknown') continue
        if (!TRUSTED_BRAND_SLUGS.has(p.brand_id)) continue
        ;(brandMap[p.brand_id] = brandMap[p.brand_id] || []).push(p)
      }
      const topBrandEntries = Object.entries(brandMap)
        .filter(([, prods]) => prods.length >= 2) // min 2 products per brand
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, topBrands)

      for (const [brandSlug, brandProducts] of topBrandEntries) {
        const brand = titleCase(brandSlug)
        try {
          const brandMeta = `${brand} ${catLabel} in India — full range with specs and Amazon prices. Find the right model for your needs.`
          const brandMd = brandMeta.length > 160 ? brandMeta.substring(0, 157) + '…' : brandMeta
          const brandImg = brandProducts.find(p => p.wp_image_id)?.wp_image_id || null
          const result = await wpUpsertPage({
            title:   `${brand} ${catLabel} India — Best Prices & Reviews`,
            slug:    `${catSlug}-${brandSlug}`,
            content: buildBrandPageHTML(brand, catSlug, brandProducts),
          }, { wp: WP, auth: AUTH, dryRun, metaDesc: brandMd, focusKw: `${brand.toLowerCase()} ${catLabel.toLowerCase()}`, postType: 'posts', featuredMediaId: brandImg })
          if (result) console.log(`  ✓ brand [${brand}] [${result.action}]: ${result.link}`)
          stats.brand_page++
        } catch (e) {
          console.error(`  ✗ brand [${brand}]: ${e.message}`)
          stats.errors++
        }
      }
    }
  }

  console.log(`\n── DONE ────────────────────────────`)
  console.log(`Category hubs: ${stats.category_page}`)
  console.log(`Brand pages:   ${stats.brand_page}`)
  console.log(`Errors:        ${stats.errors}`)
  if (dryRun) console.log('(dry run — no WP changes made)')
}

if (require.main === module) {
  main().catch(e => { console.error(e.message); process.exit(1) })
}
