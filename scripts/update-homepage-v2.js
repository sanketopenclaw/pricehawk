#!/usr/bin/env node
/**
 * Homepage v2 update: reflects all-category pivot.
 * Changes:
 *  1. Ticker bar — 8 products from priority categories
 *  2. Hero copy — updated tagline + badge
 *  3. TrustStrip component — 4 stat blocks after hero
 *  4. CategoryHubGrid — replaces flat pill strip with 12-tile icon grid
 *  5. TopDealsStrip — new section, best deal per category
 *  6. StaffPicks — expanded to 6 products across waves
 */
require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')
const TAG = 'pricehawkin-21'

// WP JSX encoding helpers
const LT = '\\u003c'
const GT = '\\u003e'
const NL = '\\n'

function jsx(str) {
  // Convert normal JSX string to WP-encoded format
  return str
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\n/g, '\\n')
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

const TICKER_DATA = `const ticker = [
  { "name": "Philips Air Fryer 2.5L", "now": 5249, "dir": "down", "delta": 14, "link": "https://www.amazon.in/dp/B0D14BB5XY?tag=${TAG}" },
  { "name": "Morphy Richards Mixer", "now": 4995, "dir": "down", "delta": 11, "link": "https://www.amazon.in/dp/B0DGY7H765?tag=${TAG}" },
  { "name": "Wonderchef Coffee Maker", "now": 11999, "dir": "down", "delta": 16, "link": "https://www.amazon.in/dp/B0GH279L42?tag=${TAG}" },
  { "name": "Eufy L60 Robot Vacuum", "now": 14999, "dir": "down", "delta": 20, "link": "https://www.amazon.in/dp/B0CLLFNB9G?tag=${TAG}" },
  { "name": "Livpure RO Water Purifier", "now": 7499, "dir": "down", "delta": 18, "link": "https://www.amazon.in/dp/B074FRSGY9?tag=${TAG}" },
  { "name": "Samsung 183L Refrigerator", "now": 20690, "dir": "down", "delta": 13, "link": "https://www.amazon.in/dp/B0BR3WHPQP?tag=${TAG}" },
  { "name": "IFB 10Kg Washing Machine", "now": 31990, "dir": "down", "delta": 22, "link": "https://www.amazon.in/dp/B0CQNZC5GS?tag=${TAG}" },
  { "name": "HP Core i3 Laptop 15.6\"", "now": 48490, "dir": "down", "delta": 17, "link": "https://www.amazon.in/dp/B0F4R5W1NC?tag=${TAG}" }
]`

