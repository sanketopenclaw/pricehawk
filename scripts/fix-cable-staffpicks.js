#!/usr/bin/env node
// Fix cable image (wrong - shows power bank) + populate staffPicks (currently empty)
require('dotenv').config()
const { chromium } = require('playwright')
const axios = require('axios')
const path = require('path')
const { execFileSync } = require('child_process')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')

async function scrapeImage(page, query) {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(1500)

  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="/dp/"]'))
      .map(a => a.href.match(/\/dp\/([A-Z0-9]{10})/)?.[1])
      .filter(Boolean)
  )
  const asin = links[0]
  if (!asin) { console.log(`  No result for: ${query}`); return null }

  await page.goto(`https://www.amazon.in/dp/${asin}`, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(1500)

  const result = await page.evaluate(() => {
    const img = document.querySelector('#landingImage') || document.querySelector('#imgTagWrapperId img')
    const url = img && (img.getAttribute('data-old-hires') || img.getAttribute('src'))
    const id = url && url.match(/\/I\/([^._]+)/)?.[1]
    return { id, title: document.title?.substring(0, 70) }
  })

  if (!result.id) { console.log(`  No image for: ${query}`); return null }
  const thumbUrl = `https://m.media-amazon.com/images/I/${result.id}._SY300_SX300_QL70_FMwebp_.jpg`
  console.log(`  ${asin} → ${result.id} | ${result.title}`)
  return { asin, imgUrl: thumbUrl, imgId: result.id }
}

// 3 curated staffPicks using existing deal products that have correct images
const STAFF_PICKS = [
  {
    id: 'sp1',
    name: 'Oral-B Vitality 100 Electric Toothbrush',
    cat: 'Personal Care',
    asin: 'B0DFWC4XH9',
    img: 'https://m.media-amazon.com/images/I/61tMDjfhnLL._SY300_SX300_QL70_FMwebp_.jpg',
    link: 'https://www.amazon.in/dp/B0DFWC4XH9?tag=pricehawkin-21',
    why: "Best value electric toothbrush in India. CrossAction brush head is clinically proven to remove 100% more plaque than a manual toothbrush. Dentist-recommended brand.",
  },
  {
    id: 'sp2',
    name: 'Eureka Forbes Robo Vac N Mop PRO',
    cat: 'Home Appliances',
    asin: 'B0FD3532NR',
    img: 'https://m.media-amazon.com/images/I/313yY8ocBjL._SY300_SX300_QL70_FMwebp_.jpg',
    link: 'https://www.amazon.in/dp/B0FD3532NR?tag=pricehawkin-21',
    why: "Hands-free floor cleaning at an India-friendly price. 2000Pa suction handles dust, pet hair, and crumbs. Auto-returns to dock when battery drops.",
  },
  {
    id: 'sp3',
    name: 'Crucial BX500 480GB SATA SSD',
    cat: 'Computing',
    asin: 'B0B9BL9T4H',
    img: 'https://m.media-amazon.com/images/I/21EuhyJEzOL._SY300_SX300_QL70_FMwebp_.jpg',
    link: 'https://www.amazon.in/dp/B0B9BL9T4H?tag=pricehawkin-21',
    why: "Fastest affordable laptop upgrade. Drop-in SATA replacement delivers 6× faster boot times than HDD. 3-year Crucial warranty. Works on any laptop made since 2010.",
  },
]

async function main() {
  console.log('Scraping correct cable image from Amazon India...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en;q=0.9' })

  let cableResult = null
  try {
    console.log('[cable] Searching: AmazonBasics USB-C to USB-C cable 2 meter')
    cableResult = await scrapeImage(page, 'AmazonBasics USB Type-C to USB-C 2.0 cable 2m')
    if (!cableResult) {
      console.log('[cable] Trying alternate query...')
      cableResult = await scrapeImage(page, 'USB C cable 2 meter Type C fast charging cable')
    }
  } catch(e) {
    console.log('  Error:', e.message)
  }
  await browser.close()

  console.log('\nCable result:', cableResult)

  // Download WP page
  console.log('\nDownloading WP page 12...')
  const get = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  let content = get.data.content.raw
  let fixes = 0

  // 1. Fix cable image
  if (cableResult) {
    const idPattern = `"id": "cable"`
    const idIdx = content.indexOf(idPattern)
    if (idIdx > -1) {
      const win = content.substring(idIdx, idIdx + 600)
      const imgMatch = win.match(/"img":\s*(?:"[^"]*"|null)/)
      if (imgMatch) {
        const imgStart = idIdx + win.indexOf(imgMatch[0])
        const newStr = `"img": "${cableResult.imgUrl}"`
        if (imgMatch[0] !== newStr) {
          content = content.substring(0, imgStart) + newStr + content.substring(imgStart + imgMatch[0].length)
          console.log(`Fixed cable img: ${cableResult.imgId}`)
          fixes++
        }
      }
      // Also update ASIN if null
      const asinMatch = win.match(/"asin":\s*null/)
      if (asinMatch && cableResult.asin) {
        const asinStart = idIdx + win.indexOf(asinMatch[0])
        const newAsin = `"asin": "${cableResult.asin}"`
        content = content.substring(0, asinStart) + newAsin + content.substring(asinStart + asinMatch[0].length)
        console.log(`Fixed cable asin: ${cableResult.asin}`)
        fixes++
      }
    }
  } else {
    console.log('No cable result — skipping cable fix')
  }

  // 2. Add staffPicks data array
  // Find where "const staffPicks" or "let staffPicks" might be, or insert before window.PH
  const STAFF_JSON = JSON.stringify(STAFF_PICKS, null, 2)
  const spVar = `\nconst staffPicks = ${STAFF_JSON};\n`

  // Find insertion point: just before "window.PH = {"
  const wpLinePattern = 'window.PH = { inr, pct, products, deals, guides, categories, ticker, guideDetail, comparison, legal };'
  const wpIdx = content.indexOf(wpLinePattern)
  if (wpIdx === -1) {
    console.log('ERROR: cannot find window.PH line')
  } else {
    // Insert staffPicks variable before window.PH
    if (!content.includes('const staffPicks')) {
      content = content.substring(0, wpIdx) + spVar + content.substring(wpIdx)
      // Now update window.PH to include staffPicks
      const newWpLine = 'window.PH = { inr, pct, products, deals, guides, categories, ticker, staffPicks, guideDetail, comparison, legal };'
      content = content.replace(wpLinePattern, newWpLine)
      console.log('Added staffPicks data + wired into window.PH')
      fixes++
    } else {
      // staffPicks already exists — update it
      const spStart = content.indexOf('const staffPicks')
      const spEnd = content.indexOf(';\n', spStart) + 2
      content = content.substring(0, spStart) + 'const staffPicks' + spVar.substring('const staffPicks'.length) + content.substring(spEnd)
      console.log('Updated existing staffPicks data')
      fixes++
    }
  }

  console.log(`\nTotal fixes: ${fixes}`)
  if (fixes === 0) { console.log('Nothing to push'); return }

  // Backup
  try { execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' }) } catch(e) {}

  const res = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log('Pushed:', res.data.modified)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
