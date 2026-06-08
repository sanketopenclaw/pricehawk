// scripts/push-page.js
// Usage: node scripts/push-page.js --slug <slug> --title "<title>" --file tmp/draft.html
require('dotenv').config()
const fs = require('fs')
const { makeAuth, wpUpsertPage } = require('./lib/wp')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD
const AUTH = makeAuth(USER, PASS)

async function main() {
  const args  = process.argv.slice(2)
  const slug  = args.includes('--slug')  ? args[args.indexOf('--slug')  + 1] : null
  const title = args.includes('--title') ? args[args.indexOf('--title') + 1] : null
  const file  = args.includes('--file')  ? args[args.indexOf('--file')  + 1] : null

  if (!slug || !title || !file) {
    console.error('Usage: node scripts/push-page.js --slug <slug> --title "<title>" --file <html-file>')
    process.exit(1)
  }
  if (!fs.existsSync(file)) { console.error(`File not found: ${file}`); process.exit(1) }
  if (!WP || !USER || !PASS) { console.error('Missing WP credentials in .env'); process.exit(1) }

  const content = fs.readFileSync(file, 'utf8')
  const result  = await wpUpsertPage({ title, slug, content }, { wp: WP, auth: AUTH, dryRun: false })
  if (result) {
    console.log(`✓ [${result.action}] ID ${result.id}`)
    console.log(`  Draft: ${result.link}`)
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