const STAFF_PICKS_DATA = `const staffPicks = [
  {
    "id": "sp1", "cat": "Kitchen", "wave": "Kitchen 5%",
    "name": "COSORI Air Fryer 5 QT 4.7L",
    "asin": "B0936FGLQS",
    "img": "https://m.media-amazon.com/images/I/61Pqee3zAgL._SY300_SX300_QL70_FMwebp_.jpg",
    "link": "https://www.amazon.in/dp/B0936FGLQS?tag=${TAG}",
    "why": "Best-rated air fryer under ₹15,000. 5 QT basket fits a whole chicken. Quiet motor, even heat, and a companion app with 100+ recipes. Beats Philips on capacity at this price."
  },
  {
    "id": "sp2", "cat": "Kitchen", "wave": "Kitchen 5%",
    "name": "Morphy Richards Icon Superb 750W",
    "asin": "B0DGY7H765",
    "img": "https://m.media-amazon.com/images/I/71VsLnJaE7L._SY300_SX300_QL70_FMwebp_.jpg",
    "link": "https://www.amazon.in/dp/B0DGY7H765?tag=${TAG}",
    "why": "750W motor handles wet grinding, batters, and chutneys without overheating. 3 stainless jars cover every Indian kitchen task. Better finish than Preethi at the same price."
  },
  {
    "id": "sp3", "cat": "Large Appliances", "wave": "Appliances 3.5%",
    "name": "Samsung 183L 3-Star Refrigerator",
    "asin": "B0BR3WHPQP",
    "img": "https://m.media-amazon.com/images/I/51-Yc6ZYTKL._SY300_SX300_QL70_FMwebp_.jpg",
    "link": "https://www.amazon.in/dp/B0BR3WHPQP?tag=${TAG}",
    "why": "Best single-door fridge for 1-2 people. Digital inverter compressor cuts electricity bills by 40%. Samsung service network is unmatched across India."
  },
  {
    "id": "sp4", "cat": "Large Appliances", "wave": "Appliances 3.5%",
    "name": "IFB 10Kg 5-Star Fully Automatic",
    "asin": "B0CQNZC5GS",
    "img": "https://m.media-amazon.com/images/I/71Jo6sZXEFL._SY300_SX300_QL70_FMwebp_.jpg",
    "link": "https://www.amazon.in/dp/B0CQNZC5GS?tag=${TAG}",
    "why": "IFB's AI Wash detects load and selects the right cycle automatically. Cradle Wash for delicates is the gentlest in class. Best after-sales network for washing machines in India."
  },
  {
    "id": "sp5", "cat": "Home Cleaning", "wave": "Wave 2 3.5%",
    "name": "Eufy L60 Hybrid Robot Vacuum",
    "asin": "B0CLLFNB9G",
    "img": "https://m.media-amazon.com/images/I/61NkpVChIJL._SY300_SX300_QL70_FMwebp_.jpg",
    "link": "https://www.amazon.in/dp/B0CLLFNB9G?tag=${TAG}",
    "why": "2-in-1 vacuums and mops in one pass. 3000Pa suction handles pet hair and Indian dust. Auto-docking, no subscription needed. Best value robot vacuum under ₹20,000."
  },
  {
    "id": "sp6", "cat": "Water & Air", "wave": "Wave 2 3.5%",
    "name": "HUL Pureit RO+MF Water Purifier 7L",
    "asin": "B07SFZ21BW",
    "img": "https://m.media-amazon.com/images/I/61JEdBD6bIL._SY300_SX300_QL70_FMwebp_.jpg",
    "link": "https://www.amazon.in/dp/B07SFZ21BW?tag=${TAG}",
    "why": "HUL's most affordable RO+MF purifier. Removes heavy metals, bacteria, and TDS. 7L tank covers a 4-person family. Service network across 1,500+ cities."
  }
]`

const TOP_DEALS_DATA = `const topDeals = [
  { "cat": "Air Fryers", "name": "Digital Air Fryer 4.5L 1400W", "asin": "B0D4VLXDZ5", "price": 5999, "mrp": 14695, "off": 59, "img": "https://m.media-amazon.com/images/I/61RXnaIkydL._SY300_SX300_QL70_FMwebp_.jpg", "link": "https://www.amazon.in/dp/B0D4VLXDZ5?tag=${TAG}" },
  { "cat": "Induction", "name": "iBell 2000W Induction Cooktop", "asin": "B0CZLMPF1T", "price": 2631, "mrp": 5490, "off": 52, "img": "https://m.media-amazon.com/images/I/61JVN3OMDNL._SY300_SX300_QL70_FMwebp_.jpg", "link": "https://www.amazon.in/dp/B0CZLMPF1T?tag=${TAG}" },
  { "cat": "Washing Machine", "name": "Front Load Washing Machine 7Kg", "asin": "B0DQY2XTJC", "price": 27990, "mrp": 43490, "off": 36, "img": "https://m.media-amazon.com/images/I/71Jo6sZXEFL._SY300_SX300_QL70_FMwebp_.jpg", "link": "https://www.amazon.in/dp/B0DQY2XTJC?tag=${TAG}" },
  { "cat": "Refrigerator", "name": "255L 3-Star Single Door Fridge", "asin": "B0G8JHZJJQ", "price": 16790, "mrp": 20999, "off": 20, "img": "https://m.media-amazon.com/images/I/51-Yc6ZYTKL._SY300_SX300_QL70_FMwebp_.jpg", "link": "https://www.amazon.in/dp/B0G8JHZJJQ?tag=${TAG}" },
  { "cat": "Laptop", "name": "Lenovo IdeaPad Slim 3 Core i3", "asin": "B0CR7WG86N", "price": 37380, "mrp": 85000, "off": 56, "img": "https://m.media-amazon.com/images/I/81+SKGgJ9yL._SY300_SX300_QL70_FMwebp_.jpg", "link": "https://www.amazon.in/dp/B0CR7WG86N?tag=${TAG}" },
  { "cat": "Robot Vacuum", "name": "Robot Vacuum 2-in-1 Vac & Mop", "asin": "B0CJF2G4J5", "price": 22999, "mrp": 44990, "off": 49, "img": "https://m.media-amazon.com/images/I/61NkpVChIJL._SY300_SX300_QL70_FMwebp_.jpg", "link": "https://www.amazon.in/dp/B0CJF2G4J5?tag=${TAG}" },
  { "cat": "Water Purifier", "name": "RO+UV+UF Water Purifier 10L", "asin": "B07B2CCW8Z", "price": 7334, "mrp": 15999, "off": 54, "img": "https://m.media-amazon.com/images/I/61JEdBD6bIL._SY300_SX300_QL70_FMwebp_.jpg", "link": "https://www.amazon.in/dp/B07B2CCW8Z?tag=${TAG}" },
  { "cat": "Air Purifier", "name": "Honeywell Air Purifier 4 Stage", "asin": "B09C64QJMS", "price": 5121, "mrp": 12299, "off": 58, "img": "https://m.media-amazon.com/images/I/51IACRbkP-L._SY300_SX300_QL70_FMwebp_.jpg", "link": "https://www.amazon.in/dp/B09C64QJMS?tag=${TAG}" }
]`

