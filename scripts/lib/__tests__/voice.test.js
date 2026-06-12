// scripts/lib/__tests__/voice.test.js
const { test } = require('node:test')
const assert = require('node:assert/strict')
const os = require('os')
const path = require('path')
const fs = require('fs')
const {
  voiceLint, seededPick, hedgeOpener, tradeoffVerdict,
  cantTellYouBlock, trackingSinceNote, guideOpener, reviewIntroLead,
} = require('../voice')

// --- voiceLint ---

test('voiceLint flags banned hype words', () => {
  const hits = voiceLint('This ultimate game-changer is the superior choice and guarantees success.')
  const words = hits.map(h => h.match.toLowerCase())
  assert.ok(words.some(w => w.includes('ultimate')))
  assert.ok(words.some(w => w.includes('game-changer')))
  assert.ok(words.some(w => w.includes('superior choice')))
  assert.ok(words.some(w => w.includes('guarantee')))
})

test('voiceLint flags corporate jargon from DNA banned list', () => {
  const hits = voiceLint('Leverage this synergy like a rockstar guru visionary.')
  assert.ok(hits.length >= 4)
})

test('voiceLint does not flag the Ninja brand name', () => {
  const hits = voiceLint('The Ninja AF161 Max XL air fryer (ninja series) has a 5.2L basket.')
  assert.deepEqual(hits, [])
})

test('voiceLint allows negated guarantee (honest disclaimers)', () => {
  assert.deepEqual(voiceLint('We cannot guarantee delivery for every drop.'), [])
  assert.deepEqual(voiceLint("Availability is not guaranteed and we can't guarantee accuracy."), [])
  assert.ok(voiceLint('This air fryer guarantees crispy results.').length >= 1)
  assert.ok(voiceLint('Guaranteed savings every time.').length >= 1)
})

test('voiceLint returns empty array for clean text', () => {
  const hits = voiceLint('The Philips probably suits a family of four better. It depends on how often you cook.')
  assert.deepEqual(hits, [])
})

test('voiceLint strips HTML tags before matching (no false positive on attributes)', () => {
  const hits = voiceLint('<div style="background:#ultimate-blue">a 4.2L air fryer</div>')
  assert.deepEqual(hits, [])
})

// --- seededPick ---

test('seededPick is deterministic for same seed', () => {
  const arr = ['a', 'b', 'c', 'd', 'e']
  assert.strictEqual(seededPick(arr, 'B0CBBLBDRK'), seededPick(arr, 'B0CBBLBDRK'))
})

test('seededPick returns an element of the array', () => {
  const arr = ['x', 'y', 'z']
  assert.ok(arr.includes(seededPick(arr, 'any-seed')))
})

test('seededPick varies across different seeds', () => {
  const arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const picks = new Set(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map(s => seededPick(arr, s)))
  assert.ok(picks.size > 1)
})

// --- hedgeOpener ---

test('hedgeOpener returns deterministic hedged phrase', () => {
  const a = hedgeOpener('seed1')
  assert.strictEqual(a, hedgeOpener('seed1'))
  assert.ok(/depends|honestly|probably|comes down/i.test(a))
})

// --- tradeoffVerdict ---

test('tradeoffVerdict names both products and hedges', () => {
  const html = tradeoffVerdict({
    short1: 'Philips HD9252', short2: 'Inalsa Crispyo',
    reasons1: ['higher power (1400W)'], reasons2: ['more budget-friendly'],
    seed: 'B0AAA-B0BBB',
  })
  assert.ok(html.includes('Philips HD9252'))
  assert.ok(html.includes('Inalsa Crispyo'))
  assert.ok(/depends|probably|honestly|comes down/i.test(html))
  assert.deepEqual(voiceLint(html), [])
})

test('tradeoffVerdict converts adjective reasons to noun phrases', () => {
  const html = tradeoffVerdict({
    short1: 'A', short2: 'B',
    reasons1: ['more premium build and features'], reasons2: ['more budget-friendly'],
    seed: 'x',
  })
  assert.ok(!/brings more budget-friendly|offers more budget-friendly/.test(html))
  assert.ok(html.includes('a lower price'))
  assert.ok(html.includes('a more premium build'))
})

// --- cantTellYouBlock ---

test('cantTellYouBlock admits testing and durability gaps', () => {
  const html = cantTellYouBlock('Air Fryer')
  assert.ok(/can'?t tell you/i.test(html))
  assert.ok(/lab|hands-on/i.test(html))
  assert.ok(/durab|years/i.test(html))
  assert.ok(html.includes('Air Fryer'.toLowerCase()) || html.includes('Air Fryer'))
  assert.deepEqual(voiceLint(html), [])
})

// --- trackingSinceNote ---

test('trackingSinceNote returns null when no series file', () => {
  assert.strictEqual(trackingSinceNote('missing-product', os.tmpdir()), null)
})

test('trackingSinceNote returns null with under 3 points', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-voice-'))
  fs.writeFileSync(path.join(dir, 'p1.json'), JSON.stringify({ points: [{ date: '2026-06-07', price: 100 }] }))
  assert.strictEqual(trackingSinceNote('p1', dir), null)
})

test('trackingSinceNote reports start date and day count', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-voice-'))
  fs.writeFileSync(path.join(dir, 'p2.json'), JSON.stringify({ points: [
    { date: '2026-06-07', price: 100 }, { date: '2026-06-08', price: 110 }, { date: '2026-06-09', price: 105 },
  ] }))
  const note = trackingSinceNote('p2', dir)
  assert.ok(note.includes('7 June 2026'))
  assert.ok(/3 days/.test(note))
  assert.ok(/track/i.test(note))
})

// --- guideOpener ---

test('guideOpener frames the buyer problem, names category, lint-clean', () => {
  const html = guideOpener('Air Fryers', 'air fryer', 'air-fryers')
  assert.ok(/air fryer/i.test(html))
  assert.ok(html.length > 80)
  assert.deepEqual(voiceLint(html), [])
})

test('guideOpener deterministic per category seed', () => {
  assert.strictEqual(guideOpener('Air Fryers', 'air fryer', 'air-fryers'), guideOpener('Air Fryers', 'air fryer', 'air-fryers'))
})

// --- reviewIntroLead ---

test('reviewIntroLead returns deterministic varied lead-in', () => {
  const a = reviewIntroLead('B0CBBLBDRK')
  assert.strictEqual(a, reviewIntroLead('B0CBBLBDRK'))
  assert.ok(typeof a === 'string' && a.length > 10)
  assert.deepEqual(voiceLint(a), [])
})
