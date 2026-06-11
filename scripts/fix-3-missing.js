#!/usr/bin/env node
// Fix pj, wp, induction + their staffPick equivalents
require('dotenv').config()
const { chromium } = require('playwright')
const axios = require('axios')
const path = require('path')
const { execFileSync } = require('child_process')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')

const TO_SCRAPE = {
  'pj':        ['Wzatco projector 1080p home theatre', 'mini projector 1080p LED India', 'projector for home 1080p'],
  'wp':        ['AquaGuard water purifier RO UV', 'Eureka Forbes water purifier', 'water purifier RO UV 7 stage'],
  'induction': ['Prestige induction cooktop 1600W', 'induction cooktop Prestige 2000W', 'Prestige PIC induction'],
}

async function scrapeWithFallback(page, queries) {
  for (const query of queries) {
    console.log(`  Trying: ${query}`)
    try {
      const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(3000)

      const asin = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/dp/"]'))
        for (const a of links) {
          const m = a.href.match(/\/dp\/([A-Z0-9]{10})/)
          if (m) return m[1]
        }
        return null
      })

      if (!asin) continue

      await page.goto(`https://www.amazon.in/dp/${asin}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(3000)

      const result = await page.evaluate(() => {
        // Try multiple selectors
        const selectors = ['#landingImage', '#imgTagWrapperId img', '#main-image', '.a-dynamic-image']
        for (const sel of selectors) {
          const img = document.querySelector(sel)
          if (img) {
            const url = img.getAttribute('data-old-hires') || img.getAttribute('data-src') || img.getAttribute('src')
            const id = url && url.match(/\/I\/([^._]+)/)?.[1]
            if (id) return { id, asin: '', title: document.title?.substring(0, 60) }
          }
        }
        // Try from data-a-dynamic-image attribute
        const dynImg = document.querySelector('[data-a-dynamic-image]')
        if (dynImg) {
          const dynData = dynImg.getAttribute('data-a-dynamic-image')
          const urlMatch = dynData && dynData.match(/images\/I\/([^._"]+)/)
          if (urlMatch) return { id: urlMatch[1], asin: '', title: document.title?.substring(0, 60) }
        }
        return null
      })

      if (result?.id) {
        const thumbUrl = `https://m.media-amazon.com/images/I/${result.id}._SY300_SX300_QL70_FMwebp_.jpg`
        console.log(`  Got: ${asin} → ${result.id} | ${result.title}`)
        return thumbUrl
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`)
    }
  }
  return null
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

  // staffPicks use single-quote JS format: id: 'sp-projector'
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
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-IN,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })

  const results = {}
  for (const [id, queries] of Object.entries(TO_SCRAPE)) {
    console.log(`\n[${id}]`)
    results[id] = await scrapeWithFallback(page, queries)
  }
  await browser.close()

  console.log('\n=== Results ===')
  for (const [id, url] of Object.entries(results)) {
    console.log(`  ${id}: ${url ? url.substring(0, 65) : 'NULL - will keep null'}`)
  }

  const succeeded = Object.entries(results).filter(([, url]) => url)
  if (succeeded.length === 0) {
    console.log('Nothing scraped. Exiting.')
    return
  }

  console.log('\nDownloading WP page 12...')
  const get = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  let content = get.data.content.raw
  let totalFixes = 0

  // staffPick → deal mapping
  const staffPickMap = { 'sp-projector': 'pj', 'sp-purifier': 'wp' }

  for (const [id, imgUrl] of succeeded) {
    const { content: c, fixes } = patchImg(content, id, imgUrl)
    content = c
    if (fixes) console.log(`  Fixed deal [${id}]: ${fixes} occurrence(s)`)
    totalFixes += fixes
  }

  for (const [spId, dealId] of Object.entries(staffPickMap)) {
    const imgUrl = results[dealId]
    if (!imgUrl) continue
    const { content: c, fixes } = patchImg(content, spId, imgUrl)
    content = c
    if (fixes) console.log(`  Fixed staffPick [${spId}]: ${fixes} occurrence(s)`)
    totalFixes += fixes
  }

  console.log(`\nTotal fixes: ${totalFixes}`)
  if (totalFixes === 0) { console.log('Nothing to push.'); return }

  try { execFileSync(process.execPath, [path.join(__dirname, 'save-version.js')], { stdio: 'inherit' }) } catch (e) {}

  const res = await axios.post(`${WP_URL}/wp-json/wp/v2/pages/12`,
    { content },
    { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }
  )
  console.log(`Pushed. Status: ${res.data.status}, Modified: ${res.data.modified}`)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
