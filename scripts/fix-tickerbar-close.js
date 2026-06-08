#!/usr/bin/env node
// Fix TickerBar outer close tag: </span> -> </a>
require('dotenv').config()
const axios = require('axios')
const path = require('path')
const { execFileSync } = require('child_process')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')

async function main() {
  const r = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  let c = r.data.content.raw

  const BS = '\\'
  const LT = BS + 'u003c'
  const GT = BS + 'u003e'
  const NL = '\\n'  // literal \n (2 chars) — WP stores JSX newlines as \\n not actual newline

  // The outer close span in TickerBar row.map — unique because PHTicker's is already /a
  const CLOSE_SPAN = LT + '/span' + GT + NL + '          ))}'
  const CLOSE_A    = LT + '/a'   + GT + NL + '          ))}'

  const count = c.split(CLOSE_SPAN).length - 1
  console.log('CLOSE_SPAN occurrences:', count)

  if (count === 0) {
    console.log('Not found — already fixed or different whitespace')
    // Debug: find all /a } and /span } patterns
    const idx1 = c.indexOf(CLOSE_A)
    console.log('CLOSE_A at:', idx1)
    return
  }

  if (count > 1) {
    console.log('Multiple CLOSE_SPAN found — only replacing first (TickerBar)')
  }

  c = c.replace(CLOSE_SPAN, CLOSE_A)
  console.log('Fixed TickerBar outer </span> -> </a>')

  try { execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' }) } catch(e) {}

  const res = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/12`,
    { content: c },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log('Pushed:', res.data.modified)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
