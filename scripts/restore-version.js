#!/usr/bin/env node
// Restores WP page 12 from a version backup file
// Usage: node scripts/restore-version.js <version-file>
require('dotenv').config()
const axios = require('axios')
const fs = require('fs')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')

async function main() {
  const file = process.argv[2]
  if (!file) { console.error('Usage: node restore-version.js <version-file>'); process.exit(1) }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const content = data.content?.raw || data.content
  if (!content) { console.error('No content.raw in version file'); process.exit(1) }
  console.log(`Restoring ${content.length} chars from ${file}...`)
  const res = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log('Restored. Modified:', res.data.modified)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
