const { Router } = require('express')
const axios = require('axios')
const path = require('path')
const fs = require('fs')
const { marked } = require('marked')

const router = Router()

const PRICEHAWK_CONFIG = require(path.join(__dirname, '../config/pricehawk.json'))
const KPI_PATH = path.join(__dirname, '../data/kpi.json')
const DRAFTS_DIR = path.join(__dirname, '../data/drafts')

async function uploadImageToWordPress(imageUrl, filename, b64, wpUrl) {
  try {
    const u = new URL(imageUrl)
    if (u.hostname !== 'm.media-amazon.com') return null
  } catch { return null }
  try {
    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 })
    const contentType = imgRes.headers['content-type'] || 'image/jpeg'
    const upRes = await axios.post(
      `${wpUrl}/wp-json/wp/v2/media`,
      imgRes.data,
      {
        headers: {
          Authorization: `Basic ${b64}`,
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
      }
    )
    return upRes.data?.source_url || null
  } catch {
    return null
  }
}

async function getOrCreateCategory(b64, wpUrl, name) {
  try {
    const searchRes = await axios.get(
      `${wpUrl}/wp-json/wp/v2/categories?search=${encodeURIComponent(name)}`,
      { headers: { Authorization: `Basic ${b64}` } }
    )
    const results = searchRes.data
    if (results && results.length > 0) return results[0].id
    const createRes = await axios.post(
      `${wpUrl}/wp-json/wp/v2/categories`,
      { name },
      { headers: { Authorization: `Basic ${b64}`, 'Content-Type': 'application/json' } }
    )
    return createRes.data.id
  } catch {
    return undefined
  }
}