// ─── NEW JSX COMPONENTS (WP-encoded) ─────────────────────────────────────────

const TRUST_STRIP_COMPONENT = jsx(`
function TrustStrip({ mob, px }) {
  const stats = [
    { n: '54', label: 'categories' },
    { n: '1,900+', label: 'products tracked' },
    { n: 'Daily', label: 'price updates' },
    { n: '5%', label: 'kitchen commission' },
  ];
  return (
    <section style={{ padding: \`0 \${px}px 36px\` }}>
      <div style={{ display: 'grid', gridTemplateColumns: mob ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10, padding: '18px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: T_RAD }}>
        {stats.map(s => (
          <div key={s.label} style={{ textAlign: 'center', padding: '4px 0' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: mob ? 20 : 24, fontWeight: 800, color: 'var(--accent)' }}>{s.n}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-2)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
`)

const CAT_HUB_DATA = jsx(`
const CAT_HUB = [
  { icon: '\u{1F373}', label: 'Air Fryers', q: 'air+fryer' },
  { icon: '\u{1F300}', label: 'Mixer Grinders', q: 'mixer+grinder' },
  { icon: '☕', label: 'Coffee Machines', q: 'coffee+machine' },
  { icon: '\u{1F9CA}', label: 'Refrigerators', q: 'refrigerator' },
  { icon: '\u{1F30A}', label: 'Washing Machines', q: 'washing+machine' },
  { icon: '❄️', label: 'Air Conditioners', q: 'split+ac+inverter' },
  { icon: '\u{1F916}', label: 'Robot Vacuums', q: 'robot+vacuum+cleaner' },
  { icon: '\u{1F4A7}', label: 'Water Purifiers', q: 'water+purifier+ro' },
  { icon: '\u{1F32C}️', label: 'Air Purifiers', q: 'air+purifier+hepa' },
  { icon: '\u{1F4BB}', label: 'Laptops', q: 'laptop+india' },
  { icon: '\u{1FA91}', label: 'Office Chairs', q: 'ergonomic+office+chair' },
  { icon: '\u{1F3C3}', label: 'Treadmills', q: 'treadmill+motorized' },
];
`)

const CAT_HUB_COMPONENT = jsx(`
function CategoryHubGrid({ mob, px }) {
  return (
    <section style={{ padding: \`0 \${px}px 36px\` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', margin: 0 }}># shop_by_category</h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>54 categories →</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mob ? 'repeat(3,1fr)' : 'repeat(6,1fr)', gap: 10 }}>
        {CAT_HUB.map(c => (
          <a key={c.label} href={'https://www.amazon.in/s?k='+c.q+'&tag=pricehawkin-21'} target='_blank' rel='nofollow' style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: mob ? '12px 6px' : '16px 8px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: T_RAD, textDecoration: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: mob ? 20 : 26 }}>{c.icon}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: mob ? 9 : 11, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.3 }}>{c.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
`)

