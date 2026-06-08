#!/usr/bin/env node
// Fix ticker data: rewrite the entire ticker array with correct links
// The previous insertions left some items without links (boAt, Mi AP4)
// and others with awkward formatting. Rewrite cleanly.
require('dotenv').config()
const axios = require('axios')
const path = require('path')
const { execFileSync } = require('child_process')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')
const TAG = 'pricehawkin-21'

// Complete ticker data with correct links
const TICKER_DATA = `const ticker = [
  {
    "name": "boAt Airdopes 141",
    "now": 999,
    "dir": "down",
    "delta": 12,
    "link": "https://www.amazon.in/s?k=boAt+Airdopes+141&tag=${TAG}"
  },
  {
    "name": "Mi Air Purifier 4",
    "now": 8987,
    "dir": "down",
    "delta": 18,
    "link": "https://www.amazon.in/dp/B0DNMMZR2Q?tag=${TAG}"
  },
  {
    "name": "Nord Buds 2",
    "now": 1099,
    "dir": "down",
    "delta": 15,
    "link": "https://www.amazon.in/s?k=OnePlus+Nord+Buds+2&tag=${TAG}"
  },
  {
    "name": "Redmi Band 2",
    "now": 2690,
    "dir": "down",
    "delta": 9,
    "link": "https://www.amazon.in/dp/B0DH2SPVZC?tag=${TAG}"
  },
  {
    "name": "Oral-B Vitality",
    "now": 1359,
    "dir": "down",
    "delta": 23,
    "link": "https://www.amazon.in/dp/B0DFWC4XH9?tag=${TAG}"
  },
  {
    "name": "Crucial 480GB SSD",
    "now": 8449,
    "dir": "down",
    "delta": 14,
    "link": "https://www.amazon.in/dp/B0B9BL9T4H?tag=${TAG}"
  },
  {
    "name": "Noise ColorFit",
    "now": 1499,
    "dir": "down",
    "delta": 25,
    "link": "https://www.amazon.in/dp/B0CM3R74FJ?tag=${TAG}"
  },
  {
    "name": "AquaGuard Aura",
    "now": 9490,
    "dir": "down",
    "delta": 21,
    "link": "https://www.amazon.in/s?k=AquaGuard+Aura+RO+UV&tag=${TAG}"
  }
]`

async function main() {
  const r = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  let c = r.data.content.raw

  // Find the current ticker array (from 'const ticker = [' to first '];')
  const start = c.indexOf('const ticker = [')
  if (start === -1) { console.log('ERROR: ticker array not found'); return }

  const end = c.indexOf('];', start) + 2
  console.log('Ticker array: chars', start, '-', end, '(', end - start, 'chars)')

  const old = c.substring(start, end)
  console.log('Old ticker preview:', old.substring(0, 100))

  c = c.substring(0, start) + TICKER_DATA + c.substring(end)
  console.log('Replaced ticker array')

  try { execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' }) } catch(e) {}

  const res = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/12`,
    { content: c },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log('Pushed:', res.data.modified)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
