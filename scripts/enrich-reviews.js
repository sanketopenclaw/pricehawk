/**
 * PriceHawk Review Enrichment
 * Scrapes product pages (with JS rendering + scroll) to extract:
 *   - Star distribution (5★–1★ percentages)
 *   - Feature highlights (from review section)
 *   - Top positive + critical review text
 *   - Reported issues
 *   - Sentiment score (0–10)
 *
 * Usage:
 *   node scripts/enrich-reviews.js                       # all products in db
 *   node scripts/enrich-reviews.js --cat earbuds         # single category
 *   node scripts/enrich-reviews.js --asin B0F8BVSK21     # single product
 *   node scripts/enrich-reviews.js --top 10              # top N per category
 *   node scripts/enrich-reviews.js --resume              # skip already-enriched
 *   node scripts/enrich-reviews.js --concurrency 5       # parallel workers (default 3)
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { scrape } = require('./scraper')

const PRODS_DIR = path.join(__dirname, '../data/products')
const DELAY_MS = 1000

// ─── STAR DISTRIBUTION ───────────────────────────────────────────────────────

function parseStarDistribution(md) {
  // Amazon renders histogram as links: [LINK_TEXT](url?filterByStar=five_star...)
  // LINK_TEXT ends with the percentage for that star level
  const dist = {}
  const starNames = { five: 5, four: 4, three: 3, two: 2, one: 1 }
  for (const [name, num] of Object.entries(starNames)) {
    const m = md.match(new RegExp(`\\[([^\\]]+)\\]\\([^)]*filterByStar=${name}_star[^)]*\\)`))
    if (m) {
      const pcts = [...m[1].matchAll(/(\d+)%/g)].map(x => parseInt(x[1]))
      if (pcts.length) dist[`${num}_star`] = pcts[pcts.length - 1]
    }
  }
  return Object.keys(dist).length >= 3 ? dist : null
}

// ─── FEATURE HIGHLIGHTS ──────────────────────────────────────────────────────

function parseFeatureHighlights(md) {
  const features = []

  // "Customers say the X, Y, Z of this product"
  const likeM = md.match(/customers\s+(?:say|like|mention|appreciate|highlight)\s+(?:the\s+)?([^.\n]+)/gi)
  if (likeM) {
    for (const match of likeM.slice(0, 3)) {
      const text = match.replace(/customers\s+(?:say|like|mention|appreciate|highlight)\s+(?:the\s+)?/i, '').trim()
      if (text.length > 3 && text.length < 200) features.push(text)
    }
  }

  // Feature chips: sound quality, battery life, etc.
  const chipRe = /(?:sound quality|battery life?|value for money|build quality|noise cancell|bass|comfort|call quality|connectivity|design|display|performance|camera|charging speed|microphone|treble)[^\n]*(?:[·|,][^\n]+)?/gi
  const chipM = md.match(chipRe)
  if (chipM) {
    for (const chip of chipM.slice(0, 5)) {
      const clean = chip.replace(/[*_[\]()]/g, '').trim()
      if (clean.length > 3 && clean.length < 100 && !features.some(f => f.toLowerCase().includes(clean.substring(0, 15).toLowerCase()))) {
        features.push(clean)
      }
    }
  }

  return features.slice(0, 6)
}

// ─── REVIEW PARSER ───────────────────────────────────────────────────────────

/**
 * Amazon product page structure (JS-rendered, scrolled):
 * - Each review appears TWICE: first as brief+full toggle, then as clean form after profile link
 * - Clean form pattern: NAME](profile_url)\n\n_N stars_\n\n##### Title\n\nReviewed in...\n\n[Verified Purchase]\n\nReview text\n\nReport
 * - Split by \nReport\n to get individual review chunks
 */
