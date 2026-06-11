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
const { asciDisclosure, methodologyBlock, resolveOffer, metaDescription } = require('./lib/content')
const { buildPageStyles } = require('./lib/styles')

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

// ── Category Hub HTML ─────────────────────────────────────────────────────────

function buildCategoryHubHTML(catSlug, products) {
  const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
  const intro = CAT_INTROS[catSlug] || `Find the best ${catLabel} available in India with prices, specifications, and honest buying advice.`
  const factors = CAT_BUYING_FACTORS[catSlug] || []
  const sorted = sortByPopularity(products).slice(0, 20)

  const brands = [...new Set(
    sorted.map(p => p.brand_id).filter(Boolean).map(b => titleCase(b))
  )]

  const productRows = sorted.map((p, i) => {
    const link = resolveOffer(p).affiliate_url || `https://www.amazon.in/dp/${resolveOffer(p).external_id}?tag=${TAG}`
    const name = p.product_name || p._legacy?.name || 'Product'
    const brand = titleCase(p.brand_id || '')

    return `<div style="border-bottom:1px solid #e8e8e8;padding:16px 0;display:flex;gap:16px;align-items:flex-start;">
  <div style="background:#f0f0f0;border-radius:4px;width:56px;height:56px;flex:0 0 56px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#aaa;text-align:center;line-height:1.2;">[img]</div>
  <div style="flex:1;min-width:0;">
    <p style="font-size:11px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 2px;">${brand}</p>
    <h3 style="font-size:15px;font-weight:600;line-height:1.4;margin:0 0 10px;color:#111;">${i + 1}. ${name}</h3>
    <a href="${link}" target="_blank" rel="nofollow sponsored noopener" style="display:inline-block;background:#e67e22;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:7px 16px;border-radius:4px;">Check price on Amazon →</a>
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

  return `${buildPageStyles()}

${asciDisclosure()}

<p style="font-size:16px;line-height:1.7;color:#333;">${intro}</p>

${methodologyBlock(`This page covers ${products.length} ${catLabel} models available on Amazon India.`)}

<nav style="background:#f9f9f9;border:1px solid #e0e0e0;padding:10px 16px;border-radius:4px;margin-bottom:24px;font-size:13px;">
<strong>Browse by brand:</strong> ${brands.slice(0, 10).map(b => `<span style="margin:0 6px;">${b}</span>`).join('·')}
</nav>

<h2 style="font-size:22px;font-weight:700;margin:24px 0 4px;">Top ${catLabel} in India ${YEAR}</h2>
<p style="font-size:14px;color:#666;margin-bottom:16px;">Sorted by popularity on Amazon India. Click any product to check the latest price.</p>

${productRows}

${factors.length ? `<h2 style="font-size:20px;font-weight:700;margin:32px 0 12px;">What to look for when buying a ${catLabel}</h2>
<ul style="font-size:15px;line-height:1.7;color:#333;">
${factorItems}
</ul>` : ''}

<hr style="margin:32px 0;border:none;border-top:1px solid #e0e0e0;">
<p style="font-size:12px;color:#999;line-height:1.6;">Prices on Amazon India change frequently. Click "Check price on Amazon" to see the current price. PriceHawk is not responsible for price changes after page publication.</p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
</script>`
}

// ── Brand Hub HTML ─────────────────────────────────────────────────────────────

function buildBrandPageHTML(brand, catSlug, brandProducts) {
  const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
  const sorted = sortByPopularity(brandProducts)

  const productRows = sorted.map((p, i) => {
    const link = resolveOffer(p).affiliate_url || `https://www.amazon.in/dp/${resolveOffer(p).external_id}?tag=${TAG}`
    const name = p.product_name || p._legacy?.name || 'Product'

    return `<div style="border-bottom:1px solid #e8e8e8;padding:14px 0;">
  <h3 style="font-size:15px;font-weight:600;margin:0 0 8px;line-height:1.4;color:#111;">${i + 1}. ${name}</h3>
  <a href="${link}" target="_blank" rel="nofollow sponsored noopener" style="display:inline-block;background:#e67e22;color:#fff;text-decoration:none;font-size:13px;font-weight:700;padding:7px 16px;border-radius:4px;">Check price on Amazon →</a>
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

  return `${buildPageStyles()}

${asciDisclosure()}

<p style="font-size:16px;line-height:1.7;color:#333;">${brand} is one of the most widely reviewed ${catLabel} brands on Amazon India. Below is the complete ${brand} ${catLabel} range — updated regularly by PriceHawk.</p>

${methodologyBlock(`This page covers ${sorted.length} ${brand} ${catLabel} models available on Amazon India.`)}

<h2 style="font-size:22px;font-weight:700;margin:24px 0 12px;">${brand} ${catLabel} — All Models</h2>

${productRows}

<hr style="margin:28px 0;border:none;border-top:1px solid #e0e0e0;">
<p><a href="/best-${catSlug}/" style="color:#e65100;font-weight:600;">← Back to Best ${catLabel} in India ${YEAR}</a></p>

<script type="application/ld+json">
${JSON.stringify(schema, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
</script>`
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
    const products = (data.products || []).filter(p => p.product_id) // migrated only
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
