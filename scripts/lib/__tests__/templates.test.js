// scripts/lib/__tests__/templates.test.js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { prosConsFromSpecs, verdictBox, updatedLine } = require('../templates')
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

// --- updatedLine ---

test('updatedLine shows month-year and daily tracking claim', () => {
  const html = updatedLine(new Date('2026-06-12'))
  assert.ok(html.includes('June 2026'))
  assert.ok(/tracked daily|checked daily/i.test(html))
  assert.deepEqual(voiceLint(html), [])
})