function parseReviews(md) {
  const sectionIdx = md.indexOf('Top reviews from India')
  const altIdx = md.indexOf('Top reviews from other countries')
  const startIdx = sectionIdx >= 0 ? sectionIdx : (altIdx >= 0 ? altIdx : -1)
  if (startIdx < 0) return []

  const section = md.slice(startIdx)
  const chunks = section.split('\nReport\n')
  const reviews = []

  for (const chunk of chunks) {
    if (!chunk.includes('gp/profile')) continue

    // Reviewer name: appears just before ](profile_url) after the backslash-newline sequence
    const nameM = chunk.match(/([A-Za-z][^\n\]\\]{1,40})\]\(https:\/\/www\.amazon\.in\/gp\/profile\//)
    const reviewer = nameM?.[1]?.trim() || null

    // After the profile URL closing paren
    const profileEnd = chunk.indexOf('](https://www.amazon.in/gp/profile/')
    if (profileEnd < 0) continue
    const urlEnd = chunk.indexOf(')', profileEnd + 1)
    const clean = chunk.slice(urlEnd + 1)

    const starsM = clean.match(/_(\d+(?:\.\d+)?) out of 5 stars_/)
    if (!starsM) continue
    const rating = parseFloat(starsM[1])

    const titleM = clean.match(/##### (.+)/)
    const title = titleM?.[1]?.trim() || null

    const dateM = clean.match(/Reviewed in (.+?) on (\d{1,2} \w+ \d{4})/)
    const date = dateM?.[2] || null
    const location = dateM?.[1] || null

    // Text: everything after [Verified Purchase] link (or after Reviewed in line)
    let textStart = clean.indexOf('Verified Purchase](')
    if (textStart >= 0) {
      textStart = clean.indexOf('\n', textStart) + 1
    } else {
      const revIdx = clean.indexOf('Reviewed in ')
      textStart = revIdx >= 0 ? clean.indexOf('\n', revIdx) + 1 : 0
    }

    let text = clean.slice(textStart)
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\n{3,}/g, '\n')
      .replace(/^\s+/gm, '')
      .trim()
      .slice(0, 400)

    if (text.length > 20) {
      reviews.push({ reviewer, rating, title, date, location, text })
    }
  }

  return reviews
}

// ─── ISSUES EXTRACTOR ────────────────────────────────────────────────────────

