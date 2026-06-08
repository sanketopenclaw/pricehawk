/**
 * Publishes all PriceHawk design pages to WordPress.
 * Run: node scripts/publish-all-pages-to-wp.js
 *
 * Pages published:
 *   homepage     → / (set as WP front page)
 *   buying-guide → /buying-guide/
 *   comparison   → /comparison/
 *   deals        → /deals/
 *   price-drops  → /price-drops/   (update if already exists)
 *   categories   → /categories/
 *   search-ph    → /search-ph/
 *   about        → /about/
 *   contact      → /contact/
 *   privacy-policy → /privacy-policy/
 *   terms-of-service → /terms-of-service/
 *   earbuds      → /earbuds/        (sample category page)
 */
require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD

if (!WP || !USER || !PASS) { console.error('Missing WP credentials in .env'); process.exit(1) }

const b64     = Buffer.from(`${USER}:${PASS}`).toString('base64')
const headers = { Authorization: `Basic ${b64}`, 'Content-Type': 'application/json' }
const SITE    = path.join(__dirname, '../public/site')

// ─── SRI hashes from the original design bundle ──────────────────────────────
const REACT_SRI    = 'sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L'
const REACTDOM_SRI = 'sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm'
const BABEL_SRI    = 'sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y'

// ─── href rewrite: .html filenames → WP slugs ────────────────────────────────
const HREF_MAP = {
  'index.html':            '/',
  'Buying Guide.html':     '/buying-guide/',
  'Comparison.html':       '/comparison/',
  'Deals.html':            '/deals/',
  'PriceDrops.html':       '/price-drops/',
  'Categories.html':       '/categories/',
  'Category.html':         '/earbuds/',
  'Search.html':           '/search-ph/',
  'About.html':            '/about/',
  'Contact.html':          '/contact/',
  'Privacy.html':          '/privacy-policy/',
  'Terms.html':            '/terms-of-service/',
  'Editorial.html':        '/editorial-policy/',
}

function read(name) { return fs.readFileSync(path.join(SITE, name), 'utf8') }

function patchHrefs(code) {
  let out = code
  for (const [from, to] of Object.entries(HREF_MAP)) {
    // match href="X.html" or href='X.html' — handle spaces in filename
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`(href=["'])${escaped}(["'])`, 'g'), `$1${to}$2`)
  }
  return out
}

// ─── Build Gutenberg <!-- wp:html --> block ───────────────────────────────────
function buildBlock(jsxSource) {
  const css    = read('styles.css')
  const dataJs = read('data.js')

  // Patch nav links, then safely embed as JSON string (escaping < > so </script> never fires)
  const patched = patchHrefs(jsxSource)
  const payload = JSON.stringify(patched)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')

  return `<!-- wp:html {"align":"full"} -->
<style>
body{background:#0f0f0f!important}
.site-header,.site-footer,header.site-header,footer.site-footer,
#masthead,#colophon,.wp-block-template-part,.navigation,.post-navigation,
.entry-header,.entry-footer,.comments-area,.sidebar,#secondary,
.wp-block-post-title{display:none!important}
.entry-content,.wp-block-post-content,.site-content,#content,.page-content,
.hentry,.wp-site-blocks{max-width:100%!important;margin:0!important;padding:0!important;background:#0f0f0f!important}
main.wp-block-group,main.wp-block-group-is-layout-constrained{margin-top:0!important;padding-top:0!important}
.wp-block-group.has-global-padding,.wp-block-group.is-layout-constrained{padding-top:0!important;margin-top:0!important}
.wp-block-html,.wp-block-html.alignfull,#ph-root{max-width:100%!important;width:100%!important}
.entry-content.has-global-padding>*,.is-layout-constrained>*,.entry-content>*{max-width:none!important}
.has-global-padding>*{max-width:none!important;--wp--style--global--content-size:100%!important;--wp--style--global--wide-size:100%!important}
${css}
</style>
<div id="ph-root" style="max-width:100%;width:100%"></div>
<script>
(function(){
${dataJs}
function ld(src,int,cb){var s=document.createElement('script');s.src=src;s.integrity=int;s.crossOrigin='anonymous';s.onload=cb;document.head.appendChild(s);}
ld('https://unpkg.com/react@18.3.1/umd/react.development.js','${REACT_SRI}',function(){
ld('https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js','${REACTDOM_SRI}',function(){
ld('https://unpkg.com/@babel/standalone@7.29.0/babel.min.js','${BABEL_SRI}',function(){
  var code=${payload};
  var xf=Babel.transform(code,{presets:['react']}).code;
  var s=document.createElement('script');s.textContent=xf;document.head.appendChild(s);
});});});
})();
</script>
<!-- /wp:html -->`
}

// ─── JSX bundles per page ─────────────────────────────────────────────────────
// Each entry: { shared, extra[], render }
// shared.jsx is always included first.
// render = the ReactDOM.createRoot call.

function buildPageJsx(extraFiles, renderCall) {
  const shared = read('shared.jsx')
  const extras = extraFiles.map(f => read(f)).join('\n')
  return `${shared}\n${extras}\n${renderCall}`
}

