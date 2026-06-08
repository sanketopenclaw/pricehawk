require('dotenv').config()
const axios = require('axios')

const WP_URL  = process.env.WORDPRESS_URL
const AUTH    = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')

// Correct id → image URL (from get-homepage-images.js scrape)
const CORRECT_IMAGES = {
  'boat-141':   'https://m.media-amazon.com/images/I/318-p4IpH6L._SY300_SX300_QL70_FMwebp_.jpg',
  'noise-104':  'https://m.media-amazon.com/images/I/31QBO-5y5VL._SY300_SX300_QL70_FMwebp_.jpg',
  'nord-2':     'https://m.media-amazon.com/images/I/31gtxHHEj9L._SY300_SX300_QL70_FMwebp_.jpg',
  'realme-air5':'https://m.media-amazon.com/images/I/318Kh76jB0L._SY300_SX300_QL70_FMwebp_.jpg',
  'cmf-buds':   'https://m.media-amazon.com/images/I/31X9btHWheL._SY300_SX300_QL70_FMwebp_.jpg',
  'jbl-wave':   'https://m.media-amazon.com/images/I/31mr0ORTf5L._SY300_SX300_QL70_FMwebp_.jpg',
  'mi-band':    'https://m.media-amazon.com/images/I/41gggAvZQ1L._SY300_SX300_QL70_FMwebp_.jpg',
  'pa':         'https://m.media-amazon.com/images/I/41hfjhYP2FL._SY300_SX300_QL70_FMwebp_.jpg',
  'tb':         'https://m.media-amazon.com/images/I/41LYNHRK56L._SY300_SX300_QL70_FMwebp_.jpg',
  'ssd':        'https://m.media-amazon.com/images/I/21EuhyJEzOL._SX300_SY300_QL70_FMwebp_.jpg',
  'vac':        'https://m.media-amazon.com/images/I/313yY8ocBjL._SY300_SX300_QL70_FMwebp_.jpg',
  'rockerz':    'https://m.media-amazon.com/images/I/41B92fF+-LL._SY300_SX300_QL70_FMwebp_.jpg',
  'mi-ps3i':    'https://m.media-amazon.com/images/I/41V22K7ad-L._SY300_SX300_QL70_FMwebp_.jpg',
  'pulse2':     'https://m.media-amazon.com/images/I/41uSvMGyguL._SY300_SX300_QL70_FMwebp_.jpg',
  'usb-c':      'https://m.media-amazon.com/images/I/31ma3UQESZL._SY300_SX300_QL70_FMwebp_.jpg',
  'hb300':      'https://m.media-amazon.com/images/I/315+DXHZMEL._SY300_SX300_QL70_FMwebp_.jpg',
  'shk':        'https://m.media-amazon.com/images/I/41YUU02oDKL._SY300_SX300_QL70_FMwebp_.jpg',
  'smart-band': 'https://m.media-amazon.com/images/I/31F9PjkAboL._SY300_SX300_QL70_FMwebp_.jpg',
  // deal IDs that alias to scraper IDs
  'blender':    'https://m.media-amazon.com/images/I/315+DXHZMEL._SY300_SX300_QL70_FMwebp_.jpg', // hb300
  'cable':      'https://m.media-amazon.com/images/I/31ma3UQESZL._SY300_SX300_QL70_FMwebp_.jpg', // usb-c
  'pbank':      'https://m.media-amazon.com/images/I/41V22K7ad-L._SY300_SX300_QL70_FMwebp_.jpg', // mi-ps3i
  'colorfit':   'https://m.media-amazon.com/images/I/41uSvMGyguL._SY300_SX300_QL70_FMwebp_.jpg', // pulse2
}

// IDs that have no real image — reset to null
const NO_IMAGE_IDS = new Set(['kettle', 'pj', 'wp', 'induction', 'ptron-bass', 'realme-t01', 'boat-161'])

async function main() {
  const get = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  let content = get.data.content.raw
  console.log(`Downloaded. Length: ${content.length}`)

  let fixes = 0
  const allIds = [...Object.keys(CORRECT_IMAGES), ...NO_IMAGE_IDS]

  for (const id of allIds) {
    const correctImg = CORRECT_IMAGES[id] || null
    const newImgStr = `"img": ${correctImg ? `"${correctImg}"` : 'null'}`
    const idPattern = `"id": "${id}"`
    let pos = 0

    while (true) {
      const idIdx = content.indexOf(idPattern, pos)
      if (idIdx === -1) break

      const window = content.substring(idIdx, idIdx + 600)
      const imgMatch = window.match(/"img":\s*(?:"[^"]*"|null)/)
      if (imgMatch) {
        const imgStart = idIdx + window.indexOf(imgMatch[0])
        const oldImgStr = imgMatch[0]
        if (oldImgStr !== newImgStr) {
          content = content.substring(0, imgStart) + newImgStr + content.substring(imgStart + oldImgStr.length)
          console.log(`  ${id}: ${oldImgStr.substring(7, 50)} → ${newImgStr.substring(7, 50)}`)
          fixes++
        }
      }
      pos = idIdx + idPattern.length
    }
  }

  console.log(`\nFixes: ${fixes}`)
  if (fixes === 0) { console.log('Nothing to fix.'); return }

  const res = await axios.post(
    `${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log(`Pushed. Status: ${res.data.status}, Modified: ${res.data.modified}`)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