function extractIssues(md) {
  const issues = []
  const issuePatterns = [
    /(?:stopped?\s+working|broke?|broke?\s+after|died?\s+after|failed?\s+after)[^\n.]{5,80}/gi,
    /(?:poor|bad|terrible|worst|pathetic)\s+(?:sound|battery|build|quality|bass|call|mic|connectivity|charging|support|warranty)[^\n.]{0,60}/gi,
    /(?:mic|microphone|anc|noise cancell|bass|battery|charging|pairing|bluetooth|connectivity|sound)\s+(?:not\s+working|doesn.t\s+work|issues?|problem|fail)[^\n.]{0,60}/gi,
    /battery\s+(?:drain|die|lasts?\s+only|very\s+short|bad)[^\n.]{0,60}/gi,
    /(?:lag|latency|delay|disconnect|drop|static|noise|hiss|distort|crack|hum)[^\n.]{5,80}/gi,
    /(?:only\s+\d+\s+(?:days?|months?|weeks?)|within\s+\d+\s+(?:days?|months?))[^\n.]{0,60}/gi,
  ]

  for (const pat of issuePatterns) {
    const matches = [...md.matchAll(pat)]
    for (const match of matches.slice(0, 2)) {
      const issue = match[0]
        .replace(/[*_[\]()#]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120)
      if (issue.length > 10 && !issues.some(i => i.toLowerCase().includes(issue.substring(0, 20).toLowerCase()))) {
        issues.push(issue)
      }
    }
  }

  return [...new Set(issues)].slice(0, 6)
}

// ─── SENTIMENT ───────────────────────────────────────────────────────────────

function deriveSentiment(dist, issues) {
  if (!dist) return null
  const total = Object.values(dist).reduce((s, v) => s + v, 0)
  if (!total) return null
  const wavg = (
    (dist['5_star'] || 0) * 5 +
    (dist['4_star'] || 0) * 4 +
    (dist['3_star'] || 0) * 3 +
    (dist['2_star'] || 0) * 2 +
    (dist['1_star'] || 0) * 1
  ) / total
  const base = ((wavg - 1) / 4) * 10
  const issuePenalty = Math.min((issues?.length || 0) * 0.3, 1.5)
  return Math.round((base - issuePenalty) * 10) / 10
}

// ─── FULL PAGE PARSER ─────────────────────────────────────────────────────────

function buildReviewText(reviews) {
  // Concatenate all review texts into one clean string for analysis
  return reviews.map(r => r.text || '').join('\n\n')
}

function extractLikedFeatures(reviewTexts) {
  // Pull out what people liked from positive review text
  const features = []
  const positiveWords = ['great', 'excellent', 'amazing', 'good', 'love', 'perfect', 'best', 'clear', 'comfortable', 'easy', 'fast', 'strong', 'crisp', 'solid', 'impressive']
  const featureWords = ['sound', 'bass', 'battery', 'comfort', 'build', 'call quality', 'noise cancel', 'connectivity', 'charging', 'display', 'performance', 'value', 'quality', 'mic', 'fit', 'design']

  for (const feat of featureWords) {
    const re = new RegExp(`(?:${positiveWords.slice(0, 8).join('|')})[^.!?]{0,30}${feat}|${feat}[^.!?]{0,30}(?:${positiveWords.slice(0, 8).join('|')})`, 'gi')
    const m = reviewTexts.match(re)
    if (m) {
      const clean = m[0].replace(/[*_[\]()]/g, '').trim().slice(0, 80)
      if (clean.length > 5 && !features.some(f => f.toLowerCase().includes(feat))) features.push(clean)
    }
  }
  return features.slice(0, 5)
}

function parseReviewPage(md) {
  const result = {
    star_distribution: null,
    feature_highlights: [],
    top_positive: null,
    top_critical: null,
    issues: [],
    sentiment_score: null,
    review_summary: null
  }

  result.star_distribution = parseStarDistribution(md)

  const reviews = parseReviews(md)

  // Top positive: highest-rated review with meaningful text
  const positives = reviews.filter(r => r.rating >= 4).sort((a, b) => b.rating - a.rating)
  result.top_positive = positives[0] || null

  // Top critical: lowest-rated review
  const criticals = reviews.filter(r => r.rating <= 3).sort((a, b) => a.rating - b.rating)
  result.top_critical = criticals[0] || null

  // Feature highlights and issues from review text only (not full page)
  const allReviewText = buildReviewText(reviews)
  const positiveText = buildReviewText(positives)
  const criticalText = buildReviewText(criticals)

  if (positiveText.length > 20) {
    result.feature_highlights = extractLikedFeatures(positiveText)
    // Fallback: use the "Customers say" section from full page if no highlights from reviews
    if (!result.feature_highlights.length) {
      result.feature_highlights = parseFeatureHighlights(md)
    }
  }

  result.issues = criticalText.length > 20 ? extractIssues(criticalText) : []

  result.sentiment_score = deriveSentiment(result.star_distribution, result.issues)

  // One-line summary
  const lines = []
  if (result.feature_highlights.length) lines.push(`Liked: ${result.feature_highlights.slice(0, 3).join(', ')}`)
  if (result.top_positive?.text) lines.push(`"${result.top_positive.text.slice(0, 100).trim()}"`)
  if (result.issues.length) lines.push(`Issues: ${result.issues.slice(0, 2).join('; ')}`)
  if (lines.length) result.review_summary = lines.join('. ')

  return result
}

// ─── SCRAPER ─────────────────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function enrichProduct(product, providers = null) {
  const url = `https://www.amazon.in/dp/${product.asin}`
  let md = ''
  try {
    const scrapeOpts = providers
      ? { waitFor: 5000, scroll: true, providers }
      : { waitFor: 5000, scroll: true, race: true }
    md = await scrape(url, scrapeOpts)
  } catch (e) {
    console.warn(`  scrape error for ${product.asin}: ${e.message}`)
    return null
  }

  // Refresh price/rating from product page
  const priceM = md.match(/₹\s*([\d,]+)/)
  if (priceM) {
    const p = parseInt(priceM[1].replace(/,/g, ''))
    if (p > 50 && p < 2000000) product.current_price = p
  }

  const ratingM = md.match(/([\d.]+)\s*out of 5\s*stars/i)
  if (ratingM) product.rating = parseFloat(ratingM[1])

  const revCountM = md.match(/([\d,]+(?:\.\d+)?[LK]?)\s*(?:global\s+)?(?:ratings?|reviews?)/i)
  if (revCountM) product.review_count = revCountM[1].replace(/,/g, '')

  const reviews = parseReviewPage(md)
  return { ...product, reviews }
}

// ─── WORKER POOL ─────────────────────────────────────────────────────────────

async function runPool(items, concurrency, fn) {
  let i = 0
  async function next() {
    while (i < items.length) {
      const item = items[i++]
      await fn(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next))
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const resume = args.includes('--resume')
  const catIdx = args.indexOf('--cat')
  const catFilter = catIdx !== -1 ? args[catIdx + 1] || null : null
  const asinIdx = args.indexOf('--asin')
  const asinFilter = asinIdx !== -1 ? args[asinIdx + 1] || null : null
  const topIdx = args.indexOf('--top')
  const topN = topIdx !== -1 ? parseInt(args[topIdx + 1]) || 10 : null
  const concIdx = args.indexOf('--concurrency')
  const concurrency = concIdx !== -1 ? parseInt(args[concIdx + 1]) || 3 : 3
  // --slice 0/3 → this process owns categories at index 0,3,6,... of the sorted list
  const sliceIdx = args.indexOf('--slice')
  let sliceN = 0, sliceOf = 1
  if (sliceIdx !== -1) {
    const [n, of_] = (args[sliceIdx + 1] || '0/1').split('/').map(Number)
    sliceN = n; sliceOf = of_ || 1
  }
  // --providers crawl4ai,firecrawl → preferred provider order for this process
  const providersIdx = args.indexOf('--providers')
  const providers = providersIdx !== -1 ? args[providersIdx + 1].split(',') : null

  let catFiles = fs.readdirSync(PRODS_DIR).filter(f => f.endsWith('.json')).sort()
  // Apply slice: pick every sliceOf-th category starting at sliceN
  if (sliceOf > 1) catFiles = catFiles.filter((_, i) => i % sliceOf === sliceN)

  let allProducts = []

  for (const file of catFiles) {
    const slug = file.replace('.json', '')
    if (catFilter && slug !== catFilter) continue
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PRODS_DIR, file), 'utf8'))
      let prods = data.products || []
      if (asinFilter) prods = prods.filter(p => p.asin === asinFilter)
      if (topN) prods = prods.slice(0, topN)
      allProducts.push(...prods.map(p => ({ ...p, _catFile: path.join(PRODS_DIR, file), _catSlug: slug, _catData: data, _providers: providers })))
    } catch { /* skip invalid */ }
  }

  if (asinFilter) allProducts = allProducts.filter(p => p.asin === asinFilter)

  const pending = resume ? allProducts.filter(p => !p.reviews) : allProducts
  const preSkipped = allProducts.length - pending.length
  console.log(`Enriching ${pending.length} products (${preSkipped} already done) — concurrency=${concurrency}\n`)

  const catFileMap = new Map()
  let done = 0, failed = 0

  await runPool(pending, concurrency, async (product) => {
    const { _catFile, _catSlug, _catData, _providers, ...prod } = product

    console.log(`[${_catSlug}] ${prod.name?.slice(0, 50)} (${prod.asin})`)

    try {
      const enriched = await enrichProduct(prod, _providers || null)
      if (!enriched) { failed++; return }

      // catFileMap updates are safe: JS single-thread, no concurrent Map mutation
      if (!catFileMap.has(_catFile)) {
        catFileMap.set(_catFile, { ..._catData, products: [...(_catData.products || [])] })
      }
      const catData = catFileMap.get(_catFile)
      const idx = catData.products.findIndex(p => p.asin === prod.asin)
      if (idx >= 0) catData.products[idx] = enriched
      else catData.products.push(enriched)

      // Flush file after each product so partial progress survives a crash
      catData.enriched_at = new Date().toISOString()
      fs.writeFileSync(_catFile, JSON.stringify(catData, null, 2))

      const r = enriched.reviews
      const positiveRating = r?.top_positive?.rating ?? '-'
      const criticalRating = r?.top_critical?.rating ?? '-'
      console.log(`  ✓ ${prod.asin} sentiment=${r?.sentiment_score ?? 'n/a'} dist=${r?.star_distribution ? '✓' : '✗'} +${positiveRating}/-${criticalRating} issues=${r?.issues?.length || 0}`)
      done++
    } catch (e) {
      console.error(`  ✗ ${prod.asin}: ${e.message}`)
      failed++
    }

    await sleep(DELAY_MS)
  })

  console.log(`\n✓ Done. ${done} enriched, ${preSkipped} skipped, ${failed} failed.`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
