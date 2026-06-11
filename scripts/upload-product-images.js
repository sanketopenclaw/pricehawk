#!/usr/bin/env node
// Upload all product images to WP media library + store attachment ID/URL in product JSON
// Idempotent: skips products that already have wp_image_id
// Usage: node upload-product-images.js [--cat air-fryers] [--limit 50] [--force]
require('dotenv').config()
const https = require('https')
const http = require('http')
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const WP_URL = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const AUTH = Buffer.from(`${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APP_PASSWORD}`).toString('base64')
const PRODUCTS_DIR = path.join(__dirname, '../data/products')
const CONCURRENCY = 4   // parallel uploads (Hostinger shared hosting — keep low)
const DELAY_MS = 300    // ms between batches

const args = process.argv.slice(2)
const catFilter = args[args.indexOf('--cat') + 1] || null
const limitArg  = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : Infinity
const force     = args.includes('--force')

// ── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'image/jpeg' }))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function contentTypeToExt(ct) {
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('png'))  return 'png'
  return 'jpg'
}

async function uploadToWP(imgBuffer, contentType, filename, altText) {
  const resp = await axios.post(`${WP_URL}/wp-json/wp/v2/media`, imgBuffer, {
    headers: {
      Authorization: `Basic ${AUTH}`,
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })
  // Set alt text
  if (altText) {
    await axios.post(`${WP_URL}/wp-json/wp/v2/media/${resp.data.id}`, {
      alt_text: altText,
      caption: '',
    }, { headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' } }).catch(() => {})
  }
  return { id: resp.data.id, url: resp.data.source_url }
}

// ── load products ────────────────────────────────────────────────────────────

function loadAll() {
  const all = []
  for (const file of fs.readdirSync(PRODUCTS_DIR)) {
    if (!file.endsWith('.json')) continue
    const catSlug = file.replace('.json', '')
    if (catFilter && catSlug !== catFilter) continue
    let data
    try { data = JSON.parse(fs.readFileSync(path.join(PRODUCTS_DIR, file), 'utf8')) }
    catch (e) { console.warn(`Parse error ${file}: ${e.message}`); continue }
    if (!data.products) continue
    for (const p of data.products) {
      all.push({ file, catSlug, data, product: p })
    }
  }
  return all
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const all = loadAll()
  console.log(`Loaded ${all.length} products${catFilter ? ` (cat: ${catFilter})` : ''}`)

  // Filter to those needing upload
  const eligible = all.filter(x => {
    const p = x.product
    if (!p._legacy?.img) return false
    if (!force && p.wp_image_id) return false
    return true
  })
  const alreadyDone = all.length - eligible.length
  const toProcess = eligible.slice(0, limitArg)

  console.log(`Total: ${all.length}  Already uploaded: ${alreadyDone}  To upload: ${toProcess.length}`)

  if (toProcess.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let done = 0, failed = 0
  const dirtyFiles = new Set()   // files with pending writes

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY)

    await Promise.all(batch.map(async item => {
      const p = item.product
      const srcUrl = p._legacy.img
      const name = p.product_name || p._legacy?.name || p.product_id
      const brand = p.brand_id || p._legacy?.brand || ''
      const asin = p._legacy?.asin
        || (Array.isArray(p.offers) ? p.offers[0]?.external_id : p.offers?.external_id)
        || ''

      try {
        const { buffer, contentType } = await downloadBuffer(srcUrl)
        const ext = contentTypeToExt(contentType)
        const filename = `${item.catSlug}-${asin || p.product_id.slice(-8)}.${ext}`
        const altText = `${name} — buy on Amazon India`
        const { id, url } = await uploadToWP(buffer, contentType, filename, altText)

        // Write back to product object
        p.wp_image_id = id
        p.wp_image_url = url

        done++
        dirtyFiles.add(item.file)
        process.stdout.write(`\r  ${done + failed}/${toProcess.length} — OK: ${done}  FAIL: ${failed}`)
      } catch (e) {
        failed++
        process.stdout.write(`\r  ${done + failed}/${toProcess.length} — OK: ${done}  FAIL: ${failed}`)
        if (process.env.DEBUG) console.log(`\n  [FAIL] ${p.product_id}: ${e.message}`)
      }
    }))

    // Flush dirty files every batch
    for (const file of dirtyFiles) {
      const items = toProcess.filter(x => x.file === file)
      if (!items.length) continue
      const filepath = path.join(PRODUCTS_DIR, file)
      const data = items[0].data  // shared reference
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8')
    }
    dirtyFiles.clear()

    if (i + CONCURRENCY < toProcess.length) await sleep(DELAY_MS)
  }

  console.log(`\n\nDone: ${done}  Failed: ${failed}`)
  console.log(`WP images live at ${WP_URL}/wp-content/uploads/`)
}

main().catch(e => { console.error(e.response?.data || e.message); process.exit(1) })
