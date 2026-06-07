import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'

let app
beforeAll(async () => {
  process.env.OPENROUTER_API_KEY = 'test-key'
  const router = (await import('../../routes/content.js')).default
  app = express()
  app.use(express.json())
  app.use('/api/pricehawk', router)
})

describe('POST /api/pricehawk/content', () => {
  it('returns 400 when content_type missing', async () => {
    const r = await request(app).post('/api/pricehawk/content').send({ niche: 'earbuds' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/content_type/)
  })

  it('returns 400 when content_type invalid', async () => {
    const r = await request(app).post('/api/pricehawk/content').send({ content_type: 'invalid', niche: 'earbuds' })
    expect(r.status).toBe(400)
  })

  it('returns 400 when niche missing', async () => {
    const r = await request(app).post('/api/pricehawk/content').send({ content_type: 'guide' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/niche/)
  })

  it('returns 500 when OPENROUTER_API_KEY missing', async () => {
    delete process.env.OPENROUTER_API_KEY
    const r = await request(app).post('/api/pricehawk/content').send({ content_type: 'guide', niche: 'earbuds', budget: '2000', products: [] })
    expect(r.status).toBe(500)
    process.env.OPENROUTER_API_KEY = 'test-key'
  })
})
