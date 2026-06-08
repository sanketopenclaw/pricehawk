#!/usr/bin/env node
// save-version.js — snapshot WP page 12 content to versions/
// Usage:
//   node save-version.js              # save timestamped snapshot
//   node save-version.js --baseline   # also write/overwrite BASELINE (locked version)
//   node save-version.js --list       # list all versions
require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')
const VERSIONS_DIR = path.join(__dirname, 'versions')

const args = process.argv.slice(2)
const IS_BASELINE = args.includes('--baseline')
const IS_LIST = args.includes('--list')

function listVersions() {
  const files = fs.readdirSync(VERSIONS_DIR)
    .filter(f => f.match(/^page12-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/))
    .sort().reverse()

  const baseline = path.join(VERSIONS_DIR, 'BASELINE.json')
  const baselineHash = fs.existsSync(baseline)
    ? JSON.parse(fs.readFileSync(baseline)).hash
    : null

  console.log(`\nVersions (${files.length} total):`)
  for (const f of files) {
    const meta = JSON.parse(fs.readFileSync(path.join(VERSIONS_DIR, f)))
    const isBase = meta.hash === baselineHash ? ' *** BASELINE ***' : ''
    console.log(`  ${f}  len=${meta.length}  modified=${meta.wpModified}${isBase}`)
  }
  if (baselineHash) {
    console.log(`\nBaseline hash: ${baselineHash.substring(0, 12)}...`)
  } else {
    console.log('\nNo BASELINE set. Run with --baseline to lock current version.')
  }
}

async function main() {
  if (IS_LIST) { listVersions(); return }

  const res = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  const content = res.data.content.raw
  const hash = crypto.createHash('sha256').update(content).digest('hex')
  const wpModified = res.data.modified

  const now = new Date()
  const ts = now.toISOString().replace(/T/, '_').replace(/:/g, '-').substring(0, 16)
  const snapshot = { ts, wpModified, length: content.length, hash, content }

  const filename = `page12-${ts}.json`
  const filepath = path.join(VERSIONS_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(snapshot, null, 2))
  console.log(`Saved: versions/${filename}  (${content.length} chars, hash: ${hash.substring(0,12)}...)`)

  if (IS_BASELINE) {
    const baselinePath = path.join(VERSIONS_DIR, 'BASELINE.json')
    fs.writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2))
    console.log(`BASELINE updated → versions/BASELINE.json`)
    console.log(`This version is now LOCKED. Do not overwrite without human approval.`)
  }

  listVersions()
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
