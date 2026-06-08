#!/usr/bin/env node
// Fix all image issues on homepage:
// 1. Null deal images (kettle, pj, wp, induction)
// 2. pa (Mi Air Purifier 4) - currently shows HEPA filter accessory
// 3. GuideCard component - add cover image support
// 4. Guide cover images - scrape category images
require('dotenv').config()
const { chromium } = require('playwright')
const axios = require('axios')
const path = require('path')
const { execFileSync } = require('child_process')

const WP_URL = process.env.WORDPRESS_URL
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')

// Products needing images scraped from Amazon India
const TO_SCRAPE = {
  // Null deal images
  'kettle':    'Pigeon Amaze Plus 1.5L Electric Kettle',
  'pj':        'Wzatco Cosmos Mini Projector LED',
  'wp':        'AquaGuard Aura RO UV water purifier',
  'induction': 'Prestige PIC 3.0 V3 Induction Cooktop',
  // Fix pa - HEPA filter was scraped, need actual purifier
  'pa':        'Mi Xiaomi Smart Air Purifier 4 Compact',
  // Guide covers - one representative product per category
  'guide-earbuds':      'boAt Airdopes TWS earbuds bluetooth',
  'guide-smartphones':  'Samsung Galaxy smartphone',
  'guide-airpurifiers': 'Dyson Coway air purifier room',
  'guide-laptops':      'Asus VivoBook laptop student',
  'guide-vacuums':      'Eureka Forbes robot vacuum cleaner',
  'guide-toothbrush':   'Oral-B electric toothbrush',
}

async function scrapeImage(page, query) {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(1500)

  // Get first product link with /dp/
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href*="/dp/"]'))
      .map(a => a.href.match(/\/dp\/([A-Z0-9]{10})/)?.[1])
      .filter(Boolean)
  )
  const asin = links[0]
  if (!asin) { console.log(`  No result for: ${query}`); return null }

  await page.goto(`https://www.amazon.in/dp/${asin}`, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(1500)

  const title = await page.title()
  const result = await page.evaluate(() => {
    const img = document.querySelector('#landingImage') || document.querySelector('#imgTagWrapperId img')
    const url = img && (img.getAttribute('data-old-hires') || img.getAttribute('src'))
    const id = url && url.match(/\/I\/([^._]+)/)?.[1]
    return { id, title: document.title?.substring(0, 60) }
  })

  if (!result.id) { console.log(`  No image for: ${query}`); return null }
  const thumbUrl = `https://m.media-amazon.com/images/I/${result.id}._SY300_SX300_QL70_FMwebp_.jpg`
  console.log(`  ${asin} → ${result.id} | ${result.title}`)
  return { asin, imgUrl: thumbUrl, imgId: result.id }
}

