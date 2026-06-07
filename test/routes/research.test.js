import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'

let app
beforeAll(async () => {
  process.env.FIRECRAWL_API_KEY = 'test-key'
  process.env.OPENROUTER_API_KEY = 'test-key'
  const router = (await import('../../routes/research.js')).default
  app = express()
  app.use(express.json())
  app.use('/api/pricehawk', router)
})

describe('POST /api/pricehawk/research', () => {
  it('returns 400 when niche missing', async () => {
    const r = await request(app).post('/api/pricehawk/research').send({ budget: '2000' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/niche/)
  })

  it('returns 400 when niche invalid (too long)', async () => {
    const r = await request(app).post('/api/pricehawk/research').send({ niche: 'a'.repeat(60) })
    expect(r.status).toBe(400)
  })

  it('returns 500 when FIRECRAWL_API_KEY missing', async () => {
    delete process.env.FIRECRAWL_API_KEY
    const r = await request(app).post('/api/pricehawk/research').send({ niche: 'earbuds', budget: '2000' })
    expect(r.status).toBe(500)
    process.env.FIRECRAWL_API_KEY = 'test-key'
  })
})

describe('GET /api/pricehawk/research/opportunities', () => {
  it('returns array', async () => {
    const r = await request(app).get('/api/pricehawk/research/opportunities')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.body.opportunities)).toBe(true)
  })
})
