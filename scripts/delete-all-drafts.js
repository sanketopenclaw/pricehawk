require('dotenv').config()
const axios = require('axios')

const WP_URL  = process.env.WORDPRESS_URL
const WP_USER = process.env.WORDPRESS_USERNAME
const WP_PASS = process.env.WORDPRESS_APP_PASSWORD
const AUTH    = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64')

const client = axios.create({
  baseURL: `${WP_URL}/wp-json/wp/v2`,
  headers: { Authorization: `Basic ${AUTH}` }
})

async function getAllDraftIds() {
  const ids = []
  let page = 1
  const perPage = 100

  while (true) {
    const res = await client.get('/pages', {
      params: { status: 'draft', per_page: perPage, page, _fields: 'id,slug', orderby: 'id', order: 'asc' }
    })
    const total = parseInt(res.headers['x-wp-total'] || '0')
    for (const p of res.data) ids.push({ id: p.id, slug: p.slug })
    console.log(`  Page ${page}: ${res.data.length} drafts (${ids.length}/${total} total)`)
    if (ids.length >= total || res.data.length === 0) break
    page++
  }
  return ids
}

async function main() {
  console.log('Fetching all WP draft pages...\n')
  const drafts = await getAllDraftIds()
  console.log(`\nFound ${drafts.length} drafts. Deleting...\n`)

  let deleted = 0
  let failed  = 0

  for (const { id, slug } of drafts) {
    try {
      await client.delete(`/pages/${id}`, { params: { force: true } })
      deleted++
      if (deleted % 25 === 0 || deleted === drafts.length) {
        console.log(`  [${deleted}/${drafts.length}] deleted`)
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message
      console.error(`  FAIL id=${id} slug=${slug}: ${msg}`)
      failed++
    }
  }

  console.log(`\nDone — deleted: ${deleted}  failed: ${failed}`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
