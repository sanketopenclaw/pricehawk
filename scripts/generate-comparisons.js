/**
 * PriceHawk G3 — Product Comparison page generator
 * Kitchen beachhead Phase 1. Pushes WP draft pages.
 * No scraped prices/images/ratings displayed — compliance by construction.
 *
 * Usage:
 *   node scripts/generate-comparisons.js               # all Phase 1 comparisons
 *   node scripts/generate-comparisons.js --cat air-fryers
 *   node scripts/generate-comparisons.js --dry-run
 *   node scripts/generate-comparisons.js --limit 10
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
  'air-fryers': 'Air Fryer', 'mixer-grinders': 'Mixer Grinder',
  'coffee-machines': 'Coffee Machine', 'induction-cooktops': 'Induction Cooktop',
  'electric-kettles': 'Electric Kettle', 'food-processors': 'Food Processor',
  'hand-blenders': 'Hand Blender', 'sandwich-makers': 'Sandwich Maker',
  'rice-cookers': 'Rice Cooker',
}

// Key differentiators per category — shown in the comparison intro
const CAT_DIFFERENTIATORS = {
  'air-fryers': ['Capacity (litres)', 'Power (watts)', 'Cooking presets', 'Controls', 'Coating'],
  'mixer-grinders': ['Power (watts)', 'Number of jars', 'Jar material', 'Warranty'],
  'coffee-machines': ['Coffee type', 'Capacity (cups)', 'Pressure (bar)', 'Milk frother'],
  'induction-cooktops': ['Power (watts)', 'Temperature range', 'Presets', 'Display'],
  'electric-kettles': ['Capacity (litres)', 'Power (watts)', 'Material', 'Temperature control'],
  'food-processors': ['Power (watts)', 'Bowl capacity', 'Attachments', 'Pulse function'],
  'hand-blenders': ['Power (watts)', 'Speed settings', 'Shaft material', 'Attachments'],
  'sandwich-makers': ['Power (watts)', 'Plate type', 'Non-stick coating', 'Indicator'],
  'rice-cookers': ['Capacity (litres)', 'Keep-warm', 'Inner pot', 'Multi-cook'],
}

const CAT_FAQS = {
  'air-fryers': [
    ['Which air fryer should I buy — a larger or smaller one?', 'For 1–2 people, a 2–3L capacity is adequate and heats up faster. For a family of 4, a 4–6L model is the practical choice. Larger does not always mean better — oversized baskets can distribute heat unevenly for small food portions.'],
    ['Do all air fryers perform equally at the same wattage?', 'No. Wattage determines maximum heat output, but heating element design, fan placement, and basket construction affect actual cooking performance. Higher-reviewed models within the same wattage typically have better airflow engineering.'],
  ],
  'mixer-grinders': [
    ['Is there a big performance difference between mixer grinders at similar wattage?', 'Yes. Motor quality, jar shape, and blade design vary significantly even at the same wattage. Indian brands like Preethi and Butterfly are engineered specifically for Indian wet grinding requirements — idli/dosa batter performance differs even at identical wattages.'],
    ['How long do mixer grinders typically last?', 'With normal household use (1–2 grinding sessions daily), a quality mixer grinder should last 5–8 years. Motor overheating from continuous long-duration use is the primary cause of premature failure.'],
  ],
  'coffee-machines': [
    ['Is the coffee quality difference noticeable between models?', 'For basic filter or drip coffee, differences are minor. For espresso, pressure (bar) and temperature stability matter significantly — higher-end models extract better crema and more complex flavour. If you drink 1 cup of instant-substitute coffee per day, a basic machine suffices.'],
    ['What ongoing costs should I factor in?', 'For capsule/pod machines, pod costs (₹40–80 each) add up quickly versus ground coffee (₹15–25 per cup). Descaling tablets (₹150–300) are needed every 1–3 months. Grinders add cost but significantly improve fresh-ground quality.'],
  ],
  'induction-cooktops': [
    ['Does wattage matter for an induction cooktop?', '1200–1500W suits smaller vessels and moderate cooking. 1800–2000W brings larger vessels to boil faster and is better for high-heat cooking like stir-frying. The performance gap is noticeable for large-batch cooking.'],
    ['Which brand has better after-sales service for induction cooktops in India?', 'Philips, Havells, and Bajaj have broad service networks across India. For tier-2/tier-3 cities, established Indian brands often have faster service turnaround than imported brands.'],
  ],
  'electric-kettles': [
    ['Is there a real difference between a ₹600 and ₹1,500 kettle?', 'Yes — primarily in interior material (stainless vs plastic), keep-warm function, and build longevity. For daily tea and coffee use, the stainless interior and better seal of a mid-range kettle is worth the difference for most households.'],
    ['How often should I descale an electric kettle?', 'Monthly in hard water cities (Delhi, Bengaluru, Mumbai, Chennai). Limestone build-up reduces heating efficiency and affects taste. Use equal parts white vinegar and water, boil, let sit 30 minutes, rinse thoroughly.'],
  ],
  'food-processors': [
    ['Can I replace one with the other — food processor vs mixer grinder?', 'Partially. A food processor handles solid food prep (slicing, shredding, kneading) better. A mixer grinder handles wet grinding (idli batter, chutneys) better. Homes that do both will benefit most from having one of each.'],
    ['What attachments are most useful for Indian cooking?', 'The standard slicing and chopping discs handle onions, vegetables, and salads. A dough blade for roti/paratha dough. A fine grater for coconut. Juicer attachments are rarely as good as a standalone juicer for high-volume Indian fruit juices.'],
  ],
  'hand-blenders': [
    ['Can I use a hand blender for hot soups?', 'Yes — this is one of the main advantages. Submerge the head fully, use a tall container to prevent splatter, and start at low speed. Most hand blenders handle hot liquids well; check the manufacturer spec for temperature limits.'],
    ['Is a higher-wattage hand blender noticeably better?', 'For smoothies and soups, 300–400W is adequate. For crushing ice or extended continuous use, 600W+ makes a real difference. High-wattage models also tend to have better-quality shafts and blades.'],
  ],
  'sandwich-makers': [
    ['Are sandwich makers with removable plates worth the higher cost?', 'For cleaning ease: yes, significantly. For versatility (grill + waffle): yes if you use those functions. For basic daily sandwiches: a fixed-plate model is simpler and equally effective.'],
    ['How do I extend the life of a sandwich maker?', 'Wipe the plates with a damp cloth while still slightly warm — food residue is much easier to remove at this stage. Avoid metal utensils on non-stick surfaces. Store with the lid open to prevent the plates from pressing together when not in use.'],
  ],
  'rice-cookers': [
    ['Is a rice cooker worth buying if you already have a pressure cooker?', 'Different use cases. A rice cooker delivers perfectly consistent results without monitoring, frees up a burner, and automatically switches to keep-warm. A pressure cooker is faster for combined dal+rice cooking. Both have a place in Indian kitchens.'],
    ['What capacity is right for my family size?', '1–1.5L for 1–2 people (2–3 cups dry rice). 1.8L for 3–4 people (4 cups dry rice). 2.8L+ for families of 5–6 or if you cook rice in batches for the day. Cooking a small amount in a large cooker produces uneven results.'],
  ],
}

// ── Spec extraction (shared with generate-reviews.js) ────────────────────────

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

function shortName(name, maxLen = 50) {
  const clean = (name || '').replace(/\s*[\\|,].*$/, '').trim()
  return clean.length > maxLen ? clean.substring(0, maxLen - 1) + '…' : clean
}

// ── Compliance blocks ────────────────────────────────────────────────────────

const ASCI_DISCLOSURE = `<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:10px 16px;font-size:13px;line-height:1.5;margin-bottom:20px;">
<strong>Affiliate Disclosure:</strong> PriceHawk earns a commission on qualifying purchases made through links on this page. This never influences our editorial recommendations. As an Amazon Associate I earn from qualifying purchases.
</div>`

function methodologyBlock(name1, name2) {
  return `<div style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:14px 18px;margin:24px 0;font-size:13px;line-height:1.6;">
<strong>PriceHawk Methodology:</strong> This comparison is based on published specifications for the <em>${name1}</em> and <em>${name2}</em>, competitive positioning within each product's price segment, aggregated user experience from published reviews, and PriceHawk's ongoing price tracking. PriceHawk has not independently lab-tested either unit. All opinions are based on documented specifications and public user feedback — not hands-on testing.
</div>`
}

// ── Comparison HTML builder ───────────────────────────────────────────────────

function buildComparisonHTML(p1, p2, catSlug) {
  const name1  = p1.product_name || p1._legacy?.name || 'Product 1'
  const name2  = p2.product_name || p2._legacy?.name || 'Product 2'
  const brand1 = titleCase(p1.brand_id || '')
  const brand2 = titleCase(p2.brand_id || '')
  const short1 = shortName(name1)
  const short2 = shortName(name2)
  const link1  = p1.offers?.affiliate_url || `https://www.amazon.in/dp/${p1.offers?.external_id || p1._legacy?.asin}?tag=${TAG}`
  const link2  = p2.offers?.affiliate_url || `https://www.amazon.in/dp/${p2.offers?.external_id || p2._legacy?.asin}?tag=${TAG}`
  const asin1  = p1.offers?.external_id || p1._legacy?.asin || ''
  const asin2  = p2.offers?.external_id || p2._legacy?.asin || ''
  const seg1   = p1.price_segment || p1._legacy?.price_segment || 'mid-range'
  const seg2   = p2.price_segment || p2._legacy?.price_segment || 'mid-range'
  const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
  const faqs   = CAT_FAQS[catSlug] || []

  const specs1 = extractSpecs(name1)
  const specs2 = extractSpecs(name2)

  // Build unified spec rows (all keys from both products)
  const allKeys = [...new Set([...Object.keys(specs1), ...Object.keys(specs2)])]

  const specRowsHTML = allKeys.length
    ? allKeys.map(k => `  <tr style="border-bottom:1px solid #e8e8e8;">
    <td style="padding:8px 12px;color:#666;font-weight:600;font-size:13px;width:25%;">${titleCase(k.replace(/_/g,' '))}</td>
    <td style="padding:8px 12px;font-size:13px;width:37.5%;${specs1[k] ? '' : 'color:#bbb;'}">${specs1[k] || '—'}</td>
    <td style="padding:8px 12px;font-size:13px;width:37.5%;${specs2[k] ? '' : 'color:#bbb;'}">${specs2[k] || '—'}</td>
  </tr>`).join('\n')
    : `  <tr><td colspan="3" style="padding:12px;color:#999;font-size:13px;">Refer to Amazon product pages for full technical specifications.</td></tr>`

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
        '@type': 'ItemList',
        name: `${short1} vs ${short2} — ${catLabel} Comparison`,
        description: `A detailed comparison of ${name1} and ${name2} to help Indian buyers choose the right ${catLabel.toLowerCase()}.`,
        numberOfItems: 2,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: name1,
            url: link1,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: name2,
            url: link2,
          },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pricehawk.in/' },
          { '@type': 'ListItem', position: 2, name: `Best ${catLabel}s`, item: `https://pricehawk.in/best-${catSlug}/` },
          { '@type': 'ListItem', position: 3, name: `${short1} vs ${short2}`, item: `https://pricehawk.in/compare-${slugify(brand1)}-${asin1.toLowerCase()}-vs-${slugify(brand2)}-${asin2.toLowerCase()}/` },
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
<a href="/" style="color:#666;">Home</a> › <a href="/best-${catSlug}/" style="color:#666;">Best ${catLabel}s in India ${YEAR}</a> › Comparison
</nav>

<p style="font-size:16px;line-height:1.7;color:#333;">
Choosing between the <strong>${short1}</strong> and the <strong>${short2}</strong>?
This comparison breaks down the key specification differences between both models to help you decide which is the better fit for your household.
</p>

<!-- Side-by-side product cards -->
<div style="display:flex;gap:16px;margin:24px 0;flex-wrap:wrap;">
  <div style="flex:1;min-width:220px;border:1px solid #e0e0e0;border-radius:6px;padding:16px;">
    <p style="font-size:12px;color:#888;font-weight:700;text-transform:uppercase;margin:0 0 6px;">${brand1}</p>
    <p style="font-size:15px;font-weight:700;margin:0 0 14px;line-height:1.4;">${short1}</p>
    <p style="font-size:13px;color:#666;margin:0 0 12px;">Price segment: <strong>${seg1.replace('-',' ')}</strong></p>
    <a href="${link1}" target="_blank" rel="nofollow sponsored noopener"
       style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
      Check price on Amazon →
    </a>
  </div>
  <div style="flex:1;min-width:220px;border:1px solid #e0e0e0;border-radius:6px;padding:16px;">
    <p style="font-size:12px;color:#888;font-weight:700;text-transform:uppercase;margin:0 0 6px;">${brand2}</p>
    <p style="font-size:15px;font-weight:700;margin:0 0 14px;line-height:1.4;">${short2}</p>
    <p style="font-size:13px;color:#666;margin:0 0 12px;">Price segment: <strong>${seg2.replace('-',' ')}</strong></p>
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
    <strong>Choose the ${short1.substring(0,40)}${short1.length>40?'…':''}</strong> if you want a <strong>${seg1.replace('-',' ')}</strong> option, or if its specific specs (${Object.entries(specs1).slice(0,2).map(([k,v])=>v).join(', ')||'see above'}) match your primary requirement.
  </p>
</div>

<div style="background:#e3f2fd;border-left:4px solid #2196f3;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:24px;">
  <p style="margin:0;font-size:14px;line-height:1.6;">
    <strong>Choose the ${short2.substring(0,40)}${short2.length>40?'…':''}</strong> if you want a <strong>${seg2.replace('-',' ')}</strong> option, or if its specific specs (${Object.entries(specs2).slice(0,2).map(([k,v])=>v).join(', ')||'see above'}) better fit your needs.
  </p>
</div>

${methodologyBlock(short1, short2)}

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

${faqHTML}

<hr style="margin:32px 0;border:none;border-top:1px solid #e0e0e0;">
<p style="font-size:13px;color:#888;">
  <a href="/best-${catSlug}/" style="color:#e65100;font-weight:600;">← See all ${catLabel}s compared in India ${YEAR}</a>
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

  // Build ASIN → product index
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
      stats.skipped++
      continue
    }

    const brand1   = p1.brand_id || 'product'
    const brand2   = p2.brand_id || 'product'
    const catSlug  = op.category
    const slug     = `compare-${brand1}-${asin1.toLowerCase()}-vs-${brand2}-${asin2.toLowerCase()}`
    const name1    = shortName(p1.product_name || p1._legacy?.name || '', 40)
    const name2    = shortName(p2.product_name || p2._legacy?.name || '', 40)
    const title    = `${name1} vs ${name2} — Which Is Better for Indian Homes?`

    try {
      const html   = buildComparisonHTML(p1, p2, catSlug)
      const result = await wpUpsertPage({ title, slug, content: html }, dryRun)
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
