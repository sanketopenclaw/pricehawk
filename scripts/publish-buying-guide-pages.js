/**
 * Publishes buying-guide pages (Comparison / Deals / PriceDrops) to WordPress.
 * Bundles CSS + data.js + shared.jsx + page JSX into self-contained WP HTML.
 *
 * Usage:
 *   node scripts/publish-buying-guide-pages.js            # publish all 3
 *   node scripts/publish-buying-guide-pages.js deals      # publish one
 *   node scripts/publish-buying-guide-pages.js --dry-run  # preview only
 */
require('dotenv').config()
const axios = require('axios')
const fs    = require('fs')
const path  = require('path')

const WP   = (process.env.WORDPRESS_URL || '').trim()
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD
const DRY  = process.argv.includes('--dry-run')
const FILTER = process.argv.slice(2).find(a => !a.startsWith('-'))

if (!DRY && (!WP || !USER || !PASS)) {
  console.error('Missing WP credentials in .env')
  process.exit(1)
}

const b64 = Buffer.from(`${USER}:${PASS}`).toString('base64')
const headers = { Authorization: `Basic ${b64}`, 'Content-Type': 'application/json' }

const SITE_DIR  = path.join(__dirname, '../public/site')
const GUIDE_DIR = path.join(__dirname, '../public/buying-guide')

function read(dir, name) {
  return fs.readFileSync(path.join(dir, name), 'utf8')
}

