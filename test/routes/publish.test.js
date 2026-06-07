import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'

let app
beforeAll(async () => {
  process.env.WORDPRESS_URL = 'http://pricehawk.in'
  process.env.WORDPRESS_USERNAME = 'test'
  process.env.WORDPRESS_APP_PASSWORD = 'test'
  const router = (await import('../../routes/publish.js')).default
  app = express()
  app.use(express.json())
  app.use('/api/pricehawk', router)
})

describe('POST /api/pricehawk/publish', () => {
  it('returns 400 when title missing', async () => {
    const r = await request(app).post('/api/pricehawk/publish').send({ content: 'hello' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/title/)
  })

  it('returns 400 when content missing', async () => {
    const r = await request(app).post('/api/pricehawk/publish').send({ title: 'test' })
    expect(r.status).toBe(400)
    expect(r.body.error).toMatch(/content/)
  })

  it('returns 500 when WORDPRESS_URL missing', async () => {
    delete process.env.WORDPRESS_URL
    const r = await request(app).post('/api/pricehawk/publish').send({ title: 'test', content: 'hello' })
    expect(r.status).toBe(500)
    process.env.WORDPRESS_URL = 'http://pricehawk.in'
  })
})

describe('GET /api/pricehawk/publish/status', () => {
  it('returns connected true when env set', async () => {
    const r = await request(app).get('/api/pricehawk/publish/status')
    expect(r.status).toBe(200)
    expect(r.body.connected).toBe(true)
    expect(r.body.url).toBe('http://pricehawk.in')
  })
})
