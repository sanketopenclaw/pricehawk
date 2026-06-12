// scripts/voice-lint.js
// Scans WP drafts (posts + pages) for DNA banned words / hype absolutes.
// Part of the pre-publish human gate. Usage: node scripts/voice-lint.js [--status draft|publish]
require('dotenv').config()
const { makeAuth } = require('./lib/wp')
const { voiceLint } = require('./lib/voice')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const AUTH = makeAuth(process.env.WORDPRESS_USERNAME, process.env.WORDPRESS_APP_PASSWORD)

async function fetchAll(type, status) {
  const items = []
  for (let page = 1; ; page++) {
    const res = await fetch(`${WP}/wp-json/wp/v2/${type}?status=${status}&per_page=100&page=${page}&context=edit`, {
      headers: AUTH,
    })
    if (res.status === 400) break // past last page
    if (!res.ok) throw new Error(`${type} fetch failed: ${res.status}`)
    const batch = await res.json()
    items.push(...batch)
    if (batch.length < 100) break
  }
  return items
}

async function main() {
  const args   = process.argv.slice(2)
  const status = args.includes('--status') ? args[args.indexOf('--status') + 1] : 'draft'

  let flagged = 0, clean = 0
  for (const type of ['posts', 'pages']) {
    const items = await fetchAll(type, status)
    console.log(`${type} (${status}): ${items.length}`)
    for (const item of items) {
      const text = `${item.title?.raw || ''} ${item.content?.raw || ''}`
      const hits = voiceLint(text)
      if (hits.length) {
        flagged++
        const counts = {}
        hits.forEach(h => { counts[h.match.toLowerCase()] = (counts[h.match.toLowerCase()] || 0) + 1 })
        console.log(`  ⚠ ${item.slug}: ${Object.entries(counts).map(([w, n]) => `${w}×${n}`).join(', ')}`)
      } else {
        clean++
      }
    }
  }
  console.log(`\nDone — ${clean} clean, ${flagged} flagged.`)
  if (flagged) process.exitCode = 1
}

main().catch(e => { console.error(e.message); process.exit(1) })
