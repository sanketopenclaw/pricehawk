// scripts/lib/__tests__/templates.test.js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  prosConsFromSpecs, verdictBox, updatedLine,
  wideShell, specScorecard, howItStacksUp, tocBlock, postShell,
} = require('../templates')
const { voiceLint } = require('../voice')

function mkProduct(specs, features = [], seg = 'mid-range') {
  return { specifications: { ...specs, _features: features }, price_segment: seg }
}

// Category context: median wattage 1400, most products have auto shut-off
const CATEGORY = [
  mkProduct({ 'Output Wattage': '1200 Watts', 'Capacity': '4 litres' }, ['Auto shut-off protection']),
  mkProduct({ 'Output Wattage': '1400 Watts', 'Capacity': '4.5 litres' }, ['Auto shut-off']),
  mkProduct({ 'Output Wattage': '1500 Watts', 'Capacity': '5 litres' }, ['Auto shut-off', 'Keep warm']),
  mkProduct({ 'Output Wattage': '1700 Watts', 'Capacity': '6 litres' }, ['Auto shut-off']),
]

// --- prosConsFromSpecs ---

test('low wattage vs category median becomes an honest con', () => {
  const p = mkProduct({ 'Output Wattage': '800 Watts', 'Capacity': '4 litres' }, ['Auto shut-off'])
  const { cons } = prosConsFromSpecs(p, CATEGORY, 'Air Fryer')
  assert.ok(cons.some(c => /slower|longer|below/i.test(c)), JSON.stringify(cons))
})

test('high wattage vs category median becomes a pro', () => {
  const p = mkProduct({ 'Output Wattage': '1800 Watts', 'Capacity': '4 litres' }, ['Auto shut-off'])
  const { pros } = prosConsFromSpecs(p, CATEGORY, 'Air Fryer')
  assert.ok(pros.some(x => /power|faster|preheat/i.test(x)), JSON.stringify(pros))
})

test('small capacity becomes a family-size con', () => {
  const p = mkProduct({ 'Output Wattage': '1400 Watts', 'Capacity': '2 litres' }, ['Auto shut-off'])
  const { cons } = prosConsFromSpecs(p, CATEGORY, 'Air Fryer')
  assert.ok(cons.some(c => /small|family|four/i.test(c)), JSON.stringify(cons))
})

test('manual controls become a no-presets con', () => {
  const p = mkProduct({ 'Output Wattage': '1400 Watts', 'Capacity': '4 litres', 'Controller Type': 'Manual Knob' }, ['Auto shut-off'])
  const { cons } = prosConsFromSpecs(p, CATEGORY, 'Air Fryer')
  assert.ok(cons.some(c => /preset|manual|timing/i.test(c)), JSON.stringify(cons))
})

test('missing common safety feature is called out', () => {
  const p = mkProduct({ 'Output Wattage': '1400 Watts', 'Capacity': '4 litres' }, [])
  const { cons } = prosConsFromSpecs(p, CATEGORY, 'Air Fryer')
  assert.ok(cons.some(c => /auto shut-?off/i.test(c)), JSON.stringify(cons))
})

test('no fabricated cons when specs give nothing to fault', () => {
  // matches category norms on everything
  const p = mkProduct({ 'Output Wattage': '1500 Watts', 'Capacity': '4.5 litres', 'Controller Type': 'Digital Touch' }, ['Auto shut-off', 'Keep warm'])
  const { cons } = prosConsFromSpecs(p, CATEGORY, 'Air Fryer')
  // may be empty or near-empty — must never contain generic filler
  for (const c of cons) {
    assert.ok(!/average|nothing|decent|okay/i.test(c), `padded con: ${c}`)
  }
})

test('pros and cons output is voice-lint clean', () => {
  const p = mkProduct({ 'Output Wattage': '800 Watts', 'Capacity': '2 litres', 'Controller Type': 'Manual' }, [])
  const { pros, cons } = prosConsFromSpecs(p, CATEGORY, 'Air Fryer')
  assert.deepEqual(voiceLint(pros.concat(cons).join(' ')), [])
})

// --- verdictBox ---

test('verdictBox names product, hedges, includes CTA, lint-clean', () => {
  const html = verdictBox({
    name: 'Philips HD9252/90 Air Fryer',
    catLabel: 'Air Fryer',
    seg: 'mid-range',
    whoFor: 'a family of 3–4',
    keyStrength: 'higher power (1400W)',
    link: 'https://www.amazon.in/dp/B0TEST?tag=pricehawkin-21',
    seed: 'B0TEST',
  })
  assert.ok(html.includes('Philips HD9252/90'))
  assert.ok(html.includes('amazon.in/dp/B0TEST'))
  assert.ok(/probably|likely|solid|depends|worth/i.test(html))
  assert.ok(/3–4/.test(html))
  assert.deepEqual(voiceLint(html), [])
})

