const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const OUT = 'C:/Claude/tmp/audit'
fs.mkdirSync(OUT, { recursive: true })

async function shot(page, name) {
  const file = path.join(OUT, name + '.png')
  await page.screenshot({ path: file, fullPage: false })
  return file
}

async function getImages(page) {
  return page.evaluate(() => {
    const ph = window.PH
    const allDeals = [
      ...(ph?.deals || []),
      ...(ph?.staffPicks || []),
      ...(ph?.ticker || []),
    ]
    const imgs = document.querySelectorAll('.ph img')
    const domImgs = Array.from(imgs).map(img => ({
      alt: img.alt?.substring(0, 40),
      src: img.src?.substring(0, 90),
      naturalW: img.naturalWidth,
      ok: img.complete && img.naturalWidth > 0,
    }))

    return {
      deals: (ph?.deals || []).map(d => ({
        id: d.id, name: d.name?.substring(0, 35), img: d.img || null,
        asin: d.asin
      })),
      staffPicks: (ph?.staffPicks || []).map(d => ({
        id: d.id, name: d.name?.substring(0, 35), img: d.img || null
      })),
      ticker: (ph?.ticker || []).map(d => ({
        id: d.id, name: d.name?.substring(0, 35), img: d.img || null
      })),
      domImgs,
    }
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  // --- Homepage ---
  console.log('Loading homepage...')
  await page.goto('https://pricehawk.in/?v=audit1', { waitUntil: 'networkidle', timeout: 40000 })
  await page.waitForTimeout(3000)

  await shot(page, '01-homepage-top')
  await page.evaluate(() => window.scrollTo(0, 400))
  await page.waitForTimeout(500)
  await shot(page, '02-homepage-deals')
  await page.evaluate(() => window.scrollTo(0, 1200))
  await page.waitForTimeout(500)
  await shot(page, '03-homepage-mid')
  await page.evaluate(() => window.scrollTo(0, 2200))
  await page.waitForTimeout(500)
  await shot(page, '04-homepage-bottom')

  const data = await getImages(page)
  fs.writeFileSync(path.join(OUT, 'image-data.json'), JSON.stringify(data, null, 2))

  // Analyse
  const noImg = data.deals.filter(d => !d.img)
  const withImg = data.deals.filter(d => d.img)
  const imgUrls = withImg.map(d => d.img)
  const dupes = imgUrls.filter((url, i) => imgUrls.indexOf(url) !== i)
  const brokenDom = data.domImgs.filter(i => !i.ok && i.src && !i.src.includes('data:'))

  console.log('\n=== IMAGE AUDIT ===')
  console.log('Deals total:', data.deals.length)
  console.log('Missing img:', noImg.map(d => d.id + ' (' + d.name + ')').join(', '))
  console.log('Duplicate img URLs:', [...new Set(dupes)])
  console.log('Broken DOM imgs:', brokenDom.length, brokenDom.map(i => i.alt).join(', '))
  console.log('Ticker has img:', data.ticker.filter(t => t.img).length + '/' + data.ticker.length)
  console.log('StaffPicks has img:', data.staffPicks.filter(t => t.img).length + '/' + data.staffPicks.length)

  console.log('\nDeals with images:')
  data.deals.forEach(d => {
    const imgId = d.img?.match(/\/I\/([^._]+)/)?.[1] || 'NULL'
    const dup = dupes.includes(d.img) ? ' *** DUPLICATE ***' : ''
    console.log(' ', d.id, '->', imgId, dup)
  })

  await browser.close()
  console.log('\nScreenshots in:', OUT)
}

main().catch(e => { console.error(e.message); process.exit(1) })
