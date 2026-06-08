require('dotenv').config()
const fs   = require('fs')
const path = require('path')
const axios = require('axios')
const { execFileSync } = require('child_process')

const WP_URL  = process.env.WORDPRESS_URL
const AUTH    = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')

function autoBackup() {
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' })
  } catch (e) {
    console.warn('Warning: auto-backup failed:', e.message)
  }
}

async function main() {
  console.log('Auto-saving current WP page 12 before patch...')
  autoBackup()

  const content = fs.readFileSync(path.join(__dirname, '../../tmp/ph-home-patched.html'), 'utf8')
  console.log(`\nContent length: ${content.length}`)

  const res = await axios.post(
    `${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log(`Updated. Status: ${res.data.status}, Modified: ${res.data.modified}`)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
