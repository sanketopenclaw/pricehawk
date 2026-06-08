import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'

let app
beforeAll(async () => {
  process.env.AMAZON_AFFILIATE_TAG = 'pricehawkin-21'
  const router = (await import('../../routes/monetize.js')).default
  app = express()
  app.use(express.json())
  app.use('/api/pricehawk', router)
})

describe('POST /api/pricehawk/monetize', () => {
  it('returns 400 when content missing', async () => {
    const r = await request(app).post('/api/pricehawk/monetize').send({ products: [] })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/content/)
  })

  it('replaces Amazon affiliate placeholders', async () => {
    const r = await request(app).post('/api/pricehawk/monetize').send({
      content: 'Buy this [AFFILIATE LINK: EARBUDS_PRODUCT_1]',
      products: [{ name: 'boAt Airdopes 141', asin: 'B09X2XWWTZ' }],
      network: 'amazon'
    })
    expect(r.status).toBe(200)
    expect(r.body.content).toContain('amazon.in')
    expect(r.body.content).toContain('pricehawkin-21')
    expect(r.body.links_inserted).toBe(1)
  })

  it('returns 0 links when no placeholders in content', async () => {
    const r = await request(app).post('/api/pricehawk/monetize').send({
      content: 'No placeholders here.',
      products: [{ name: 'Test', asin: 'B001234567' }],
      network: 'amazon'
    })
    expect(r.status).toBe(200)
    expect(r.body.links_inserted).toBe(0)
  })

  it('returns 400 for invalid network', async () => {
    const r = await request(app).post('/api/pricehawk/monetize').send({
      content: 'test [AFFILIATE LINK: X_PRODUCT_1]',
      products: [{ name: 'X', asin: 'B001234567' }],
      network: 'invalid'
    })
    expect(r.status).toBe(400)
  })
})
