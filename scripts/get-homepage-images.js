const { chromium } = require('playwright')

const ASINS = [
  { id: 'boat-141',    asin: 'B0F8BVSK21', name: 'boAt Airdopes 141' },
  { id: 'noise-104',   asin: 'B09Y5LL6P4', name: 'Noise Buds VS104 Max' },
  { id: 'nord-2',      asin: 'B0DFQ1R3W4', name: 'OnePlus Nord Buds 2' },
  { id: 'realme-air5', asin: 'B0F5GV3Y87', name: 'realme Buds Air 5' },
  { id: 'cmf-buds',    asin: 'B0G2JRVY5F', name: 'CMF by Nothing Buds Pro' },
  { id: 'jbl-wave',    asin: 'B0DHL93XCN', name: 'JBL Wave Beam' },
  // deals
  { id: 'mi-band',     asin: 'B0G5G7LCJQ', name: 'Redmi Smart Band 2' },
  { id: 'pa',          asin: 'B0DNMMZR2Q', name: 'Mi Air Purifier 4' },
  { id: 'tb',          asin: 'B0DFWC4XH9', name: 'Oral-B Vitality 100' },
  { id: 'ssd',         asin: 'B0B9BL9T4H', name: 'Crucial BX500 SSD' },
  { id: 'vac',         asin: 'B0FD3532NR', name: 'Eureka Forbes Robo Vac' },
  { id: 'rockerz',     asin: 'B0CKRGNBTP', name: 'boAt Rockerz 255 Pro+' },
  { id: 'mi-ps3i',     asin: 'B0CNRFYLV8', name: 'Mi Power Bank 3i' },
  { id: 'pulse2',      asin: 'B0CM3R74FJ', name: 'Noise ColorFit Pulse 2' },
  { id: 'usb-c',       asin: 'B0DCZ3WDTB', name: 'AmazonBasics USB-C' },
  { id: 'hb300',       asin: 'B0DFWL8F5C', name: 'Lifelong Hand Blender' },
  { id: 'shk',         asin: 'B00YMJ0OI8', name: 'boAt Rockerz 255' },
  { id: 'smart-band',  asin: 'B0FZ9SKQQQ', name: 'Smart Band' },
]

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' })
  const results = {}

  for (const { id, asin, name } of ASINS) {
    try {
      const page = await context.newPage()
      await page.goto(`https://www.amazon.in/dp/${asin}`, { timeout: 15000, waitUntil: 'domcontentloaded' })
      const img = await page.evaluate(() => {
        const el = document.querySelector('#landingImage, #imgBlkFront')
        return el ? el.src : null
      })
      // Convert to SL200 (square 200px) for consistent card images
      const url = img ? img.replace(/_[A-Z]+[0-9]+_\./, '._SL200_.') : null
      results[id] = url
      console.log(`${name}: ${url ? url.substring(0, 60) + '...' : 'NOT FOUND'}`)
      await page.close()
    } catch (e) {
      console.log(`${name}: ERROR - ${e.message}`)
      results[id] = null
    }
  }

  await browser.close()
  console.log('\nJSON map:')
  console.log(JSON.stringify(results, null, 2))
})()
