import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs'
import path from 'path'

const DEALS_FILE = path.join(process.cwd(), 'data/deals.json')

let app
beforeAll(async () => {
  process.env.FIRECRAWL_API_KEY = 'test-key'
  fs.mkdirSync(path.dirname(DEALS_FILE), { recursive: true })
  fs.writeFileSync(DEALS_FILE, JSON.stringify({ tracked: [], alerts_sent: [] }))
  const router = (await import('../../routes/deals.js')).default
  app = express()
  app.use(express.json())
  app.use('/api/pricehawk/deals', router)
})

describe('POST /api/pricehawk/deals/track', () => {
  it('returns 400 when asin missing', async () => {
    const r = await request(app).post('/api/pricehawk/deals/track').send({ name: 'Test' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/asin/)
  })

  it('returns 400 when name missing', async () => {
    const r = await request(app).post('/api/pricehawk/deals/track').send({ asin: 'B09X2XWWTZ' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/name/)
  })

  it('returns 400 for invalid asin format', async () => {
    const r = await request(app).post('/api/pricehawk/deals/track').send({ asin: '../etc/passwd', name: 'Test' })
    expect(r.status).toBe(400)
  })

  it('adds product to watchlist', async () => {
    const r = await request(app).post('/api/pricehawk/deals/track').send({ asin: 'B09X2XWWTZ', name: 'boAt Airdopes 141', threshold_inr: 1200 })
    expect(r.status).toBe(200)
    expect(r.body.tracked).toBe(true)
  })
})

describe('GET /api/pricehawk/deals/watchlist', () => {
  it('returns watchlist array', async () => {
    const r = await request(app).get('/api/pricehawk/deals/watchlist')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.body.watchlist)).toBe(true)
    expect(r.body.count).toBeGreaterThanOrEqual(0)
  })
})

describe('DELETE /api/pricehawk/deals/track/:asin', () => {
  it('removes product from watchlist', async () => {
    const r = await request(app).delete('/api/pricehawk/deals/track/B09X2XWWTZ')
    expect(r.status).toBe(200)
    expect(r.body.removed).toBe(true)
  })

  it('returns 400 for invalid asin in param', async () => {
    const r = await request(app).delete('/api/pricehawk/deals/track/invalid-asin')
    expect(r.status).toBe(400)
  })
})
