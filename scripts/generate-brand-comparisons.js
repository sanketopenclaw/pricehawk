// scripts/generate-brand-comparisons.js
require('dotenv').config()
const fs   = require('fs')
const path = require('path')

const { makeAuth, wpUpsertPage } = require('./lib/wp')
const {
  resolveOffer, asciDisclosure, methodologyBlock,
  loadProducts, getSpecVal, bestValueScore,
} = require('./lib/content')
const { slugify } = require('./lib/schema')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD
const TAG  = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'
const AUTH = makeAuth(USER, PASS)

const PRODS_DIR = path.join(__dirname, '../data/products')
const YEAR = new Date().getFullYear()

const KITCHEN = ['air-fryers','mixer-grinders','coffee-machines','induction-cooktops',
                 'electric-kettles','food-processors','hand-blenders','sandwich-makers','rice-cookers']

const CAT_LABELS = {
  'air-fryers':'Air Fryers','mixer-grinders':'Mixer Grinders','coffee-machines':'Coffee Machines',
  'induction-cooktops':'Induction Cooktops','electric-kettles':'Electric Kettles',
  'food-processors':'Food Processors','hand-blenders':'Hand Blenders',
  'sandwich-makers':'Sandwich Makers','rice-cookers':'Rice Cookers',
}

const BRAND_PAIRS = [
  { cat: 'air-fryers', b1: 'philips', b2: 'bajaj' },
  { cat: 'air-fryers', b1: 'philips', b2: 'agaro' },
  { cat: 'air-fryers', b1: 'agaro', b2: 'inalsa' },
  { cat: 'air-fryers', b1: 'havells', b2: 'bajaj' },
  { cat: 'mixer-grinders', b1: 'philips', b2: 'bajaj' },
  { cat: 'mixer-grinders', b1: 'preethi', b2: 'bajaj' },
  { cat: 'mixer-grinders', b1: 'philips', b2: 'prestige' },
  { cat: 'mixer-grinders', b1: 'sujata', b2: 'preethi' },
  { cat: 'coffee-machines', b1: 'delonghi', b2: 'morphy-richards' },
  { cat: 'coffee-machines', b1: 'delonghi', b2: 'wonderchef' },
  { cat: 'induction-cooktops', b1: 'philips', b2: 'bajaj' },
  { cat: 'induction-cooktops', b1: 'havells', b2: 'prestige' },
  { cat: 'electric-kettles', b1: 'philips', b2: 'bajaj' },
  { cat: 'electric-kettles', b1: 'havells', b2: 'morphy-richards' },
  { cat: 'rice-cookers', b1: 'panasonic', b2: 'bajaj' },
  { cat: 'rice-cookers', b1: 'philips', b2: 'bajaj' },
]

