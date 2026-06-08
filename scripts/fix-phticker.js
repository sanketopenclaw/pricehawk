#!/usr/bin/env node
// Fix PHTicker function: the broken <a> tag has wrong var (t.link -> x.link) + unescaped quotes
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

  const BS = '\\'
  const LT = BS + 'u003c'
  const GT = BS + 'u003e'
  const ESC_DQ = BS + '"'
  const NL = '\n'

  // The broken <a> in PHTicker — uses unescaped " and wrong var t.link (t is the array)
  const BROKEN = LT + `a key={i} href={t.link || '#'} target="_blank" rel="nofollow" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 20px', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap', textDecoration: 'none', cursor: 'pointer' }}` + GT

  // Correct: use x.link (x is the loop item in PHTicker), escaped quotes
  const FIXED = LT + `a key={i} href={x.link || '#'} target=` + ESC_DQ + `_blank` + ESC_DQ + ` rel=` + ESC_DQ + `nofollow` + ESC_DQ + ` style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 20px', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap', textDecoration: 'none', cursor: 'pointer' }}` + GT

  const CLOSE_A = LT + `/a` + GT + NL + `          ))}`
  const CLOSE_SPAN = LT + `/span` + GT + NL + `          ))}`

  console.log('BROKEN found:', content.includes(BROKEN))

  let fixes = 0
  if (content.includes(BROKEN)) {
    content = content.replace(BROKEN, FIXED)
    console.log('Fixed PHTicker <a>: x.link + escaped quotes')
    fixes++
    // Check close tag
    if (content.includes(CLOSE_SPAN)) {
      content = content.replace(CLOSE_SPAN, CLOSE_A)
      console.log('Fixed PHTicker close /span -> /a')
      fixes++
    } else if (content.includes(CLOSE_A)) {
      console.log('Close tag already /a - ok')
    }
  } else {
    console.log('Broken pattern not found')
    // Diagnose
    const idx = content.indexOf('function PHTicker')
    const mapIdx = content.indexOf('row.map', idx)
    console.log('PHTicker row.map area:', JSON.stringify(content.substring(mapIdx, mapIdx+300)))
  }

  console.log(`\nFixes: ${fixes}`)
  if (fixes === 0) { console.log('Nothing to push'); return }

  try { execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' }) } catch(e) {}

  const res = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log('Pushed:', res.data.modified)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
