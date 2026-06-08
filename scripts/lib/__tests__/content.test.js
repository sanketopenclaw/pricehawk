// scripts/lib/__tests__/content.test.js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const os = require('os')
const path = require('path')
const fs = require('fs')
const {
  resolveOffer, specTable, featureHighlights,
  familySizeFromCapacity, getSpecVal, sparklineSVG,
  bestValueScore, topValueProduct,
  buildSlugIndex, relatedLinks,
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

test('bestValueScore returns higher score for budget products with good specs', () => {
  const budget = { price_segment: 'budget', specifications: { 'Output Wattage': '1500W', 'Capacity': '4 litres', _features: ['f1','f2','f3'] } }
  const premium = { price_segment: 'premium', specifications: { 'Output Wattage': '1500W', 'Capacity': '4 litres', _features: ['f1','f2','f3'] } }
  assert.ok(bestValueScore(budget) > bestValueScore(premium))
})

test('bestValueScore returns 0 for product with no spec data', () => {
  assert.strictEqual(bestValueScore({ price_segment: 'mid-range', specifications: {} }), 0)
})

test('topValueProduct returns product with highest score', () => {
  const p1 = { price_segment: 'budget', specifications: { 'Output Wattage': '1500W', 'Capacity': '4 litres', _features: ['a','b','c'] } }
  const p2 = { price_segment: 'flagship', specifications: { 'Output Wattage': '500W', 'Capacity': '1 litre', _features: [] } }
  assert.strictEqual(topValueProduct([p1, p2]), p1)
})

test('topValueProduct returns null for empty array', () => {
  assert.strictEqual(topValueProduct([]), null)
})

// ---------------------------------------------------------------------------
// buildSlugIndex
// ---------------------------------------------------------------------------

test('buildSlugIndex indexes review slugs by asin', () => {
  const queue = [
    { type: 'review', asin: 'B001XXXXX', brand: 'agaro', category: 'air-fryers' }
  ]
  const idx = buildSlugIndex(queue)
  assert.strictEqual(idx['B001XXXXX'].reviewSlug, 'review-agaro-b001xxxxx')
})

test('buildSlugIndex normalises brand with spaces/uppercase in review slug', () => {
  const queue = [
    { type: 'review', asin: 'B002', brand: 'Philips India', category: 'air-fryers' }
  ]
  const idx = buildSlugIndex(queue)
  assert.strictEqual(idx['B002'].reviewSlug, 'review-philips-india-b002')
})

test('buildSlugIndex indexes comparison slugs for both asins (no brands in queue)', () => {
  const queue = [
    { type: 'comparison', asins: ['B001', 'B002'], category: 'air-fryers' }
  ]
  const idx = buildSlugIndex(queue)
  // Both ASINs get an entry
  assert.ok(Array.isArray(idx['B001'].comparisonSlugs))
  assert.ok(Array.isArray(idx['B002'].comparisonSlugs))
  // Falls back to 'product' for both brand slots
  assert.ok(idx['B001'].comparisonSlugs[0].includes('compare-product-b001-vs-product-b002'))
  assert.ok(idx['B002'].comparisonSlugs[0].includes('compare-product-b001-vs-product-b002'))
})

test('buildSlugIndex uses brands array when present in comparison', () => {
  const queue = [
    { type: 'comparison', asins: ['B001', 'B002'], brands: ['philips', 'bajaj'], category: 'air-fryers' }
  ]
  const idx = buildSlugIndex(queue)
  assert.ok(idx['B001'].comparisonSlugs.some(s => s === 'compare-philips-b001-vs-bajaj-b002'))
  assert.ok(idx['B002'].comparisonSlugs.some(s => s === 'compare-philips-b001-vs-bajaj-b002'))
})

test('buildSlugIndex stores category_page as hub', () => {
  const queue = [
    { type: 'category_page', category: 'air-fryers' }
  ]
  const idx = buildSlugIndex(queue)
  assert.strictEqual(idx['__hub__air-fryers'], 'best-air-fryers')
})

test('buildSlugIndex stores buying_guide base slug', () => {
  const queue = [
    { type: 'buying_guide', category: 'air-fryers', subtype: null }
  ]
  const idx = buildSlugIndex(queue)
  assert.strictEqual(idx['__guide__air-fryers'], 'best-air-fryers')
})

test('buildSlugIndex stores buying_guide budget slug', () => {
  const queue = [
    { type: 'buying_guide', category: 'air-fryers', subtype: 'budget' }
  ]
  const idx = buildSlugIndex(queue)
  assert.strictEqual(idx['__guide__air-fryers'], 'best-air-fryers-budget')
})

test('buildSlugIndex prefers base (no subtype) guide slug over budget', () => {
  const queue = [
    { type: 'buying_guide', category: 'air-fryers', subtype: 'budget' },
    { type: 'buying_guide', category: 'air-fryers', subtype: null }
  ]
  const idx = buildSlugIndex(queue)
  assert.strictEqual(idx['__guide__air-fryers'], 'best-air-fryers')
})

test('buildSlugIndex stores use_case buying_guide slug', () => {
  const queue = [
    { type: 'buying_guide', category: 'food-processors', subtype: 'use_case', use_case: 'Small Families' }
  ]
  const idx = buildSlugIndex(queue)
  assert.strictEqual(idx['__guide__food-processors'], 'best-food-processors-small-families')
})

test('buildSlugIndex ignores comparison entries with missing asins', () => {
  const queue = [
    { type: 'comparison', category: 'air-fryers' }
  ]
  const idx = buildSlugIndex(queue)
  // No ASIN keys added
  assert.strictEqual(Object.keys(idx).length, 0)
})

// ---------------------------------------------------------------------------
// relatedLinks
// ---------------------------------------------------------------------------

test('relatedLinks returns HTML with category hub link', () => {
  const slugIndex = {
    'B001': { reviewSlug: 'review-agaro-b001', comparisonSlugs: [], catSlug: 'air-fryers' },
    '__hub__air-fryers': 'best-air-fryers',
  }
  const html = relatedLinks('B001', 'air-fryers', slugIndex, 'Air Fryer')
  assert.ok(html.includes('best-air-fryers'))
  assert.ok(html.includes('Best Air Fryers in India'))
})

test('relatedLinks uses fallback hub slug when not in index', () => {
  const html = relatedLinks('BXXX', 'air-fryers', {}, 'Air Fryer')
  assert.ok(html.includes('/best-air-fryers/'))
  assert.ok(html.includes('Best Air Fryers in India'))
})

test('relatedLinks includes buying guide link when distinct from hub', () => {
  const slugIndex = {
    '__hub__air-fryers': 'best-air-fryers',
    '__guide__air-fryers': 'best-air-fryers-budget',
  }
  const html = relatedLinks('BXXX', 'air-fryers', slugIndex, 'Air Fryer')
  assert.ok(html.includes('/best-air-fryers-budget/'))
  assert.ok(html.includes('Air Fryer Buying Guide'))
})

test('relatedLinks omits buying guide link when same as hub', () => {
  const slugIndex = {
    '__hub__air-fryers': 'best-air-fryers',
    '__guide__air-fryers': 'best-air-fryers',
  }
  const html = relatedLinks('BXXX', 'air-fryers', slugIndex, 'Air Fryer')
  // Should not have a duplicate link — only one occurrence of best-air-fryers href
  const matches = (html.match(/href="\/best-air-fryers\/"/g) || []).length
  assert.strictEqual(matches, 1)
})

test('relatedLinks includes up to 2 comparison links', () => {
  const slugIndex = {
    'B001': {
      comparisonSlugs: [
        'compare-product-b001-vs-product-b002',
        'compare-product-b001-vs-product-b003',
        'compare-product-b001-vs-product-b004',
      ]
    },
    '__hub__air-fryers': 'best-air-fryers',
  }
  const html = relatedLinks('B001', 'air-fryers', slugIndex, 'Air Fryer')
  assert.ok(html.includes('compare-product-b001-vs-product-b002'))
  assert.ok(html.includes('compare-product-b001-vs-product-b003'))
  assert.ok(!html.includes('compare-product-b001-vs-product-b004'))
})

test('relatedLinks returns non-empty string even with unknown ASIN (hub fallback)', () => {
  const html = relatedLinks('BUNKNOWN', 'coffee-machines', {}, 'Coffee Machine')
  assert.ok(html.length > 0)
  assert.ok(html.includes('/best-coffee-machines/'))
})