function titleCase(s) { return (s||'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) }
function shortName(name, max=55) {
  const c=(name||'').replace(/\s*[\\|,].*$/,'').trim()
  return c.length>max ? c.substring(0,max-1)+'…' : c
}

function brandStats(products) {
  if (!products.length) return null
  const wattages = products.map(p => {
    const w = getSpecVal(p.specifications || {}, 'Output Wattage', 'Wattage', 'Wattage Rating')
    return w ? parseFloat(w.replace(/[^0-9.]/g, '')) : null
  }).filter(n => n && !isNaN(n))
  const capacities = products.map(p => {
    const c = getSpecVal(p.specifications || {}, 'Capacity', 'Volume', 'Bowl Capacity', 'Jug Capacity')
    return c ? parseFloat(c.replace(/[^0-9.]/g, '')) : null
  }).filter(n => n && !isNaN(n))
  const segCounts = {}
  for (const p of products) {
    const s = p.price_segment || p._legacy?.price_segment || 'mid-range'
    segCounts[s] = (segCounts[s] || 0) + 1
  }
  return {
    count: products.length,
    wattMin: wattages.length ? Math.min(...wattages) : null,
    wattMax: wattages.length ? Math.max(...wattages) : null,
    capMin:  capacities.length ? Math.min(...capacities) : null,
    capMax:  capacities.length ? Math.max(...capacities) : null,
    segCounts,
  }
}

function statRow(label, val1, val2) {
  return `  <tr style="border-bottom:1px solid #e8e8e8;">
    <td style="padding:8px 12px;color:#666;font-weight:600;font-size:13px;width:25%;">${label}</td>
    <td style="padding:8px 12px;font-size:13px;width:37.5%;">${val1 || '—'}</td>
    <td style="padding:8px 12px;font-size:13px;width:37.5%;">${val2 || '—'}</td>
  </tr>`
}

function buildBrandCompHTML(b1Products, b2Products, b1, b2, catSlug) {
  const catLabel = CAT_LABELS[catSlug] || titleCase(catSlug)
  const B1 = titleCase(b1), B2 = titleCase(b2)
  const s1 = brandStats(b1Products), s2 = brandStats(b2Products)

  // Top product per brand by bestValueScore
  const top1 = b1Products.reduce((best, p) => bestValueScore(p) > bestValueScore(best) ? p : best, b1Products[0])
  const top2 = b2Products.reduce((best, p) => bestValueScore(p) > bestValueScore(best) ? p : best, b2Products[0])

  const topOffer1 = top1 ? resolveOffer(top1) : null
  const topOffer2 = top2 ? resolveOffer(top2) : null
  const topLink1 = topOffer1?.affiliate_url || (topOffer1?.external_id ? `https://www.amazon.in/dp/${topOffer1.external_id}?tag=${TAG}` : '#')
  const topLink2 = topOffer2?.affiliate_url || (topOffer2?.external_id ? `https://www.amazon.in/dp/${topOffer2.external_id}?tag=${TAG}` : '#')

  // Who wins on wattage
  let wattVerdict = ''
  if (s1?.wattMax && s2?.wattMax) {
    const winner = s1.wattMax >= s2.wattMax ? B1 : B2
    wattVerdict = `${winner} offers higher peak wattage (${Math.max(s1.wattMax||0, s2.wattMax||0)}W), giving faster heating and better performance for larger batches.`
  }

  // Who wins on range breadth
  const countVerdict = s1 && s2
    ? s1.count >= s2.count
      ? `${B1} has a broader range with ${s1.count} models vs ${B2}'s ${s2.count}.`
      : `${B2} has a broader range with ${s2.count} models vs ${B1}'s ${s1.count}.`
    : ''

  const segs = ['budget','mid-range','premium','flagship']
  const seg1Str = s1 ? segs.filter(s => s1.segCounts[s]).map(s => `${s1.segCounts[s]} ${s}`).join(', ') : '—'
  const seg2Str = s2 ? segs.filter(s => s2.segCounts[s]).map(s => `${s2.segCounts[s]} ${s}`).join(', ') : '—'

  const methodCtx = `This brand comparison is based on published specifications for ${B1} and ${B2} ${catLabel.toLowerCase()} available on Amazon India. No independent lab testing conducted.`

  return `${asciDisclosure()}

<nav style="font-size:13px;color:#888;margin-bottom:20px;">
<a href="/" style="color:#666;">Home</a> › <a href="/best-${catSlug}/" style="color:#666;">Best ${catLabel} in India</a> › ${B1} vs ${B2}
</nav>

<p style="font-size:16px;line-height:1.7;color:#333;">
Choosing between <strong>${B1}</strong> and <strong>${B2}</strong> for your ${catLabel.toLowerCase()}? This comparison breaks down both brands' ranges available in India — by wattage, capacity, price segment coverage, and best-value picks.
</p>

<div style="display:flex;gap:16px;margin:24px 0;flex-wrap:wrap;">
  <div style="flex:1;min-width:200px;background:#f5f5f5;border-radius:6px;padding:14px 18px;text-align:center;">
    <p style="font-size:22px;font-weight:700;margin:0;">${s1?.count ?? '—'}</p>
    <p style="font-size:13px;color:#666;margin:4px 0 0;">${B1} models in India</p>
  </div>
  <div style="flex:1;min-width:200px;background:#f5f5f5;border-radius:6px;padding:14px 18px;text-align:center;">
    <p style="font-size:22px;font-weight:700;margin:0;">${s2?.count ?? '—'}</p>
    <p style="font-size:13px;color:#666;margin:4px 0 0;">${B2} models in India</p>
  </div>
</div>

<h2 style="font-size:20px;font-weight:700;margin:28px 0 10px;">${B1} vs ${B2} — Specification Overview</h2>
<div style="overflow-x:auto;">
<table style="width:100%;border-collapse:collapse;font-size:14px;">
  <thead>
    <tr style="background:#f5f5f5;">
      <th style="padding:10px 12px;text-align:left;font-size:13px;color:#444;width:25%;"></th>
      <th style="padding:10px 12px;text-align:left;font-weight:700;font-size:13px;color:#444;width:37.5%;">${B1}</th>
      <th style="padding:10px 12px;text-align:left;font-weight:700;font-size:13px;color:#444;width:37.5%;">${B2}</th>
    </tr>
  </thead>
  <tbody>
${statRow('Models available', s1?.count?.toString(), s2?.count?.toString())}
${statRow('Wattage range', s1?.wattMin && s1?.wattMax ? `${s1.wattMin}W – ${s1.wattMax}W` : null, s2?.wattMin && s2?.wattMax ? `${s2.wattMin}W – ${s2.wattMax}W` : null)}
${statRow('Capacity range', s1?.capMin && s1?.capMax ? `${s1.capMin}L – ${s1.capMax}L` : null, s2?.capMin && s2?.capMax ? `${s2.capMin}L – ${s2.capMax}L` : null)}
${statRow('Segment coverage', seg1Str, seg2Str)}
  </tbody>
</table>
</div>

<h2 style="font-size:20px;font-weight:700;margin:28px 0 12px;">Which Brand Should You Choose?</h2>
${wattVerdict ? `<p style="font-size:15px;line-height:1.7;color:#333;margin:0 0 10px;">${wattVerdict}</p>` : ''}
${countVerdict ? `<p style="font-size:15px;line-height:1.7;color:#333;margin:0 0 10px;">${countVerdict}</p>` : ''}
<p style="font-size:15px;line-height:1.7;color:#333;margin:0 0 10px;">
Both brands cover the full price range for Indian buyers. ${B1} products tend to focus on ${s1?.segCounts?.premium || s1?.segCounts?.flagship ? 'higher specifications and build quality' : 'value-for-money across segments'}. ${B2} is known for ${s2?.segCounts?.budget || s2?.segCounts?.['mid-range'] ? 'accessible pricing and wide availability' : 'strong performance across its range'}.
</p>

<h2 style="font-size:20px;font-weight:700;margin:28px 0 12px;">Best Value Picks</h2>

<div style="display:flex;gap:16px;margin:0 0 24px;flex-wrap:wrap;">
  ${top1 ? `<div style="flex:1;min-width:220px;border:1px solid #e0e0e0;border-radius:6px;padding:16px;">
    <p style="font-size:12px;color:#888;font-weight:700;text-transform:uppercase;margin:0 0 6px;">Best Value — ${B1}</p>
    <p style="font-size:15px;font-weight:700;margin:0 0 12px;line-height:1.4;">${shortName(top1.product_name || top1._legacy?.name || '')}</p>
    <a href="${topLink1}" target="_blank" rel="nofollow sponsored noopener"
       style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
      Check price on Amazon →
    </a>
  </div>` : ''}
  ${top2 ? `<div style="flex:1;min-width:220px;border:1px solid #e0e0e0;border-radius:6px;padding:16px;">
    <p style="font-size:12px;color:#888;font-weight:700;text-transform:uppercase;margin:0 0 6px;">Best Value — ${B2}</p>
    <p style="font-size:15px;font-weight:700;margin:0 0 12px;line-height:1.4;">${shortName(top2.product_name || top2._legacy?.name || '')}</p>
    <a href="${topLink2}" target="_blank" rel="nofollow sponsored noopener"
       style="display:inline-block;background:#ff9900;color:#111;text-decoration:none;font-size:13px;font-weight:700;padding:8px 16px;border-radius:4px;">
      Check price on Amazon →
    </a>
  </div>` : ''}
</div>

${methodologyBlock(methodCtx)}

<hr style="margin:32px 0;border:none;border-top:1px solid #e0e0e0;">
<p style="font-size:13px;color:#888;">
  <a href="/best-${catSlug}/" style="color:#e65100;font-weight:600;">← See all ${catLabel} in India ${YEAR}</a>
</p>

<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: `${B1} vs ${B2} ${catLabel} in India`,
  description: `Brand comparison of ${B1} and ${B2} ${catLabel.toLowerCase()} available in India.`,
  numberOfItems: 2,
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: B1, url: `https://pricehawk.in/${b1}-${catSlug}s/` },
    { '@type': 'ListItem', position: 2, name: B2, url: `https://pricehawk.in/${b2}-${catSlug}s/` },
  ],
}, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')}
</script>`
}

async function main() {
  const args      = process.argv.slice(2)
  const dryRun    = args.includes('--dry-run')
  const catFilter = args.includes('--cat') ? args[args.indexOf('--cat') + 1] : null

  if (!WP || !USER || !PASS) { console.error('Missing WP credentials in .env'); process.exit(1) }

  const productIndex = loadProducts(KITCHEN, PRODS_DIR)
  const pairs = catFilter ? BRAND_PAIRS.filter(p => p.cat === catFilter) : BRAND_PAIRS

  console.log(`Brand comparison pairs: ${pairs.length}`)
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0 }

  for (const { cat, b1, b2 } of pairs) {
    const allCatProds = Object.values(productIndex).filter(p => p._catSlug === cat)
    const b1Products  = allCatProds.filter(p => (p.brand_id || p._legacy?.brand || '').toLowerCase() === b1)
    const b2Products  = allCatProds.filter(p => (p.brand_id || p._legacy?.brand || '').toLowerCase() === b2)

    if (!b1Products.length || !b2Products.length) {
      console.log(`  skip ${b1} vs ${b2} (${cat}) — ${b1Products.length} + ${b2Products.length} products`)
      stats.skipped++; continue
    }

    const catLabel = CAT_LABELS[cat] || titleCase(cat)
    const B1 = titleCase(b1), B2 = titleCase(b2)
    const slug  = `${b1}-vs-${b2}-${cat}`
    const title = `${B1} vs ${B2} ${catLabel} in India ${YEAR} — Which Brand Wins?`
    const metaDesc = `${B1} vs ${B2} ${catLabel.toLowerCase()} compared — wattage range, capacity, segments, and best value picks for Indian buyers.`
    const md = metaDesc.length > 160 ? metaDesc.substring(0, 157) + '…' : metaDesc

    try {
      const html   = buildBrandCompHTML(b1Products, b2Products, b1, b2, cat)
      const result = await wpUpsertPage({ title, slug, content: html }, { wp: WP, auth: AUTH, dryRun, metaDesc: md })
      if (dryRun) { console.log(`    [dry] ${slug}`); continue }
      if (result) {
        console.log(`  ✓ [${result.action}] ${b1} vs ${b2} (${cat})`)
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
