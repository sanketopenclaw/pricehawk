import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'

let app
beforeAll(async () => {
  process.env.FIRECRAWL_API_KEY = 'test-key'
  const router = (await import('../../routes/products.js')).default
  app = express()
  app.use(express.json())
  app.use('/api/pricehawk', router)
})

describe('POST /api/pricehawk/products', () => {
  it('returns 400 when niche missing', async () => {
    const r = await request(app).post('/api/pricehawk/products').send({})
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/niche/)
  })

  it('returns 500 when FIRECRAWL_API_KEY missing', async () => {
    delete process.env.FIRECRAWL_API_KEY
    const r = await request(app).post('/api/pricehawk/products').send({ niche: 'earbuds', budget: '2000' })
    expect(r.status).toBe(500)
    process.env.FIRECRAWL_API_KEY = 'test-key'
  })
})

describe('GET /api/pricehawk/products/:slug', () => {
  it('returns 404 for non-existent slug', async () => {
    const r = await request(app).get('/api/pricehawk/products/nonexistent-slug-xyz')
    expect(r.status).toBe(404)
  })
})