const PAGES = [
  {
    slug:    'homepage',       // handled specially — set as WP front page
    title:   'PriceHawk — Best Deals & Price Drops in India',
    jsx:     () => buildPageJsx(
      ['home-terminal.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(PHTerminal));'
    ),
  },
  {
    slug:    'buying-guide',
    title:   'Buying Guide — PriceHawk',
    jsx:     () => buildPageJsx(
      ['guide.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(BuyingGuide));'
    ),
  },
  {
    slug:    'comparison',
    title:   'Comparison — PriceHawk',
    jsx:     () => buildPageJsx(
      ['comparison.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(Comparison));'
    ),
  },
  {
    slug:    'deals',
    title:   'Today\'s Deals — PriceHawk',
    jsx:     () => buildPageJsx(
      ['deals.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(DealsPage));'
    ),
  },
  {
    slug:    'price-drops',
    title:   'Price Drops — PriceHawk',
    jsx:     () => buildPageJsx(
      ['tools.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(PriceDropsPage));'
    ),
  },
  {
    slug:    'categories',
    title:   'Categories — PriceHawk',
    jsx:     () => buildPageJsx(
      ['pages.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(CategoriesPage));'
    ),
  },
  {
    slug:    'search-ph',
    title:   'Search — PriceHawk',
    jsx:     () => buildPageJsx(
      ['tools.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(SearchPage));'
    ),
  },
  {
    slug:    'about',
    title:   'About — PriceHawk',
    jsx:     () => buildPageJsx(
      ['pages.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(AboutPage));'
    ),
  },
  {
    slug:    'contact',
    title:   'Contact — PriceHawk',
    jsx:     () => buildPageJsx(
      ['pages.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(ContactPage));'
    ),
  },
  {
    slug:    'privacy-policy',
    title:   'Privacy Policy — PriceHawk',
    jsx:     () => buildPageJsx(
      ['legal.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(LegalPage, {docKey:"privacy"}));'
    ),
  },
  {
    slug:    'terms-of-service',
    title:   'Terms of Service — PriceHawk',
    jsx:     () => buildPageJsx(
      ['legal.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(LegalPage, {docKey:"terms"}));'
    ),
  },
  {
    slug:    'earbuds',
    title:   'Best Earbuds in India — PriceHawk',
    jsx:     () => buildPageJsx(
      ['category.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(CategoryPage));'
    ),
  },
  {
    slug:    'editorial-policy',
    title:   'Editorial Policy — PriceHawk',
    jsx:     () => buildPageJsx(
      ['pages.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(EditorialPolicyPage));'
    ),
  },
  {
    slug:    'boat-airdopes-141-review',
    title:   'boAt Airdopes 141 Review — PriceHawk',
    jsx:     () => buildPageJsx(
      ['review.jsx'],
      'ReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(ReviewPage));'
    ),
  },
]

// ─── WordPress helpers ────────────────────────────────────────────────────────

async function getOrCreatePage(slug, title, content) {
  // search existing pages by slug
  let existing = []
  try {
    const r = await axios.get(`${WP}/wp-json/wp/v2/pages`, {
      headers,
      params: { slug, per_page: 1 },
    })
    existing = r.data
  } catch {}

  if (existing.length > 0) {
    const id = existing[0].id
    console.log(`  → Updating page #${id} (${slug})`)
    const r = await axios.post(`${WP}/wp-json/wp/v2/pages/${id}`, { title, content, status: 'publish' }, { headers })
    return r.data
  }

  console.log(`  → Creating page (${slug})`)
  const r = await axios.post(`${WP}/wp-json/wp/v2/pages`, { title, content, slug, status: 'publish' }, { headers })
  return r.data
}

async function setFrontPage(pageId) {
  // reading_settings requires WP 5.5+ and the user must have manage_options capability
  try {
    await axios.post(`${WP}/wp-json/wp/v2/settings`, {
      show_on_front: 'page',
      page_on_front: pageId,
    }, { headers })
    console.log(`  → Set as WordPress front page (id ${pageId})`)
  } catch (e) {
    console.warn(`  ⚠ Could not set front page via API: ${e.response?.data?.message || e.message}`)
    console.warn(`    Set manually: WP Admin → Settings → Reading → "A static page" → Homepage: <your new page>`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Publishing ${PAGES.length} PriceHawk pages to ${WP}\n`)

  let homepageId = null

  for (const page of PAGES) {
    console.log(`\n[${page.slug}]`)

    let jsxSource
    try {
      jsxSource = page.jsx()
    } catch (e) {
      console.error(`  ✗ Failed to build JSX: ${e.message}`)
      continue
    }

    const content = buildBlock(jsxSource)

    // Homepage goes to slug '' (blank = root) so WP recognises it, but we
    // query/create it with a meaningful slug first, then set as front page.
    const wpSlug = page.slug === 'homepage' ? 'ph-home' : page.slug

    try {
      const result = await getOrCreatePage(wpSlug, page.title, content)
      console.log(`  ✓ ${result.link}`)
      if (page.slug === 'homepage') homepageId = result.id
    } catch (e) {
      console.error(`  ✗ WP error: ${e.response?.data?.message || e.message}`)
      if (e.response?.data) console.error('    ', JSON.stringify(e.response.data).slice(0, 200))
    }
  }

  // Set homepage as WP front page
  if (homepageId) {
    console.log('\n[front-page]')
    await setFrontPage(homepageId)
  }

  console.log('\n✓ All pages published.')
  console.log(`  Preview: ${WP}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
