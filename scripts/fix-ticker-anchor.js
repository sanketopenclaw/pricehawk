#!/usr/bin/env node
// Fix TickerBar: change <span> -> <a> with properly escaped double-quotes
// WP stores JSX inside a JS string literal, so " inside JSX attrs must be \"
require('dotenv').config()
const axios = require('axios')
const path = require('path')
const { execFileSync } = require('child_process')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')

async function main() {
  const get = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  let content = get.data.content.raw

  // Show exact bytes around the ticker item row to diagnose
  const tbIdx = content.indexOf('function TickerBar')
  const rowArea = content.substring(tbIdx + 550, tbIdx + 950)
  console.log('Current row area (raw):\n' + rowArea + '\n')
  console.log('JSON encoded:\n' + JSON.stringify(rowArea) + '\n')

  let fixes = 0

  // The original span (as 6-char < sequences in actual string)
  const BS = '\\'  // single backslash char
  const LT = BS + 'u003c'   // <  (6 chars)
  const GT = BS + 'u003e'   // >  (6 chars)
  const ESC_DQ = BS + '"'   // \"  (2 chars - escaped double quote in JS string)
  const NL = '\n'

  const ORIG_SPAN_OPEN = LT + `span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 20px', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}` + GT

  // New <a> open with properly escaped double quotes (\"_blank\" and \"nofollow\")
  const NEW_A_OPEN = LT + `a key={i} href={t.link || '#'} target=` + ESC_DQ + `_blank` + ESC_DQ + ` rel=` + ESC_DQ + `nofollow` + ESC_DQ + ` style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 20px', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap', textDecoration: 'none', cursor: 'pointer' }}` + GT

  const ORIG_SPAN_CLOSE = LT + `/span` + GT + NL + `          ))}`
  const NEW_A_CLOSE = LT + `/a` + GT + NL + `          ))}`

  // Also handle the broken version that may have been previously pushed (with unescaped ")
  const BROKEN_A_OPEN = LT + `a key={i} href={t.link || '#'} target="_blank" rel="nofollow" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 20px', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap', textDecoration: 'none', cursor: 'pointer' }}` + GT

  console.log('Looking for ORIG_SPAN:', content.includes(ORIG_SPAN_OPEN) ? 'FOUND' : 'not found')
  console.log('Looking for BROKEN_A:', content.includes(BROKEN_A_OPEN) ? 'FOUND' : 'not found')

  if (content.includes(ORIG_SPAN_OPEN)) {
    content = content.replace(ORIG_SPAN_OPEN, NEW_A_OPEN)
    console.log('Changed span -> <a> (correctly escaped)')
    fixes++
    if (content.includes(ORIG_SPAN_CLOSE)) {
      content = content.replace(ORIG_SPAN_CLOSE, NEW_A_CLOSE)
      console.log('Changed /span -> /a close tag')
      fixes++
    }
  } else if (content.includes(BROKEN_A_OPEN)) {
    content = content.replace(BROKEN_A_OPEN, NEW_A_OPEN)
    console.log('Fixed broken <a> -> correctly escaped <a>')
    fixes++
  } else {
    console.log('Neither pattern found')
    // Check what open tag exists around row.map
    const mapIdx = content.indexOf('row.map')
    if (mapIdx > -1) {
      console.log('row.map area (JSON):', JSON.stringify(content.substring(mapIdx, mapIdx + 400)))
    }
    return
  }

  console.log(`\nFixes: ${fixes}`)

  try { execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' }) } catch(e) {}

  const res = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log('Pushed:', res.data.modified)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
