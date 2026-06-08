// scripts/lib/__tests__/content.test.js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const os = require('os')
const path = require('path')
const fs = require('fs')
const {
  resolveOffer, specTable, featureHighlights,
  familySizeFromCapacity, getSpecVal, sparklineSVG,
} = require('../content')

test('specTable renders rows from specifications', () => {
  const html = specTable({ 'Output Wattage': '1400 Watts', 'Capacity': '4.5 litres' })
  assert.ok(html.includes('<table'))
  assert.ok(html.includes('Output Wattage'))
  assert.ok(html.includes('1400 Watts'))
  assert.ok(html.includes('Capacity'))
})

test('specTable skips keys starting with _', () => {
  const html = specTable({ '_features': ['x'], 'Wattage': '1000W' })
  assert.ok(!html.includes('_features'))
  assert.ok(html.includes('Wattage'))
})

test('specTable returns empty string for empty or null specs', () => {
  assert.strictEqual(specTable({}), '')
  assert.strictEqual(specTable(null), '')
  assert.strictEqual(specTable(undefined), '')
})

test('featureHighlights renders first 3 items only', () => {
  const html = featureHighlights(['f1', 'f2', 'f3', 'f4', 'f5'])
  assert.ok(html.includes('f1'))
  assert.ok(html.includes('f3'))
  assert.ok(!html.includes('f4'))
})

test('featureHighlights returns empty string for empty/null', () => {
  assert.strictEqual(featureHighlights([]), '')
  assert.strictEqual(featureHighlights(null), '')
  assert.strictEqual(featureHighlights(undefined), '')
})

test('familySizeFromCapacity maps capacity to household size', () => {
  assert.strictEqual(familySizeFromCapacity('1.5 litres'), '1–2 people')
  assert.strictEqual(familySizeFromCapacity('2.5 litres'), '2–3 people')
  assert.strictEqual(familySizeFromCapacity('4.5 litres'), 'a family of 3–4')
  assert.strictEqual(familySizeFromCapacity('5 litres'), 'a family of 4–6')
  assert.strictEqual(familySizeFromCapacity('8L'), 'large families or batch cooking')
  assert.strictEqual(familySizeFromCapacity(null), null)
  assert.strictEqual(familySizeFromCapacity('no number'), null)
})

test('resolveOffer unwraps array offers', () => {
  const p = { offers: [{ external_id: 'B001' }] }
  assert.strictEqual(resolveOffer(p).external_id, 'B001')
})

test('resolveOffer handles object offers', () => {
  const p = { offers: { external_id: 'B002' } }
  assert.strictEqual(resolveOffer(p).external_id, 'B002')
})

test('resolveOffer returns empty object for missing offers', () => {
  assert.deepStrictEqual(resolveOffer({}), {})
})

test('getSpecVal returns first matching key', () => {
  const specs = { 'Output Wattage': '1400 Watts' }
  assert.strictEqual(getSpecVal(specs, 'Wattage', 'Output Wattage'), '1400 Watts')
})

test('getSpecVal returns null when no key matches', () => {
  assert.strictEqual(getSpecVal({ 'Capacity': '4L' }, 'Wattage', 'Output Wattage'), null)
})

test('sparklineSVG returns empty string for missing product', () => {
  assert.strictEqual(sparklineSVG('nonexistent-product-id', os.tmpdir()), '')
})

test('sparklineSVG returns empty string for fewer than 3 data points', () => {
  const tmpDir = os.tmpdir()
  const tmpFile = path.join(tmpDir, 'test-product.json')
  fs.writeFileSync(tmpFile, JSON.stringify({
    product_id: 'test-product',
    points: [
      { date: '2026-06-07', price: 10000, merchant: 'amazon_in' },
      { date: '2026-06-08', price: 9999, merchant: 'amazon_in' },
    ],
  }))
  assert.strictEqual(sparklineSVG('test-product', tmpDir), '')
  fs.unlinkSync(tmpFile)
})

test('sparklineSVG returns SVG for valid price series', () => {
  const tmpDir = os.tmpdir()
  const tmpFile = path.join(tmpDir, 'test-product.json')
  fs.writeFileSync(tmpFile, JSON.stringify({
    product_id: 'test-product',
    points: [
      { date: '2026-06-04', price: 10000, merchant: 'amazon_in' },
      { date: '2026-06-05', price: 9500, merchant: 'amazon_in' },
      { date: '2026-06-06', price: 9800, merchant: 'amazon_in' },
      { date: '2026-06-07', price: 9200, merchant: 'amazon_in' },
      { date: '2026-06-08', price: 9100, merchant: 'amazon_in' },
    ],
  }))
  const svg = sparklineSVG('test-product', tmpDir)
  assert.ok(svg.includes('<svg'))
  assert.ok(svg.includes('<polyline'))
  fs.unlinkSync(tmpFile)
})
