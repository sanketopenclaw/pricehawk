#!/usr/bin/env node
// Make ticker bar items clickable — add link field to data + change span→a in component
require('dotenv').config()
const axios = require('axios')
const path = require('path')
const { execFileSync } = require('child_process')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')
const TAG = 'pricehawkin-21'

// Known ASINs; use Amazon search for the rest
const TICKER_LINKS = {
  'boAt Airdopes 141':  `https://www.amazon.in/s?k=boAt+Airdopes+141&tag=${TAG}`,
  'Mi Air Purifier 4':  `https://www.amazon.in/dp/B0DNMMZR2Q?tag=${TAG}`,
  'Nord Buds 2':        `https://www.amazon.in/s?k=OnePlus+Nord+Buds+2&tag=${TAG}`,
  'Redmi Band 2':       `https://www.amazon.in/dp/B0DH2SPVZC?tag=${TAG}`,
  'Oral-B Vitality':    `https://www.amazon.in/dp/B0DFWC4XH9?tag=${TAG}`,
  'Crucial 480GB SSD':  `https://www.amazon.in/dp/B0B9BL9T4H?tag=${TAG}`,
  'Noise ColorFit':     `https://www.amazon.in/dp/B0CM3R74FJ?tag=${TAG}`,
  'AquaGuard Aura':     `https://www.amazon.in/s?k=AquaGuard+Aura+RO+UV&tag=${TAG}`,
}

async function main() {
  const get = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  let content = get.data.content.raw
  let fixes = 0

  // 1. Add link field to each ticker object
  for (const [name, link] of Object.entries(TICKER_LINKS)) {
    const nameStr = `"name": "${name}"`
    const idx = content.indexOf(nameStr)
    if (idx === -1) { console.log(`Ticker item not found: ${name}`); continue }

    const win = content.substring(idx, idx + 200)
    if (win.includes('"link"')) { console.log(`Already has link: ${name}`); continue }

    // Find closing } of this ticker object
    const objEnd = content.indexOf('}', idx + nameStr.length)
    const insertedLink = `,\n    "link": "${link}"`
    content = content.substring(0, objEnd) + insertedLink + content.substring(objEnd)
    console.log(`Added link [${name}]`)
    fixes++
  }

  // 2. Change TickerBar span→a for each ticker item
  // Find the span that wraps each ticker row item (in escaped unicode form in WP)
  // Pattern: <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 20px'...
  const OLD_OPEN = `\\u003cspan key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 20px', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap' }}\\u003e`
  const NEW_OPEN = `\\u003ca key={i} href={t.link || '#'} target="_blank" rel="nofollow" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 20px', fontFamily: 'var(--font-mono)', fontSize: 12, whiteSpace: 'nowrap', textDecoration: 'none', cursor: 'pointer' }}\\u003e`

  if (content.includes(OLD_OPEN)) {
    content = content.replace(OLD_OPEN, NEW_OPEN)
    console.log('Changed ticker item span → a (open tag)')
    fixes++

    // Now close: find the closing </span> right after the ticker item content
    // The ticker item ends with: </span>\n          ))}  — but there are nested spans inside
    // Strategy: find the NEW_OPEN position, then find the matching closing tag
    // The outer span has 3 child spans. We need the 4th closing span after the open.
    // Easier: replace the specific pattern — the closing span right before ))}
    const CLOSE_PATTERN = `\\u003c/span\\u003e\\n          ))}`
    const NEW_CLOSE = `\\u003c/a\\u003e\\n          ))}`
    if (content.includes(CLOSE_PATTERN)) {
      content = content.replace(CLOSE_PATTERN, NEW_CLOSE)
      console.log('Changed ticker item span → a (close tag)')
      fixes++
    } else {
      console.log('WARNING: close tag pattern not found — ticker items will have unclosed <a>')
    }
  } else {
    // Check if already converted
    if (content.includes(`\\u003ca key={i} href={t.link`)) {
      console.log('Ticker items already converted to <a>')
    } else {
      console.log('WARNING: OLD_OPEN pattern not found in content')
      // Debug: show the ticker-track section
      const ttIdx = content.indexOf('ticker-track')
      console.log('Ticker track snippet:', content.substring(ttIdx, ttIdx + 400))
    }
  }

  console.log(`\nTotal fixes: ${fixes}`)
  if (fixes === 0) { console.log('Nothing to push'); return }

  try { execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' }) } catch(e) {}

  const res = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log('Pushed:', res.data.modified)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
