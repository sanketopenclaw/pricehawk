#!/usr/bin/env node
// Scrape Amazon India images for 4 deals with null img + fix staffPicks
require('dotenv').config()
const { chromium } = require('playwright')
const axios = require('axios')
const path = require('path')
const { execFileSync } = require('child_process')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')

// Deals needing images scraped
const TO_SCRAPE = {
  'kettle':    'Pigeon Amaze Plus 1.5L Electric Kettle stainless',
  'pj':        'Wzatco Cosmos Mini Projector LED 1080p',
  'wp':        'Eureka Forbes AquaGuard Aura RO UV water purifier',
  'induction': 'Prestige PIC 3.0 V3 Induction Cooktop',
}

// staffPick id → deal id mapping (same product, reuse scraped image)
const STAFFPICK_MAP = {
  'sp-projector': 'pj',
  'sp-kettle':    'kettle',
  'sp-purifier':  'wp',
}

async function scrapeImage(page, query) {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(2000)

  const asin = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/dp/"]'))
    for (const a of links) {
      const m = a.href.match(/\/dp\/([A-Z0-9]{10})/)
      if (m) return m[1]
    }
    return null
  })

  if (!asin) { console.log(`  No result for: ${query}`); return null }

  await page.goto(`https://www.amazon.in/dp/${asin}`, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(2000)

  const result = await page.evaluate(() => {
    const img = document.querySelector('#landingImage') || document.querySelector('#imgTagWrapperId img')
    const url = img && (img.getAttribute('data-old-hires') || img.getAttribute('src'))
    const id = url && url.match(/\/I\/([^._]+)/)?.[1]
    return { id, title: document.title?.substring(0, 60) }
  })

  if (!result.id) { console.log(`  No image for ASIN ${asin}`); return null }
  const thumbUrl = `https://m.media-amazon.com/images/I/${result.id}._SY300_SX300_QL70_FMwebp_.jpg`
  console.log(`  ${asin} → ${result.id} | ${result.title}`)
  return thumbUrl
}

function patchImg(content, id, imgUrl) {
  const newImgStr = `"img": ${imgUrl ? `"${imgUrl}"` : 'null'}`
  const idPattern = `"id": "${id}"`
  let pos = 0
  let fixes = 0

  while (true) {
    const idIdx = content.indexOf(idPattern, pos)
    if (idIdx === -1) break
    const win = content.substring(idIdx, idIdx + 600)
    const imgMatch = win.match(/"img":\s*(?:"[^"]*"|null)/)
    if (imgMatch) {
      const imgStart = idIdx + win.indexOf(imgMatch[0])
      if (imgMatch[0] !== newImgStr) {
        content = content.substring(0, imgStart) + newImgStr + content.substring(imgStart + imgMatch[0].length)
        fixes++
      }
    }
    pos = idIdx + idPattern.length
  }

  // Also handle single-quoted JS (staffPicks)
  const spIdPattern = `id: '${id}'`
  pos = 0
  while (true) {
    const idIdx = content.indexOf(spIdPattern, pos)
    if (idIdx === -1) break
    const win = content.substring(idIdx, idIdx + 600)
    const imgMatch = win.match(/img:\s*(?:"[^"]*"|null)/)
    if (imgMatch) {
      const imgStart = idIdx + win.indexOf(imgMatch[0])
      const newStr = `img: ${imgUrl ? `"${imgUrl}"` : 'null'}`
      if (imgMatch[0] !== newStr) {
        content = content.substring(0, imgStart) + newStr + content.substring(imgStart + imgMatch[0].length)
        fixes++
      }
    }
    pos = idIdx + spIdPattern.length
  }

  return { content, fixes }
}

async function main() {
  console.log('Scraping Amazon India for 4 missing images...\n')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en;q=0.9' })

  const results = {}
  for (const [id, query] of Object.entries(TO_SCRAPE)) {
    console.log(`[${id}] ${query}`)
    try { results[id] = await scrapeImage(page, query) }
    catch (e) { console.log(`  Error: ${e.message}`) }
  }
  await browser.close()

  console.log('\n=== Scraped ===')
  for (const [id, url] of Object.entries(results)) {
    console.log(`  ${id}: ${url ? url.substring(0, 60) : 'NULL'}`)
  }

  if (Object.keys(results).length === 0) {
    console.log('Nothing scraped. Exiting.')
    return
  }

  // Download WP page 12
  console.log('\nDownloading WP page 12...')
  const get = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  let content = get.data.content.raw
  let totalFixes = 0

  // Fix deals
  for (const [id, imgUrl] of Object.entries(results)) {
    const { content: c, fixes } = patchImg(content, id, imgUrl)
    content = c
    if (fixes) console.log(`  Fixed deal [${id}]: ${fixes} occurrence(s)`)
    totalFixes += fixes
  }

  // Fix staffPicks (same images as corresponding deals)
  for (const [spId, dealId] of Object.entries(STAFFPICK_MAP)) {
    const imgUrl = results[dealId]
    if (!imgUrl) continue
    const { content: c, fixes } = patchImg(content, spId, imgUrl)
    content = c
    if (fixes) console.log(`  Fixed staffPick [${spId}] ← ${dealId}: ${fixes} occurrence(s)`)
    totalFixes += fixes
  }

  console.log(`\nTotal fixes: ${totalFixes}`)
  if (totalFixes === 0) { console.log('Nothing to push.'); return }

  // Backup
  try { execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' }) } catch (e) {}

  const res = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log(`Pushed. Status: ${res.data.status}, Modified: ${res.data.modified}`)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