async function main() {
  console.log('Scraping images from Amazon India...\n')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en;q=0.9' })

  const results = {}
  for (const [id, query] of Object.entries(TO_SCRAPE)) {
    console.log(`[${id}] ${query}`)
    try { results[id] = await scrapeImage(page, query) }
    catch(e) { console.log(`  Error: ${e.message}`) }
  }
  await browser.close()

  console.log('\n=== Scraped ===')
  for (const [id, r] of Object.entries(results)) {
    console.log(id, '->', r?.imgId || 'NULL')
  }

  // Download WP page 12
  console.log('\nDownloading WP page 12...')
  const get = await axios.get(`${WP_URL}/wp-json/wp/v2/pages/12?context=edit`, {
    headers: { Authorization: `Basic ${AUTH}` }
  })
  let content = get.data.content.raw
  let fixes = 0

  // 1. Fix null deal images + pa
  const dealIds = ['kettle', 'pj', 'wp', 'induction', 'pa']
  for (const id of dealIds) {
    const r = results[id]
    if (!r) { console.log(`Skipping ${id} — no result`); continue }

    const idPattern = `"id": "${id}"`
    let pos = 0
    while (true) {
      const idIdx = content.indexOf(idPattern, pos)
      if (idIdx === -1) break
      const win = content.substring(idIdx, idIdx + 600)
      const imgMatch = win.match(/"img":\s*(?:"[^"]*"|null)/)
      if (imgMatch) {
        const imgStart = idIdx + win.indexOf(imgMatch[0])
        const newStr = `"img": "${r.imgUrl}"`
        if (imgMatch[0] !== newStr) {
          content = content.substring(0, imgStart) + newStr + content.substring(imgStart + imgMatch[0].length)
          console.log(`Fixed img [${id}]: ${r.imgId}`)
          fixes++
        }
      }
      pos = idIdx + idPattern.length
    }
  }

  // 2. Add cover images to guide objects
  const guideCovers = {
    'g1': results['guide-earbuds']?.imgUrl,
    'g2': results['guide-smartphones']?.imgUrl,
    'g3': results['guide-airpurifiers']?.imgUrl,
    'g4': results['guide-laptops']?.imgUrl,
    'g5': results['guide-vacuums']?.imgUrl,
    'g6': results['guide-toothbrush']?.imgUrl,
  }

  for (const [gid, coverUrl] of Object.entries(guideCovers)) {
    if (!coverUrl) continue
    const idPattern = `"id": "${gid}"`
    const idIdx = content.indexOf(idPattern)
    if (idIdx === -1) continue

    // Get the guide object end (next { or end of array)
    const objEnd = content.indexOf('}', idIdx + idPattern.length)
    const objContent = content.substring(idIdx, objEnd)

    if (objContent.includes('"cover"')) {
      // Replace existing
      const newObj = objContent.replace(/"cover":\s*(?:"[^"]*"|null)/, `"cover": "${coverUrl}"`)
      content = content.substring(0, idIdx) + newObj + content.substring(objEnd)
    } else {
      // Insert before closing }
      content = content.substring(0, objEnd) + `,\n    "cover": "${coverUrl}"` + content.substring(objEnd)
    }
    console.log(`Added cover [${gid}]: ${results['guide-' + Object.keys(guideCovers).find(k => guideCovers[k] === coverUrl && k === gid.replace('g',''))]?.imgId || 'ok'}`)
    fixes++
  }

  // 3. Fix GuideCard component — replace Tile placeholder with conditional img
  const OLD_TILE = '<Tile label="cover" radius={0} style={{ height: 132, border: \'none\', borderBottom: \'1px solid var(--border)\' }} />'
  const NEW_TILE = `{g.cover ? React.createElement('img', { src: g.cover, alt: g.title, style: { width: '100%', height: 132, objectFit: 'cover', display: 'block', borderBottom: '1px solid var(--border)' } }) : React.createElement(Tile, { label: 'cover', radius: 0, style: { height: 132, border: 'none', borderBottom: '1px solid var(--border)' } })}`

  if (content.includes(OLD_TILE)) {
    content = content.replace(OLD_TILE, NEW_TILE)
    console.log('Fixed GuideCard component')
    fixes++
  } else {
    // JSX is escaped in WP — try unicode version
    const escapedOld = OLD_TILE.replace(/'/g, '\\u0027').replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    // Try direct search by segments
    const tileSearch = 'label=\\"cover\\" radius={0}'
    if (content.includes(tileSearch)) {
      const tileIdx = content.indexOf('\\u003cTile label=\\"cover\\"')
      if (tileIdx > -1) {
        const tileEnd = content.indexOf('/\\u003e', tileIdx) + '/\\u003e'.length
        const newTileEsc = `{g.cover?React.createElement('img',{src:g.cover,alt:g.title,style:{width:'100%',height:132,objectFit:'cover',display:'block',borderBottom:'1px solid var(--border)'}}):React.createElement(Tile,{label:'cover',radius:0,style:{height:132,border:'none',borderBottom:'1px solid var(--border)'}})}`
        content = content.substring(0, tileIdx) + newTileEsc + content.substring(tileEnd)
        console.log('Fixed GuideCard (escaped JSX)')
        fixes++
      }
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
