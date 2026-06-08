#!/usr/bin/env node
// Scrapes correct product images from Amazon India for products with wrong images
// Launches a real browser (playwright), searches Amazon India for each product,
// navigates to the product page, extracts the main image ID.
require('dotenv').config()
const { chromium } = require('playwright')
const axios = require('axios')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')

// Products that currently have WRONG images - need correct ones
// key = deal id in page content, value = search query to find it on Amazon India
const WRONG_PRODUCTS = {
  'mi-band':  'Redmi Smart Band 2 fitness tracker wristband',
  'pa':       'Mi Xiaomi Air Purifier 4 room HEPA',
  'tb':       'Oral-B Vitality 100 electric toothbrush CrossAction',
  'blender':  'Lifelong Hand Blender 300W HB300',
  'pbank':    'Xiaomi Mi Power Bank 3i 20000mAh',
}

async function getProductImage(page, query) {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}&i=electronics`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)

  // Get first product link
  const firstLink = await page.$('a.a-link-normal.s-underline-text, a[href*="/dp/"]')
  if (!firstLink) {
    console.log(`  No results for: ${query}`)
    return null
  }

  const href = await firstLink.getAttribute('href')
  const asinMatch = href?.match(/\/dp\/([A-Z0-9]{10})/)
  if (!asinMatch) {
    console.log(`  No ASIN found in: ${href}`)
    return null
  }
  const asin = asinMatch[1]

  // Navigate to product page
  await page.goto(`https://www.amazon.in/dp/${asin}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)

  const title = await page.title()
  console.log(`  ASIN: ${asin} — ${title.substring(0, 60)}`)

  // Extract main product image
  const imgEl = await page.$('#landingImage, #imgTagWrapperId img, #main-image')
  if (!imgEl) {
    console.log(`  No image element found`)
    return null
  }

  // Try data-old-hires first (high-res), then src
  let imgUrl = await imgEl.getAttribute('data-old-hires') || await imgEl.getAttribute('src')
  if (!imgUrl) return null

  // Convert to 300x300 thumbnail format
  const imgId = imgUrl.match(/\/I\/([^._]+)/)?.[1]
  if (!imgId) return null

  const thumbUrl = `https://m.media-amazon.com/images/I/${imgId}._SY300_SX300_QL70_FMwebp_.jpg`
  console.log(`  Image: ${thumbUrl}`)
  return { asin, imgUrl: thumbUrl }
}

async function main() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en;q=0.9' })

  const results = {}

  for (const [id, query] of Object.entries(WRONG_PRODUCTS)) {
    console.log(`\n[${id}] Searching: ${query}`)
    try {
      const result = await getProductImage(page, query)
      if (result) results[id] = result
    } catch (e) {
      console.log(`  Error: ${e.message}`)
    }
  }

  await browser.close()

  console.log('\n\n=== RESULTS ===')
  console.log(JSON.stringify(results, null, 2))

  if (Object.keys(results).length === 0) {
    console.log('No results. Exiting.')
    return
  }

  // Now patch the WP page content
  console.log('\nDownloading WP page 12...')
  const get = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  let content = get.data.content.raw
  let fixes = 0

  for (const [id, { imgUrl }] of Object.entries(results)) {
    const idPattern = `"id": "${id}"`
    let pos = 0
    while (true) {
      const idIdx = content.indexOf(idPattern, pos)
      if (idIdx === -1) break

      // Search 600 chars forward for "img" field
      const win = content.substring(idIdx, idIdx + 600)
      const imgMatch = win.match(/"img":\s*(?:"[^"]*"|null)/)
      if (imgMatch) {
        const imgStart = idIdx + win.indexOf(imgMatch[0])
        const newImgStr = `"img": "${imgUrl}"`
        if (imgMatch[0] !== newImgStr) {
          content = content.substring(0, imgStart) + newImgStr + content.substring(imgStart + imgMatch[0].length)
          console.log(`  Fixed ${id}: ${imgMatch[0].substring(7, 40)} → ${imgUrl.substring(0, 40)}`)
          fixes++
        }
      }
      pos = idIdx + idPattern.length
    }
  }

  console.log(`\nFixes: ${fixes}`)
  if (fixes === 0) { console.log('Nothing to push.'); return }

  // Save backup first
  const { execFileSync } = require('child_process')
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' })
  } catch (e) {
    console.warn('Backup failed:', e.message)
  }

  const res = await axios.post(
    `${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log(`Pushed. Status: ${res.data.status}, Modified: ${res.data.modified}`)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
