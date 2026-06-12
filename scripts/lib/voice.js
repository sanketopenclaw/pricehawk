// scripts/lib/voice.js
// Sanket DNA voice layer: hedged certainty, no hype, honest gaps, deterministic variation.
// Source: "Sanket Bhoirkar DNA" AI training file — tone: conversational, practical, direct;
// never absolutes; "curious builder documenting", not "expert impressing".
const fs = require('fs')
const path = require('path')

// DNA banned words + affiliate-hype absolutes. Matched case-insensitively on tag-stripped text.
const BANNED_PATTERNS = [
  /\bleverage\b/gi,
  /\bsynerg\w*/gi,
  /\brockstar\b/gi,
  /\bguru\b/gi,
  // 'ninja' deliberately excluded — Ninja is an air-fryer brand; DNA ban targets persona-speak templates never emit
  /\bvisionar\w*/gi,
  /\bultimate\b/gi,
  /game-?changer/gi,
  /\brevolutionar\w*/gi,
  /\bunbeatable\b/gi,
  /must-?have\b/gi,
  /best-?ever\b/gi,
  /world-?class/gi,
  /cutting-?edge/gi,
  /superior choice/gi,
  // Positive guarantee claims only — negated forms ("cannot guarantee", "not guaranteed") are honest disclaimers
  /(?<!\b(?:cannot|can't|not|no|never|don't|doesn't|won't|without)\s)\bguarantee[sd]\b/gi,
  /perfect for everyone/gi,
]

// Strip tags + attributes so style values never false-positive
function stripHTML(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ')
}

function voiceLint(text) {
  const plain = stripHTML(text)
  const hits = []
  for (const re of BANNED_PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(plain)) !== null) {
      hits.push({ pattern: re.source, match: m[0] })
    }
  }
  return hits
}

// Small deterministic hash → stable phrase variation per ASIN/slug, no RNG drift between runs
function seededIndex(seedStr, len) {
  let h = 5381
  const s = String(seedStr)
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h % len
}

function seededPick(arr, seedStr) {
  return arr[seededIndex(seedStr, arr.length)]
}

const HEDGE_OPENERS = [
  'Honestly, it depends on your kitchen.',
  'There is no single right answer here — it depends on how you cook.',
  'It mostly comes down to who is doing the cooking, and for how many.',
  'Neither is a wrong pick. The better one depends on your setup.',
  'The honest answer: it depends on what you cook most often.',
]

function hedgeOpener(seedStr) {
  return seededPick(HEDGE_OPENERS, seedStr)
}

const VERDICT_CLOSERS = [
  'Maybe neither difference matters for your cooking — in that case, let price decide.',
  'If you are still torn, the cheaper one on the day you buy is probably the sensible call.',
  'Still undecided? Go with the one whose capacity matches your household — that is the difference you will notice daily.',
]

// Adjective reason phrases (from buildPickDecisions) → noun phrases that fit "brings/offers X"
const REASON_NOUN_MAP = [
  [/^more budget-friendly$/i, 'a lower price'],
  [/^more premium build and features$/i, 'a more premium build'],
  [/^more compact$/i, 'a more compact footprint'],
]

function reasonNoun(reason, fallback) {
  if (!reason) return fallback
  const head = reason.split('—')[0].trim()
  for (const [re, noun] of REASON_NOUN_MAP) {
    if (re.test(head)) return noun
  }
  return head
}

// Hedged tradeoff paragraph (DNA archetype 5) rendered above the pick boxes
function tradeoffVerdict({ short1, short2, reasons1 = [], reasons2 = [], seed = '' }) {
  const opener = hedgeOpener(seed)
  const r1 = reasonNoun(reasons1[0], 'its overall spec balance')
  const r2 = reasonNoun(reasons2[0], 'its overall spec balance')
  const closer = seededPick(VERDICT_CLOSERS, seed + '-c')
  return `<p style="font-size:15px;line-height:1.7;color:#333;margin:0 0 16px;">
${opener} On paper, the <strong>${short1}</strong> brings ${r1}, while the <strong>${short2}</strong> offers ${r2}.
${closer}
</p>`
}

// Honesty block (DNA: comfortable with uncertainty; trust through admitted gaps)
function cantTellYouBlock(catLabel) {
  const cat = String(catLabel || 'product').toLowerCase()
  return `<div style="background:#f8f9fa;border:1px solid #e8e8e8;border-left:3px solid #607d8b;border-radius:6px;padding:14px 18px;margin:24px 0;font-size:13.5px;line-height:1.7;color:#444;">
<strong>What we can't tell you:</strong> We haven't run this ${cat} through a lab or used it hands-on, so we can't speak to long-term durability — how it holds up after two years of daily use is something only time and owner reviews reveal. What we can do is read the spec sheet carefully, compare it honestly against rivals, and track its real price every day.
</div>`
}

// True first-person data claim — the one "I tested" PriceHawk can honestly make
function trackingSinceNote(productId, priceSeriesDir) {
  try {
    const file = path.join(priceSeriesDir, `${productId}.json`)
    if (!fs.existsSync(file)) return null
    const series = JSON.parse(fs.readFileSync(file, 'utf8'))
    const points = series.points || []
    if (points.length < 3) return null
    const first = points[0].date
    const d = new Date(first + 'T00:00:00')
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    return `We've been tracking this product's Amazon price daily since ${dateStr} (${points.length} days of data so far).`
  } catch {
    return null
  }
}

const GUIDE_PROBLEMS = [
  (label, singular) => `Buying ${aOrAn(singular)} ${singular} in India usually starts the same way: forty open tabs, every listing claiming to be the best, and no clear way to tell them apart. This guide tries to fix that.`,
  (label, singular) => `The hard part of choosing ${aOrAn(singular)} ${singular} isn't the shortage of options — it's that most listings describe every model in nearly identical words. So instead of adjectives, we compared the actual spec sheets.`,
  (label, singular) => `Before picking ${aOrAn(singular)} ${singular}, it helps to know which differences actually matter day-to-day and which are marketing. We went through the specifications of every model we track to separate the two.`,
]

function aOrAn(str) {
  return /^[aeiou]/i.test(String(str)) ? 'an' : 'a'
}

// Diagnosis-style opener (DNA: teach through diagnosis, start with the problem)
function guideOpener(catLabel, catSingular, seedStr) {
  const build = seededPick(GUIDE_PROBLEMS, seedStr)
  return `<p style="font-size:16px;line-height:1.8;color:#333;margin:24px 0;">${build(catLabel, catSingular)} We haven't lab-tested these — our picks come from spec analysis, price tracking, and patterns in public owner reviews.</p>`
}

const REVIEW_LEADS = [
  'Here is what the spec sheet actually says, minus the marketing.',
  'We went through the published specifications line by line — here is what stands out.',
  'On paper, this is what you are getting.',
  'Strip away the listing copy and the specs tell a fairly clear story.',
  'The short version, straight from the documented specs:',
]

// Varied lead-in before the spec-derived intro sentence (breaks the template rhythm)
function reviewIntroLead(seedStr) {
  return seededPick(REVIEW_LEADS, seedStr)
}

module.exports = {
  BANNED_PATTERNS, voiceLint, seededPick, hedgeOpener,
  tradeoffVerdict, cantTellYouBlock, trackingSinceNote,
  guideOpener, reviewIntroLead,
}
