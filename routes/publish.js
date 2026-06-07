const { Router } = require('express')
const axios = require('axios')
const path = require('path')
const fs = require('fs')
const { marked } = require('marked')

const router = Router()

const PRICEHAWK_CONFIG = require(path.join(__dirname, '../config/pricehawk.json'))
const KPI_PATH = path.join(__dirname, '../data/kpi.json')
const DRAFTS_DIR = path.join(__dirname, '../data/drafts')

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
  let htmlContent = marked(content)

  if (schema) {
    const safeJson = JSON.stringify(schema)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
    htmlContent = `<script type="application/ld+json">${safeJson}</script>\n` + htmlContent
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