const TOP_DEALS_COMPONENT = jsx(`
function TopDealsStrip({ mob, px }) {
  const deals = window.PH.topDeals || [];
  if (!deals.length) return null;
  return (
    <section style={{ padding: \`0 \${px}px 40px\` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)', margin: 0 }}># best_deals_today</h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)' }}>▼ live</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mob ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
        {deals.map(d => (
          <a key={d.asin} href={d.link} target='_blank' rel='nofollow' style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: T_RAD, textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <img src={d.img} alt={d.cat} style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 3 }}>{d.cat}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', lineHeight: 1.35 }}>{d.name.length > 42 ? d.name.slice(0,42)+'...' : d.name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{'\\u20B9'}{d.price.toLocaleString('en-IN')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-3)', textDecoration: 'line-through' }}>{'\\u20B9'}{d.mrp.toLocaleString('en-IN')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>{d.off}% off</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
`)

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  const fromFile = process.argv.includes('--from-file')
  let c, fixes = 0
  if (fromFile) {
    const vf = process.argv[process.argv.indexOf('--from-file') + 1] || 'scripts/versions/page12-2026-06-08_09-59.json'
    const vdata = JSON.parse(fs.readFileSync(vf, 'utf8'))
    c = vdata.content?.raw || vdata.content
    console.log(`Loaded from ${vf}: ${c.length} chars`)
    if (c.indexOf('const staffPicks = [') === -1) { console.error('ERROR: no staffPicks in file!'); process.exit(1) }
  } else {
    const r = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
      headers: { Authorization: `Basic ${AUTH}` }
    })
    c = r.data.content.raw
  }

  // ── 1. Ticker data ─────────────────────────────────────────────────────────
  // ticker array ends with \n] (no semicolon), so use \n] not ]; to find close
  const tickerStart = c.indexOf('const ticker = [')
  const tickerEnd = c.indexOf('\n]', tickerStart) + 2
  if (tickerStart > -1 && tickerEnd > tickerStart + 10) {
    c = c.substring(0, tickerStart) + TICKER_DATA + c.substring(tickerEnd)
    console.log('✓ ticker updated (8 products: kitchen+appliances+laptop)')
    fixes++
  }

  // ── 2. StaffPicks data + topDeals (inserted atomically) ───────────────────
  const spStart = c.indexOf('const staffPicks = [')
  const spEnd = c.indexOf('];', spStart) + 2
  if (spStart > -1) {
    const hasTopDeals = c.includes('const topDeals = [')
    const replacement = STAFF_PICKS_DATA + (hasTopDeals ? '' : '\n\n' + TOP_DEALS_DATA)
    c = c.substring(0, spStart) + replacement + c.substring(spEnd)
    console.log('✓ staffPicks updated (6 products across 3 waves)')
    fixes++
    if (!hasTopDeals) {
      console.log('✓ topDeals data added after staffPicks')
      fixes++
    }
  }

  // ── 3. topDeals fallback (if staffPicks absent) ────────────────────────────
  if (!c.includes('const topDeals = [')) {
    const phIdx = c.indexOf('window.PH = {')
    if (phIdx > -1) {
      c = c.substring(0, phIdx) + TOP_DEALS_DATA + '\n\n' + c.substring(phIdx)
      console.log('✓ topDeals data added (fallback: before window.PH)')
      fixes++
    }
  }

  // ── 4. Add topDeals to window.PH ───────────────────────────────────────────
  const phObj = 'window.PH = { inr, pct, products, deals, guides, categories, ticker, staffPicks, guideDetail, comparison, legal };'
  const phObjNew = 'window.PH = { inr, pct, products, deals, guides, categories, ticker, staffPicks, topDeals, guideDetail, comparison, legal };'
  if (c.includes(phObj)) {
    c = c.replace(phObj, phObjNew)
    console.log('✓ topDeals wired into window.PH')
    fixes++
  } else if (!c.includes('topDeals,')) {
    console.log('⚠ window.PH line not found — check manually')
  }

  // ── 5. Hero badge copy ─────────────────────────────────────────────────────
  const OLD_BADGE = '142 prices dropped in the last 24h'
  const NEW_BADGE = '54 categories · 1,900+ products tracked'
  if (c.includes(OLD_BADGE)) {
    c = c.replace(OLD_BADGE, NEW_BADGE)
    console.log('✓ hero badge updated')
    fixes++
  }

  // ── 6. Hero tagline copy ───────────────────────────────────────────────────
  const OLD_TAGLINE = 'AI-researched buying guides. Honest comparisons. Live Amazon prices.'
  const NEW_TAGLINE = 'Kitchen, appliances, laptops and more. Honest comparisons, real specs, best prices — for India.'
  if (c.includes(OLD_TAGLINE)) {
    c = c.replace(OLD_TAGLINE, NEW_TAGLINE)
    console.log('✓ hero tagline updated')
    fixes++
  }

  // ── 7. Inject new component definitions before function PHTerminal ─────────
  const TERM_ANCHOR = '\\nfunction PHTerminal'
  const termIdx = c.indexOf(TERM_ANCHOR)
  if (termIdx > -1 && !c.includes('function TrustStrip')) {
    const newComponents = NL + NL + TRUST_STRIP_COMPONENT + NL + NL + CAT_HUB_DATA + NL + CAT_HUB_COMPONENT + NL + NL + TOP_DEALS_COMPONENT
    c = c.substring(0, termIdx) + newComponents + c.substring(termIdx)
    console.log('✓ TrustStrip + CategoryHubGrid + TopDealsStrip components injected')
    fixes++
  }

  // ── 8. Replace CATEGORY STRIP section with CategoryHubGrid ────────────────
  const CAT_STRIP_START = '{/* CATEGORY STRIP */}' + NL
  const catStripIdx = c.indexOf(CAT_STRIP_START)
  if (catStripIdx > -1) {
    // Find end of the section: closing </section> after the category pills
    const sectionClose = LT + '/section' + GT + NL
    const sectionEnd = c.indexOf(sectionClose, catStripIdx) + sectionClose.length
    if (sectionEnd > catStripIdx) {
      const NEW_CAT_SECTION = '{/* CATEGORY HUB GRID */}' + NL +
        '      ' + LT + 'CategoryHubGrid mob={mob} px={px} /' + GT + NL
      c = c.substring(0, catStripIdx) + NEW_CAT_SECTION + c.substring(sectionEnd)
      console.log('✓ CategoryHubGrid replaced flat category pill strip')
      fixes++
    }
  }

  // ── 9. Insert TrustStrip after hero section ────────────────────────────────
  const HERO_CLOSE = '{/* CATEGORY HUB GRID */}'
  if (!c.includes(LT + 'TrustStrip') && c.includes(HERO_CLOSE)) {
    c = c.replace(HERO_CLOSE,
      LT + 'TrustStrip mob={mob} px={px} /' + GT + NL + NL + '      ' + HERO_CLOSE)
    console.log('✓ TrustStrip inserted after hero')
    fixes++
  }

  // ── 10. Insert TopDealsStrip before DEALS GRID ────────────────────────────
  const DEALS_ANCHOR = '{/* DEALS GRID'
  if (!c.includes(LT + 'TopDealsStrip') && c.includes(DEALS_ANCHOR)) {
    c = c.replace(DEALS_ANCHOR,
      LT + 'TopDealsStrip mob={mob} px={px} /' + GT + NL + NL + '      ' + DEALS_ANCHOR)
    console.log('✓ TopDealsStrip inserted before deals grid')
    fixes++
  }

  console.log(`\nTotal fixes: ${fixes}`)
  if (fixes === 0) { console.log('Nothing changed — already up to date?'); return }

  try { execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' }) } catch(e) {}

  const res = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/12`,
    { content: c },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log('\nPushed:', res.data.modified)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
