// scripts/lib/wp.js
const axios = require('axios')

function makeAuth(user, pass) {
  return {
    Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`,
    'Content-Type': 'application/json',
  }
}

async function wpFindPage(slug, { wp, auth, postType = 'pages' }) {
  try {
    const r = await axios.get(
      `${wp}/wp-json/wp/v2/${postType}?slug=${slug}&per_page=1&status=draft,publish,private`,
      { headers: auth }
    )
    return r.data?.[0] || null
  } catch { return null }
}

async function wpUpsertPage({ title, slug, content }, { wp, auth, dryRun, metaDesc, focusKw, postType = 'pages', categories = [], featuredMediaId = null }) {
  if (dryRun) { console.log(`    [dry] ${slug}`); return null }
  const existing = await wpFindPage(slug, { wp, auth, postType })
  const meta = {}
  if (metaDesc) meta._yoast_wpseo_metadesc = metaDesc
  if (focusKw)  meta._yoast_wpseo_focuskw  = focusKw
  const payload = {
    title, content, slug, status: 'draft', comment_status: 'closed',
    excerpt: metaDesc || '',
    meta,
    ...(featuredMediaId ? { featured_media: featuredMediaId } : {}),
    ...(postType === 'posts' && categories.length ? { categories } : {}),
  }
  try {
    if (existing) {
      const r = await axios.post(`${wp}/wp-json/wp/v2/${postType}/${existing.id}`, payload, { headers: auth })
      return { action: 'updated', id: r.data.id, link: r.data.link }
    } else {
      const r = await axios.post(`${wp}/wp-json/wp/v2/${postType}`, payload, { headers: auth })
      return { action: 'created', id: r.data.id, link: r.data.link }
    }
  } catch (e) {
    throw new Error(e.response?.data?.message || e.message)
  }
}

module.exports = { makeAuth, wpFindPage, wpUpsertPage }
