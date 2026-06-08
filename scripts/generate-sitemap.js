require('dotenv').config()
const fs = require('fs')
const path = require('path')

const QUEUE_FILE = path.join(__dirname, '../data/content/phase1_queue.json')
const OUT_DIR = path.join(__dirname, '../public')
const DOMAIN = 'https://pricehawk.in'
const TODAY = new Date().toISOString().split('T')[0]

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function resolveSlug(op) {
  if (op.type === 'review') {
    const brand = slugify(op.brand || 'product')
    return `review-${brand}-${(op.asin || '').toLowerCase()}`
  }
  if (op.type === 'comparison') {
    const asins = op.asins || []
    if (asins.length < 2) return null
    const [asin1, asin2] = asins
    return `compare-${asin1.toLowerCase()}-vs-${asin2.toLowerCase()}`
  }
  if (op.type === 'buying_guide') {
    const base = `best-${op.category}`
    if (op.subtype === 'budget') return `${base}-budget`
    if (op.use_case) return `${base}-${slugify(op.use_case)}`
    return base
  }
  if (op.type === 'category_page') {
    return `best-${op.category}`
  }
  if (op.type === 'brand_page') {
    // Category is already plural (e.g., "air-fryers"), no need to add 's'
    return `${slugify(op.brand)}-${op.category}`
  }
  // Skip other types (price_history, deal, etc.)
  return null
}

function priorityFor(type) {
  const priorities = {
    category_page: '1.0',
    buying_guide: '0.9',
    review: '0.8',
    brand_page: '0.7',
    comparison: '0.6'
  }
  return priorities[type] || '0.5'
}

function changefreqFor(type) {
  const freqs = {
    category_page: 'weekly',
    buying_guide: 'weekly',
    review: 'monthly',
    brand_page: 'monthly',
    comparison: 'monthly'
  }
  return freqs[type] || 'monthly'
}

function xmlUrl(loc, priority, changefreq) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

function main() {
  if (!fs.existsSync(QUEUE_FILE)) {
    console.error('Error: data/content/phase1_queue.json not found. Run content-opportunity-engine.js first.')
    process.exit(1)
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'))

  const seen = new Set()
  const urls = [
    `  <url>
    <loc>${DOMAIN}/</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`
  ]

  let skipped = 0
  for (const op of queue) {
    const slug = resolveSlug(op)
    if (!slug) {
      skipped++
      continue
    }
    if (seen.has(slug)) continue
    seen.add(slug)
    urls.push(xmlUrl(`${DOMAIN}/${slug}/`, priorityFor(op.type), changefreqFor(op.type)))
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
  }

  const outFile = path.join(OUT_DIR, 'sitemap.xml')
  fs.writeFileSync(outFile, xml)

  console.log(`✓ Sitemap written: ${outFile}`)
  console.log(`✓ Total URLs: ${urls.length} (${seen.size} unique slugs + homepage)`)
  console.log(`✓ Entries skipped (price_history, deal, etc.): ${skipped}`)
}

main()
