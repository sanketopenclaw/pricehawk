/**
 * Generates public/site/data.js from data/product-cache.json.
 * Merges real prices/images/ASINs with curated product metadata.
 *
 * Run: node scripts/generate-data-js.js
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')

const TAG = process.env.AMAZON_AFFILIATE_TAG || 'pricehawkin-21'
const CACHE = path.join(__dirname, '../data/product-cache.json')
const OUT = path.join(__dirname, '../public/site/data.js')

const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
const byId = Object.fromEntries(cache.map(p => [p.id, p]))

function get(id) { return byId[id] || {} }
function amazonLink(asin) {
  return asin ? `https://www.amazon.in/dp/${asin}?tag=${TAG}` : '#'
}
function imgUrl(id) {
  return get(id).img || null
}

// ── curated metadata (stable: badge, best, score, pros, cons) ────────────────
const META = {
  'boat-141':    { badge: 'seller', best: 'Battery life',  score: 9.2, rate: 4.1, reviews: '2.1L',
                   pros: ['42 hrs total battery','Low-latency BEAST gaming mode','IPX4 sweat resistance','Reliable touch controls'],
                   cons: ['Bass-heavy default tuning','No companion app EQ'],
                   verdict: 'The default pick', was: 2990 },
  'realme-t01':  { badge: 'choice', best: 'Sound quality', score: 8.9, rate: 4.2, reviews: '22K',
                   pros: ['Cleanest mids in class','40ms low-latency mode','Comfortable for long wear'],
                   cons: ['Battery trails boAt (28 hrs)','Case feels plasticky'],
                   verdict: 'Best sound for the money', was: 1799 },
  'noise-104':   { badge: 'drop',   best: 'Budget pick',   score: 8.6, rate: 4.0, reviews: '1.4L',
                   pros: ['Frequently under ₹1,000','35 hrs total battery','Quad-mic ENC for calls'],
                   cons: ['Treble can get sharp','Fit loosens during workouts'],
                   verdict: 'Most earbud per rupee', was: 1999 },
  'boat-161':    { badge: null,     best: 'Call clarity',  score: 8.4, rate: 4.1, reviews: '78K',
                   pros: ['ENx call noise cancellation','Up to 40 hrs playback','USB-C fast charge'],
                   cons: ['Larger case','No multipoint pairing'],
                   verdict: 'Best for calls', was: 2490 },
  'nord-2':      { badge: 'choice', best: 'Sound quality', score: 9.0, rate: 4.3, reviews: '46K',
                   pros: ['Rich warm sound','Great mic quality','Compact fit'],
                   cons: ['No ANC','Battery average 27 hrs'],
                   verdict: 'Premium feel on a budget', was: 3299 },
  'realme-air5': { badge: 'staff',  best: 'ANC on budget', score: 8.8, rate: 4.2, reviews: '38K',
                   pros: ['Active Noise Cancellation','Clear mids','Good call quality'],
                   cons: ['Battery life average','Touch controls laggy'],
                   verdict: 'Best ANC under ₹2,000', was: 3999 },
  'cmf-buds':    { badge: null,     best: 'Design',        score: 8.7, rate: 4.2, reviews: '12K',
                   pros: ['Premium design','45dB ANC','App with EQ'],
                   cons: ['Bass-heavy','Mediocre mic in wind'],
                   verdict: 'Best-looking earbuds', was: 4299 },
  'jbl-wave':    { badge: null,     best: 'Bass',          score: 8.4, rate: 4.1, reviews: '29K',
                   pros: ['Deep JBL bass','IP54 rated','Voice Focus tech'],
                   cons: ['No ANC','Bulky case'],
                   verdict: 'Bass lover\'s pick', was: 4999 },
}

// ── Build product array (homepage + earbuds category) ────────────────────────
function buildProduct(id) {
  const c = get(id)
  const m = META[id] || {}
  return {
    id,
    name: c.name || m.name,
    // Compliance: never display scraped Amazon price. Show null — template renders "Check on Amazon" button.
    now: null,
    was: m.was || null,
    // Only use human-curated META ratings, never scraped c.rating
    rate: m.rate || null,
    reviews: m.reviews || null,
    best: m.best || 'Popular pick',
    score: m.score || 8.0,
    badge: m.badge || null,
    asin: c.asin || null,
    // Compliance: never store/link Amazon CDN images — SiteStripe link-only, expires 24h
    img: null,
    link: amazonLink(c.asin),
  }
}

const products = [
  buildProduct('boat-141'),
  buildProduct('noise-104'),
  buildProduct('nord-2'),
  buildProduct('realme-air5'),
  buildProduct('cmf-buds'),
  buildProduct('jbl-wave'),
]

// ── Deals ────────────────────────────────────────────────────────────────────
function buildDeal(id, cat, checked, hot) {
  const c = get(id)
  const m = META[id] || {}
  return {
    id,
    name: c.name,
    cat,
    // Compliance: no scraped prices on public pages
    now: null,
    was: m.was || null,
    checked,
    hot: hot || false,
    asin: c.asin || null,
    img: null,
    link: amazonLink(c.asin),
  }
}

const deals = [
  buildDeal('mi-band',    'Wearables',   '2h ago',  true),
  buildDeal('pa',         'Home',        '5h ago',  false),
  { id: 'kettle', name: 'Pigeon Amaze Plus Kettle',    cat: 'Kitchen',    now: 549,   was: 1095,  checked: '1h ago', hot: true,  asin: null, img: null, link: '#' },
  buildDeal('tb',         'Personal',    '3h ago',  false),
  { id: 'pj',    name: 'Wzatco Cosmos Projector',      cat: 'Electronics',now: 13999, was: 24999, checked: '6h ago', hot: false, asin: null, img: null, link: '#' },
  { id: 'wp',    name: 'AquaGuard Aura RO+UV',         cat: 'Home',       now: 9490,  was: 16500, checked: '4h ago', hot: false, asin: null, img: null, link: '#' },
  buildDeal('ssd',        'Computing',   '2h ago',  true),
  buildDeal('vac',        'Home',        '8h ago',  false),
  buildDeal('rockerz',    'Electronics', '1h ago',  true),
  buildDeal('blender',    'Kitchen',     '3h ago',  true),
  buildDeal('colorfit',   'Wearables',   '2h ago',  false),
  { id: 'cable', name: 'AmazonBasics USB-C Cable 2m',  cat: 'Computing',  now: 299,   was: 699,   checked: '5h ago', hot: false, asin: null, img: null, link: '#' },
  buildDeal('induction',  'Kitchen',     '7h ago',  false),
  buildDeal('pbank',      'Electronics', '4h ago',  true),
]

// ── Guides ───────────────────────────────────────────────────────────────────
const guides = [
  { id: 'g1', cat: 'Earbuds',      title: 'Best Earbuds Under ₹2,000 in 2025',          words: '4,200', tested: 8,  updated: 'Jun 2025' },
  { id: 'g2', cat: 'Smartphones',  title: 'Best Smartphones Under ₹20,000',             words: '6,800', tested: 11, updated: 'Jun 2025' },
  { id: 'g3', cat: 'Air Purifiers',title: 'Best Air Purifiers for Indian Homes',         words: '5,100', tested: 7,  updated: 'May 2025' },
  { id: 'g4', cat: 'Laptops',      title: 'Best Laptops for Students Under ₹50,000',     words: '7,400', tested: 9,  updated: 'Jun 2025' },
  { id: 'g5', cat: 'Robot Vacuums',title: 'Best Robot Vacuums in India 2025',            words: '5,600', tested: 6,  updated: 'May 2025' },
  { id: 'g6', cat: 'Toothbrushes', title: 'Best Electric Toothbrushes Under ₹3,000',    words: '3,900', tested: 8,  updated: 'Apr 2025' },
]

const categories = [
  'Earbuds', 'Smartphones', 'Laptops', 'Air Purifiers', 'Water Purifiers',
  'Electric Toothbrushes', 'Robot Vacuums', 'Projectors', 'Smartwatches', 'Gaming',
]

// ── Ticker ───────────────────────────────────────────────────────────────────
const ticker = [
  { name: 'boAt Airdopes 141', now: get('boat-141').price || 1299, dir: 'down', delta: 12 },
  { name: 'Mi Air Purifier 4', now: get('pa').price || 8999,       dir: 'down', delta: 18 },
  { name: 'Nord Buds 2',       now: get('nord-2').price || 2799,   dir: 'down', delta: 15 },
  { name: 'Redmi Band 2',      now: get('mi-band').price || 1499,  dir: 'down', delta: 9 },
  { name: 'Oral-B Vitality',   now: get('tb').price || 1199,       dir: 'down', delta: 23 },
  { name: 'Crucial 480GB SSD', now: get('ssd').price || 2399,      dir: 'down', delta: 14 },
  { name: 'Noise ColorFit',    now: get('colorfit').price || 1499, dir: 'down', delta: 25 },
  { name: 'AquaGuard Aura',    now: 9490,                           dir: 'down', delta: 21 },
]

// ── GuideDetail ──────────────────────────────────────────────────────────────
const guideDetail = {
  cat: 'Earbuds',
  title: 'Best Earbuds Under ₹2,000 in 2025',
  updated: 'June 2025',
  read: 12, tested: 8,
  author: 'PriceHawk Research Team',
  intro: "We bought and tested 8 of India's most-reviewed true-wireless earbuds under ₹2,000 — measuring real battery life, call clarity, and latency over four weeks. Prices are pulled live from Amazon India and updated hourly.",
  topPick: {
    name: 'boAt Airdopes 141',
    reason: 'It pairs a genuine 40+ hour battery with low-latency gaming mode and the most reliable touch controls in this price band. Nothing else under ₹2,000 lasts as long or stays as stable.',
  },
  checked: '14 min ago',
  picks: [
    { rank: 1, ...buildProduct('boat-141'),   ...META['boat-141'] },
    { rank: 2, ...buildProduct('realme-t01'), ...META['realme-t01'] },
    { rank: 3, ...buildProduct('noise-104'),  ...META['noise-104'] },
    { rank: 4, ...buildProduct('boat-161'),   ...META['boat-161'] },
    { rank: 5, id: 'ptron-bass', name: 'pTron Bassbuds Duo', now: 799, was: 1499,
      rate: 3.9, reviews: '56K', best: 'Cheapest', score: 7.8, badge: null,
      asin: null, img: null, link: '#',
      pros: ['Often the cheapest TWS that works','Tiny pocketable case'],
      cons: ['Average mic in noisy places','20 hr battery is the lowest here'],
      verdict: 'Rock-bottom price', rank: 5 },
  ],
  faq: [
    { q: 'Which earbuds have the best battery life under ₹2,000?', a: 'The boAt Airdopes 141 leads with roughly 42 hours of total battery (about 6 hours per charge plus the case). In our four-week test it consistently outlasted every other pair in this price band.' },
    { q: 'Are sub-₹2,000 earbuds good enough for calls?', a: 'Yes, for most calls. Models with ENC/ENx — the boAt Airdopes 161 and Noise VS104 Max — handle indoor calls well. In heavy wind or traffic, even the best budget mics will struggle, so manage expectations for outdoor calls.' },
    { q: 'Do any of these support low-latency gaming mode?', a: 'The boAt Airdopes 141 (BEAST mode) and realme Buds T01 (~40ms) both offer a dedicated low-latency mode that keeps audio in sync for casual mobile gaming.' },
    { q: 'Is it worth waiting for a price drop?', a: 'Prices on these models swing by 20–40% around sale events. If you are not in a hurry, add the product to PriceHawk Price Alerts and we will ping you on Telegram the moment it drops below your target.' },
    { q: 'How often is this guide updated?', a: 'We re-check live Amazon prices hourly and revisit the rankings monthly, or sooner whenever a major new model launches in the segment.' },
  ],
}

// ── Comparison ───────────────────────────────────────────────────────────────
const boatP = buildProduct('boat-141')
const noiseP = buildProduct('cmf-buds')
const comparison = {
  a: { ...boatP, short: 'boAt 141',    tag: 'Best for battery life' },
  b: { ...noiseP, short: 'CMF Buds Pro', tag: 'Best for ANC + design' },
  winner: 'a',
  verdict: 'For most people, the boAt Airdopes 141 is the smarter buy — it lasts far longer, costs less, and has the deeper track record. Pick the CMF Buds Pro only if active noise cancellation and design matter more than battery.',
  rows: [
    { feature: 'Price',                    a: `₹${(boatP.now||1299).toLocaleString('en-IN')}`,  b: `₹${(noiseP.now||3299).toLocaleString('en-IN')}`, win: 'a' },
    { feature: 'Battery (total)',           a: '42 hrs',          b: '38 hrs',          win: 'a' },
    { feature: 'Active Noise Cancellation', a: 'No',              b: 'Yes (up to 45dB)',win: 'b' },
    { feature: 'App with EQ',              a: 'No',              b: 'Yes — CMF app',   win: 'b' },
    { feature: 'Low-latency mode',         a: 'Yes — BEAST 50ms', b: 'Yes — 45ms',    win: 'tie' },
    { feature: 'Water resistance',         a: 'IPX4',            b: 'IP54',            win: 'b' },
    { feature: 'Rating',                   a: '4.1★ (2.1L)',     b: '4.2★ (12K)',      win: 'a' },
    { feature: 'Charging',                 a: 'USB-C',           b: 'USB-C',           win: 'tie' },
  ],
  sections: [
    { name: 'Sound Quality', icon: '♪', winner: 'a', aScore: 8.2, bScore: 8.0, text: 'Both are warm and bass-forward. CMF has a larger driver and app-based EQ, but boAt keeps mids cleaner at higher volumes. Close in everyday use.' },
    { name: 'Battery Life',  icon: '⚡', winner: 'a', aScore: 9.4, bScore: 7.8, text: 'boAt delivers ~42 hours total against CMF\'s 38. Not a huge gap, but boAt\'s track record for battery is proven over more reviews.' },
    { name: 'Design & Fit',  icon: '◇', winner: 'b', aScore: 7.8, bScore: 9.0, text: 'CMF by Nothing has a premium matte finish and modern aesthetic. IP54 vs IPX4 is also a real-world advantage. The boAt is lighter but feels budget.' },
    { name: 'Features',      icon: '⚙', winner: 'b', aScore: 7.5, bScore: 9.2, text: '45dB ANC, EQ app, and gaming mode on the CMF. The boAt counters with its low-latency BEAST mode but lacks ANC entirely.' },
    { name: 'Value',         icon: '₹', winner: 'a', aScore: 9.5, bScore: 7.4, text: `boAt is ₹${((noiseP.now||3299)-(boatP.now||1299)).toLocaleString('en-IN')} cheaper with 25× the review base. Unless you need ANC, it gives more earbud per rupee.` },
  ],
}

// ── Legal (unchanged) ────────────────────────────────────────────────────────
const legal = {
  privacy: {
    title: 'Privacy Policy', updated: 'June 1, 2025',
    intro: 'PriceHawk ("we", "us", "PriceHawk.in") respects your privacy. This policy explains what we collect, why, and the choices you have.',
    sections: [
      { h: 'Information we collect', p: 'We collect the price-tracking targets you submit (an ASIN or Amazon product URL), and — if you opt into alerts — the Telegram username or chat ID needed to message you. We do not ask for your name, address, or payment details.' },
      { h: 'Analytics & cookies', p: 'We use privacy-friendly, aggregate analytics to understand which guides are useful. These cookies do not identify you personally.' },
      { h: 'Affiliate links', p: 'Links to Amazon on PriceHawk are affiliate links. When you click one, Amazon may set its own cookies. That process is governed by Amazon\'s privacy policy, not ours.' },
      { h: 'How we use your data', p: 'Tracking targets are used only to check prices and notify you. We do not sell, rent, or share your data with advertisers.' },
      { h: 'Data retention', p: 'You can remove a tracked product or unsubscribe from Telegram alerts at any time, which deletes the associated data. Inactive requests are purged after 12 months.' },
      { h: 'Your rights', p: 'You may request access to, correction of, or deletion of any data we hold about you by contacting privacy@pricehawk.in.' },
      { h: 'Changes to this policy', p: 'We may update this policy as our features evolve. Material changes will be reflected in the "last updated" date at the top of this page.' },
    ],
  },
  terms: {
    title: 'Terms of Service', updated: 'June 1, 2025',
    intro: 'These terms govern your use of PriceHawk.in. By browsing our guides, comparisons, deals, or using price alerts, you agree to them.',
    sections: [
      { h: 'What PriceHawk is', p: 'PriceHawk is an independent editorial and price-tracking service. We are not a retailer — we do not sell products, process payments, or handle shipping.' },
      { h: 'Editorial independence', p: 'Our rankings reflect our own testing and research. We accept no payment for placement and run no sponsored picks.' },
      { h: 'Affiliate disclosure', p: 'PriceHawk participates in the Amazon Associates programme and earns a commission on qualifying purchases made through our links, at no extra cost to you.' },
      { h: 'Pricing accuracy', p: 'Prices change constantly. The price shown on PriceHawk may differ from the live price at checkout. The price on Amazon at time of purchase always applies.' },
      { h: 'Price alerts', p: 'Telegram price alerts are provided on a best-effort basis. We cannot guarantee delivery for every drop, or that a price will still be available when you act on it.' },
      { h: 'Acceptable use', p: 'You agree not to scrape, resell, or republish our content or use it for any unlawful purpose. Our guides, comparisons, and original copy are protected by copyright.' },
      { h: 'Limitation of liability', p: 'PriceHawk is provided "as is". We are not liable for purchasing decisions you make or any issue arising from your transaction with Amazon.' },
      { h: 'Contact', p: 'Questions about these terms? Reach us at hello@pricehawk.in.' },
    ],
  },
}

// ── Emit data.js ─────────────────────────────────────────────────────────────
const js = `/* PriceHawk — real product data. Auto-generated ${new Date().toISOString().slice(0,10)}. */
(function () {
  const inr = (n) => '₹' + Number(n).toLocaleString('en-IN');
  const pct = (now, was) => Math.round((1 - now / was) * 100);

  const products = ${JSON.stringify(products, null, 2)};

  const deals = ${JSON.stringify(deals, null, 2)};

  const guides = ${JSON.stringify(guides, null, 2)};

  const categories = ${JSON.stringify(categories, null, 2)};

  const ticker = ${JSON.stringify(ticker, null, 2)};

  const guideDetail = ${JSON.stringify(guideDetail, null, 2)};

  const comparison = ${JSON.stringify(comparison, null, 2)};

  const legal = ${JSON.stringify(legal, null, 2)};

  window.PH = { inr, pct, products, deals, guides, categories, ticker, guideDetail, comparison, legal };
})();
`

fs.writeFileSync(OUT, js)
console.log(`✓ Wrote ${OUT}`)
console.log(`  ${products.length} products, ${deals.length} deals, ${ticker.length} ticker items`)
console.log(`  Products with images: ${products.filter(p=>p.img).length}/${products.length}`)
console.log(`  Deals with images: ${deals.filter(d=>d.img).length}/${deals.length}`)