test('verdictBox deterministic per seed', () => {
  const args = { name: 'X', catLabel: 'Kettle', seg: 'budget', whoFor: '1–2 people', keyStrength: 'a lower price', link: 'https://a.in', seed: 's' }
  assert.strictEqual(verdictBox(args), verdictBox(args))
})

// --- wideShell ---

test('wideShell breaks out of theme column and centers wide content', () => {
  const html = wideShell('<p>INNER</p>')
  assert.ok(html.includes('INNER'))
  assert.ok(html.includes('100vw'))
  assert.ok(/calc\(50% - 50vw\)/.test(html))
  assert.ok(/max-width:\s*1\d{3}px/.test(html))
})

// --- postShell ---

test('postShell hides theme chrome and renders site header, nav, footer, light article card', () => {
  const html = postShell('<p>ARTICLE</p>')
  assert.ok(html.includes('ARTICLE'))
  // theme chrome hidden (same approach as ph-home page)
  assert.ok(/\.wp-block-template-part[^{]*\{[^}]*display:\s*none/s.test(html))
  assert.ok(/\.wp-block-post-title[^}]*display:\s*none/s.test(html) || /\.wp-block-post-title/.test(html))
  // site header replica
  assert.ok(html.includes('pricehawk-logo.png'))
  assert.ok(html.includes('/buying-guide/'))
  assert.ok(html.includes('/price-drops/'))
  assert.ok(html.includes('/categories/'))
  // dark shell + wide light article surface
  assert.ok(html.includes('#0f0f0f'))
  assert.ok(/max-width:\s*1200px/.test(html))
  // footer replica with disclosure line
  assert.ok(/earns a commission on purchases/.test(html))
})

// --- specScorecard ---

function pricedProduct(specs, features, price, seg = 'mid-range') {
  return {
    specifications: { ...specs, _features: features },
    price_segment: seg,
    offers: [{ last_price: price }],
  }
}

const PRICED_CATEGORY = [
  pricedProduct({ 'Output Wattage': '1200 Watts', 'Capacity': '4 litres' }, ['Auto shut-off'], 3500),
  pricedProduct({ 'Output Wattage': '1400 Watts', 'Capacity': '4.5 litres' }, ['Auto shut-off', 'Keep warm'], 5500),
  pricedProduct({ 'Output Wattage': '2000 Watts', 'Capacity': '6.2 litres' }, ['Auto shut-off', 'Keep warm', 'Timer'], 9000),
]

test('specScorecard renders normalized bars with honesty caption', () => {
  const html = specScorecard(PRICED_CATEGORY[2], PRICED_CATEGORY, 'Air Fryer')
  assert.ok(html.includes('10.0') || html.includes('10/10') || /width:\s*100%/.test(html), 'top product should max a bar')
  assert.ok(/documented specifications/i.test(html))
  assert.ok(/not lab/i.test(html))
  assert.deepEqual(voiceLint(html), [])
})

test('specScorecard returns empty string when nothing scorable', () => {
  const bare = { specifications: {}, offers: [{}] }
  assert.strictEqual(specScorecard(bare, [bare], 'Air Fryer'), '')
})

// --- howItStacksUp ---

test('howItStacksUp names cheaper and pricier rivals with spec deltas', () => {
  const mid = PRICED_CATEGORY[1]
  mid.product_name = 'Mid Fryer 4.5L'
  PRICED_CATEGORY[0].product_name = 'Cheap Fryer 4L'
  PRICED_CATEGORY[2].product_name = 'Big Fryer 6.2L'
  const html = howItStacksUp(mid, PRICED_CATEGORY, 'Air Fryer')
  assert.ok(html.includes('Cheap Fryer'))
  assert.ok(html.includes('Big Fryer'))
  assert.deepEqual(voiceLint(html), [])
})

test('howItStacksUp returns empty string with no priced rivals', () => {
  const solo = pricedProduct({ 'Output Wattage': '1400 Watts' }, [], 5000)
  assert.strictEqual(howItStacksUp(solo, [solo], 'Air Fryer'), '')
})

// --- tocBlock ---

test('tocBlock renders anchor links', () => {
  const html = tocBlock([{ id: 'specs', label: 'Specifications' }, { id: 'verdict', label: 'Verdict' }])
  assert.ok(html.includes('href="#specs"'))
  assert.ok(html.includes('Specifications'))
  assert.ok(html.includes('href="#verdict"'))
})

// --- updatedLine ---

test('updatedLine shows month-year and daily tracking claim', () => {
  const html = updatedLine(new Date('2026-06-12'))
  assert.ok(html.includes('June 2026'))
  assert.ok(/tracked daily|checked daily/i.test(html))
  assert.deepEqual(voiceLint(html), [])
})