/* Extract content of first matching <tag ...>...</tag> */
function extractTag(html, tag, attr = '') {
  const re = new RegExp(`<${tag}[^>]*${attr}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = html.match(re)
  return m ? m[1].trim() : ''
}

/* Extract ALL matching blocks */
function extractAllTags(html, tag, attr = '') {
  const re = new RegExp(`<${tag}[^>]*${attr}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const results = []
  let m
  while ((m = re.exec(html)) !== null) results.push(m[1].trim())
  return results
}

/* Build self-contained WP HTML block */
function buildWpHtml({ pageStyle, inlineData, sharedJsx, pageJsx, rootId = 'ph-root' }) {
  const css = read(SITE_DIR, 'styles.css')
  const dataJs = read(SITE_DIR, 'data.js')

  const fullJsx = [sharedJsx, pageJsx].join('\n\n')
  const jsxPayload = JSON.stringify(fullJsx)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')

  const inlineDataBlock = inlineData
    ? `\n/* ── page-specific data ── */\n${inlineData}\n`
    : ''

  return `<!-- wp:html -->
<style>
/* hide WP theme chrome */
body{background:#0f0f0f!important}
.site-header,.site-footer,header.site-header,footer.site-footer,
#masthead,#colophon,.wp-block-template-part,.navigation,.post-navigation,
.entry-header,.entry-footer,.comments-area,.sidebar,#secondary{display:none!important}
.entry-content,.wp-block-post-content,.site-content,#content,.page-content,
.hentry,.wp-site-blocks{max-width:100%!important;margin:0!important;padding:0!important;background:#0f0f0f!important}
/* styles.css */
${css}
/* page styles */
${pageStyle}
</style>
<div id="${rootId}"></div>
<script>
(function(){
${dataJs}
${inlineDataBlock}
function ld(src,int,cb){var s=document.createElement('script');s.src=src;s.integrity=int;s.crossOrigin='anonymous';s.onload=cb;document.head.appendChild(s);}
ld('https://unpkg.com/react@18.3.1/umd/react.development.js','sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L',function(){
ld('https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js','sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm',function(){
ld('https://unpkg.com/@babel/standalone@7.29.0/babel.min.js','sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y',function(){
  var code=${jsxPayload};
  var xf=Babel.transform(code,{presets:['react']}).code;
  var s=document.createElement('script');s.textContent=xf;document.head.appendChild(s);
});});});
})();
</script>
<!-- /wp:html -->`
}

/* ── page builders ────────────────────────────────────────────────── */

function buildComparison() {
  const html = read(GUIDE_DIR, 'Comparison.html')
  const sharedJsx = read(SITE_DIR, 'shared.jsx')

  // page-specific <style>
  const styleBlocks = extractAllTags(html, 'style')
  const pageStyle = styleBlocks.slice(1).join('\n') // skip first (html,body reset)

  // window.CMP = {...} inline data block (plain <script>, not babel)
  const plainScripts = extractAllTags(html, 'script', '(?!type)')
    .filter(s => s.includes('window.CMP'))
  const inlineData = plainScripts[0] || ''

  // babel JSX block (the component code)
  const babelBlocks = extractAllTags(html, 'script', 'text\\/babel')
    .filter(s => !s.includes('src=')) // inline only (src="" ones already excluded by tag extraction)
  // last babel block = page components (first = shared.jsx loaded separately)
  const pageJsx = babelBlocks[babelBlocks.length - 1] || ''

  return buildWpHtml({ pageStyle, inlineData, sharedJsx, pageJsx,
    rootId: 'root' })
}

function buildDeals() {
  const html = read(GUIDE_DIR, 'Deals.html')
  const sharedJsx = read(SITE_DIR, 'shared.jsx')

  const styleBlocks = extractAllTags(html, 'style')
  const pageStyle = styleBlocks.slice(1).join('\n')

  const babelBlocks = extractAllTags(html, 'script', 'text\\/babel')
  const pageJsx = babelBlocks[babelBlocks.length - 1] || ''

  return buildWpHtml({ pageStyle, inlineData: '', sharedJsx, pageJsx, rootId: 'root' })
}

function buildPriceDrops() {
  const html = read(GUIDE_DIR, 'PriceDrops.html')
  const sharedJsx = read(SITE_DIR, 'shared.jsx')

  const styleBlocks = extractAllTags(html, 'style')
  const pageStyle = styleBlocks.slice(1).join('\n')

  const babelBlocks = extractAllTags(html, 'script', 'text\\/babel')
  const pageJsx = babelBlocks[babelBlocks.length - 1] || ''

  return buildWpHtml({ pageStyle, inlineData: '', sharedJsx, pageJsx, rootId: 'root' })
}

/* ── WP helpers ───────────────────────────────────────────────────── */

async function wpUpsert(slug, title, content) {
  // check posts first, then pages
  for (const postType of ['posts', 'pages']) {
    try {
      const res = await axios.get(`${WP}/wp-json/wp/v2/${postType}?slug=${slug}&per_page=1`, { headers })
      if (res.data && res.data.length > 0) {
        const id = res.data[0].id
        console.log(`  Found existing ${postType.slice(0,-1)} (id=${id}) — updating...`)
        const r = await axios.post(`${WP}/wp-json/wp/v2/${postType}/${id}`, { title, content, status: 'publish' }, { headers })
        return { type: postType, url: r.data.link }
      }
    } catch {}
  }
  // create as a post (won't appear in nav)
  console.log(`  No existing entry found — creating new post...`)
  const r = await axios.post(`${WP}/wp-json/wp/v2/posts`, { title, content, slug, status: 'draft' }, { headers })
  return { type: 'post (draft)', url: r.data.link }
}

/* ── page definitions ─────────────────────────────────────────────── */

const PAGES = [
  {
    key:   'comparison',
    slug:  'buying-guide-comparison',
    title: 'Philips Air Fryer vs AGARO Galaxy — Which Should You Buy? | PriceHawk',
    build: buildComparison,
  },
  {
    key:   'deals',
    slug:  'deals',
    title: "Today's Deals — Best Amazon India Price Drops | PriceHawk",
    build: buildDeals,
  },
  {
    key:   'price-drops',
    slug:  'price-drops',
    title: 'Price Drop Tracker — Amazon India Price Alerts | PriceHawk',
    build: buildPriceDrops,
  },
]

/* ── main ─────────────────────────────────────────────────────────── */

async function main() {
  const pages = FILTER
    ? PAGES.filter(p => p.key.includes(FILTER.toLowerCase()))
    : PAGES

  if (!pages.length) {
    console.error(`No pages matched "${FILTER}". Options: ${PAGES.map(p => p.key).join(', ')}`)
    process.exit(1)
  }

  for (const p of pages) {
    console.log(`\nBuilding: ${p.key}...`)
    let html
    try {
      html = p.build()
      console.log(`  Built ${Math.round(html.length / 1024)}KB`)
    } catch (e) {
      console.error(`  Build failed: ${e.message}`)
      continue
    }

    if (DRY) {
      const outPath = path.join(__dirname, `../tmp/dry-${p.key}.html`)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, html)
      console.log(`  [DRY RUN] wrote to ${outPath}`)
      continue
    }

    try {
      const result = await wpUpsert(p.slug, p.title, html)
      console.log(`  ✓ Published as ${result.type}: ${result.url}`)
    } catch (e) {
      console.error(`  ✗ WP push failed: ${e.response?.data?.message || e.message}`)
    }
  }

  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