router.post('/publish', async (req, res) => {
  const { title, content, content_type, meta_description, schema, status = 'draft', tags = [] } = req.body

  if (!title) return res.status(400).json({ error: 'title is required' })
  if (!content) return res.status(400).json({ error: 'content is required' })

  const wpUrl = (process.env.WORDPRESS_URL || '').trim()
  const wpUser = process.env.WORDPRESS_USERNAME
  const wpPass = process.env.WORDPRESS_APP_PASSWORD

  if (!wpUrl || !wpUser || !wpPass) {
    return res.status(500).json({ error: 'WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD are all required' })
  }

  const b64 = Buffer.from(`${wpUser}:${wpPass}`).toString('base64')

  const rawHtml = marked(content)

  // Wrap in PriceHawk dark theme — matches the site design
  let htmlContent = `<!-- wp:html -->
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
body{background:#0f0f0f!important;color:#f0f0f0!important}
.site-header,.site-footer,header.site-header,footer.site-footer,
#masthead,#colophon,.wp-block-template-part,.navigation,.post-navigation,
.entry-header,.entry-footer,.comments-area,.sidebar,#secondary{display:none!important}
.entry-content,.wp-block-post-content,.site-content,#content,.page-content,
.hentry,.wp-site-blocks{max-width:100%!important;margin:0!important;padding:0!important;background:#0f0f0f!important}
.ph-blog{font-family:'Inter',system-ui,sans-serif;background:#0f0f0f;color:#f0f0f0;max-width:760px;margin:0 auto;padding:32px 24px 80px;-webkit-font-smoothing:antialiased;line-height:1.7}
.ph-blog *{box-sizing:border-box}
.ph-blog h1{font-size:clamp(26px,5vw,40px);font-weight:800;letter-spacing:-0.03em;line-height:1.1;margin:0 0 20px;color:#f0f0f0}
.ph-blog h2{font-size:22px;font-weight:800;color:#f0f0f0;margin:44px 0 16px;letter-spacing:-0.02em;padding-bottom:10px;border-bottom:1px solid #2a2a2a}
.ph-blog h3{font-size:17px;font-weight:700;color:#f0f0f0;margin:28px 0 10px;letter-spacing:-0.01em}
.ph-blog h4{font-size:15px;font-weight:600;color:#f0f0f0;margin:20px 0 8px}
.ph-blog p{color:#c0c0c0;margin:0 0 18px;font-size:15px}
.ph-blog a{color:#e67e22;text-decoration:none}
.ph-blog a:hover{color:#f08a30;text-decoration:underline}
.ph-blog strong{color:#f0f0f0;font-weight:600}
.ph-blog em{color:#888;font-style:italic}
.ph-blog ul,.ph-blog ol{margin:0 0 18px;padding-left:22px;color:#c0c0c0;font-size:15px}
.ph-blog li{margin-bottom:7px}
.ph-blog blockquote{border-left:3px solid #e67e22;background:#1a1a1a;border-radius:0 8px 8px 0;margin:24px 0;padding:18px 22px;font-size:15px;color:#c0c0c0}
.ph-blog blockquote p{margin:0;color:#c0c0c0}
.ph-blog table{width:100%;border-collapse:collapse;font-size:13px;margin:0 0 28px;background:#1a1a1a;border-radius:8px;overflow:hidden;border:1px solid #2a2a2a}
.ph-blog th{background:#111;color:#888;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:12px 14px;text-align:left;border-bottom:1px solid #2a2a2a}
.ph-blog td{padding:12px 14px;border-bottom:1px solid #1e1e1e;color:#f0f0f0;vertical-align:top}
.ph-blog tr:last-child td{border-bottom:none}
.ph-blog code{font-family:'JetBrains Mono',monospace;font-size:12px;background:#1e1e1e;color:#e67e22;padding:2px 6px;border-radius:4px}
.ph-blog pre{background:#141414;border:1px solid #2a2a2a;border-radius:8px;padding:18px;overflow-x:auto;margin:0 0 24px}
.ph-blog pre code{background:none;padding:0;color:#c0c0c0;font-size:13px}
.ph-blog hr{border:none;border-top:1px solid #2a2a2a;margin:36px 0}
.ph-blog img{max-width:100%;border-radius:8px;border:1px solid #2a2a2a}
.ph-disclosure{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:10px 14px;font-size:12px;color:#888;margin-bottom:28px}
</style>
<div class="ph-blog">
<div class="ph-disclosure">ⓘ PriceHawk earns a commission from affiliate links at no extra cost to you. Rankings are based on data — not commissions.</div>
${rawHtml}
</div>
<!-- /wp:html -->`

  // Upload any Amazon CDN images to WordPress media library
  const amazonImgRe = /https:\/\/m\.media-amazon\.com\/images\/I\/[\w\-.%]+\.(?:jpg|jpeg|png|webp)/gi
  const uniqueImgs = [...new Set(rawHtml.match(amazonImgRe) || [])]
  if (uniqueImgs.length > 0) {
    const uploads = await Promise.allSettled(
      uniqueImgs.map(url => uploadImageToWordPress(url, url.split('/').pop().split('?')[0], b64, wpUrl))
    )
    uploads.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        htmlContent = htmlContent.split(uniqueImgs[i]).join(r.value)
      }
    })
  }

  // schema ld+json injected inside the block (before closing tag)
  if (schema) {
    const safeJson = JSON.stringify(schema)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
    const schemaTag = `<script type="application/ld+json">${safeJson}</script>\n`
    htmlContent = htmlContent.replace('<!-- /wp:html -->', schemaTag + '<!-- /wp:html -->')
  }

  const categoryMap = PRICEHAWK_CONFIG.wordpress && PRICEHAWK_CONFIG.wordpress.categories
  const categoryName = content_type && categoryMap ? categoryMap[content_type] : undefined
  let categoryId
  if (categoryName) categoryId = await getOrCreateCategory(b64, wpUrl, categoryName)

  const safe_title = title.substring(0, 30).replace(/[^a-z0-9\-]/gi, '-').toLowerCase()

  try {
    const postRes = await axios.post(
      `${wpUrl}/wp-json/wp/v2/posts`,
      { title, content: htmlContent, status, excerpt: meta_description || '', categories: categoryId ? [categoryId] : [] },
      { headers: { Authorization: `Basic ${b64}`, 'Content-Type': 'application/json' } }
    )
    const post = postRes.data

    try {
      const kpi = JSON.parse(fs.readFileSync(KPI_PATH, 'utf8'))
      if (status === 'publish') kpi.articles_published = (kpi.articles_published || 0) + 1
      else kpi.articles_draft = (kpi.articles_draft || 0) + 1
      kpi.last_updated = new Date().toISOString()
      fs.writeFileSync(KPI_PATH, JSON.stringify(kpi, null, 2))
    } catch {}

    return res.json({ ok: true, post_id: post.id, url: post.link || post.url, status: post.status || status })
  } catch (err) {
    try {
      fs.mkdirSync(DRAFTS_DIR, { recursive: true })
      const filename = `${Date.now()}-${safe_title}.md`
      fs.writeFileSync(path.join(DRAFTS_DIR, filename), content)
      return res.status(500).json({ error: err.message, fallback_saved: true })
    } catch {
      return res.status(500).json({ error: err.message, fallback_saved: false })
    }
  }
})

router.get('/publish/status', (req, res) => {
  const wpUrl = (process.env.WORDPRESS_URL || '').trim()
  const wpUser = process.env.WORDPRESS_USERNAME
  const wpPass = process.env.WORDPRESS_APP_PASSWORD
  return res.json({ connected: !!(wpUrl && wpUser && wpPass), url: wpUrl || null })
})

module.exports = router
