#!/usr/bin/env node
// restore-version.js — restore WP page 12 to a saved snapshot
// Usage:
//   node restore-version.js --list
//   node restore-version.js --version page12-2026-06-08_03-51.json
//   node restore-version.js --baseline        # restore the locked BASELINE
require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')
const VERSIONS_DIR = path.join(__dirname, 'versions')

const args = process.argv.slice(2)
const IS_LIST = args.includes('--list')
const IS_BASELINE = args.includes('--baseline')
const versionArg = args[args.indexOf('--version') + 1]

function listVersions() {
  const files = fs.readdirSync(VERSIONS_DIR)
    .filter(f => f.match(/^page12-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/))
    .sort().reverse()
  const baselinePath = path.join(VERSIONS_DIR, 'BASELINE.json')
  const baselineHash = fs.existsSync(baselinePath)
    ? JSON.parse(fs.readFileSync(baselinePath)).hash
    : null

  console.log(`\nAvailable versions:`)
  files.forEach((f, i) => {
    const meta = JSON.parse(fs.readFileSync(path.join(VERSIONS_DIR, f)))
    const tag = meta.hash === baselineHash ? ' *** BASELINE ***' : ''
    console.log(`  [${i}] ${f}  len=${meta.length}  ${meta.wpModified}${tag}`)
  })
  return files
}

async function confirm(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(`${msg} (yes/no): `, ans => { rl.close(); resolve(ans.trim().toLowerCase() === 'yes') })
  })
}

async function saveCurrentBeforeRestore() {
  const { execFileSync } = require('child_process')
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' })
  } catch (e) {
    console.warn('Warning: could not auto-backup current state:', e.message)
  }
}

async function push(content) {
  const res = await axios.post(
    `${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log(`Pushed. Status: ${res.data.status}, Modified: ${res.data.modified}`)
}

async function main() {
  if (IS_LIST) { listVersions(); return }

  let targetFile
  if (IS_BASELINE) {
    targetFile = path.join(VERSIONS_DIR, 'BASELINE.json')
    if (!fs.existsSync(targetFile)) {
      console.error('No BASELINE set. Run: node save-version.js --baseline')
      process.exit(1)
    }
    console.log('Restoring BASELINE (locked version)')
  } else if (versionArg) {
    targetFile = path.join(VERSIONS_DIR, versionArg)
    if (!fs.existsSync(targetFile)) {
      console.error(`Version file not found: ${versionArg}`)
      listVersions()
      process.exit(1)
    }
  } else {
    const files = listVersions()
    console.error('\nSpecify: --baseline  OR  --version <filename>')
    process.exit(1)
  }

  const snapshot = JSON.parse(fs.readFileSync(targetFile))
  console.log(`\nTarget: ${snapshot.ts}  len=${snapshot.length}  modified=${snapshot.wpModified}`)
  console.log(`Hash: ${snapshot.hash.substring(0, 16)}...`)

  const ok = await confirm('\n⚠️  This will OVERWRITE the live WP page 12. Proceed?')
  if (!ok) { console.log('Aborted.'); return }

  console.log('\nAuto-saving current WP state before restore...')
  await saveCurrentBeforeRestore()

  console.log('\nPushing restore...')
  await push(snapshot.content)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
