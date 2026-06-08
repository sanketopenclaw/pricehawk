const { Router } = require('express')
const axios = require('axios')
const path = require('path')

const router = Router()

const PH_CONFIG = require(path.join(__dirname, '../config/pricehawk.json'))

const VALID_NETWORKS = ['amazon', 'earnkaro', 'cuelinks', 'auto']

const AMAZON_TAG = process.env.AMAZON_AFFILIATE_TAG || PH_CONFIG.amazon_affiliate_tag || 'pricehawkin-21'

const ALLOWED_AFFILIATE_HOSTS = new Set([
  'www.amazon.in', 'amazon.in',
  'www.flipkart.com', 'flipkart.com',
  'www.earnkaro.com', 'earnkaro.com',
  'cl.cuelinks.com',
])

function isSafeUrl(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return ALLOWED_AFFILIATE_HOSTS.has(u.hostname.toLowerCase().replace(/\.$/, ''))
  } catch {
    return false
  }
}

async function verifyLink(url) {
  if (!isSafeUrl(url)) return false
  try {
    const res = await axios.head(url, { timeout: 5000, maxRedirects: 0 })
    return res.status < 400
  } catch {
    return false
  }
}

async function buildAmazonUrl(product) {
  if (!product.asin) return null
  const tag = process.env.AMAZON_AFFILIATE_TAG || PH_CONFIG.amazon_affiliate_tag || 'pricehawkin-21'
  return `https://www.amazon.in/dp/${product.asin}?tag=${tag}`
}

async function buildEarnkaroUrl(product) {
  const baseUrl = product.flipkart_url || product.amazon_url || null
  if (!baseUrl || !isSafeUrl(baseUrl)) return null
  const apiKey = process.env.EARNKARO_API_KEY
  if (!apiKey) return baseUrl
  try {
    const res = await axios.post('https://api.earnkaro.com/v1/deeplink', { url: baseUrl, api_key: apiKey })
    return res.data?.short_url || res.data?.url || baseUrl
  } catch {
    return baseUrl
  }
}

async function buildCuelinksUrl(product) {
  const baseUrl = product.flipkart_url || product.amazon_url || null
  if (!baseUrl || !isSafeUrl(baseUrl)) return null
  const cid = process.env.CUELINKS_CID
  if (!cid) return baseUrl
  try {
    const encodedUrl = encodeURIComponent(baseUrl)
    const res = await axios.get(`https://cl.cuelinks.com/api/deeplink?url=${encodedUrl}&cid=${cid}`)
    return res.data?.short_url || res.data?.url || baseUrl
  } catch {
    return baseUrl
  }
}

async function buildUrl(product, network) {
  if (network === 'amazon') {
    return await buildAmazonUrl(product)
  }
  if (network === 'earnkaro') {
    return await buildEarnkaroUrl(product)
  }
  if (network === 'cuelinks') {
    return await buildCuelinksUrl(product)
  }
  // auto: use amazon if asin present, else earnkaro
  if (product.asin) {
    return await buildAmazonUrl(product)
  }
  return await buildEarnkaroUrl(product)
}

function effectiveNetwork(product, network) {
  if (network !== 'auto') return network
  return product.asin ? 'amazon' : 'earnkaro'
}

router.post('/monetize', async (req, res) => {
  const { content, products = [], network = 'auto' } = req.body

  if (!content) {
    return res.status(400).json({ error: 'content is required' })
  }

  if (!VALID_NETWORKS.includes(network)) {
    return res.status(400).json({ error: `network must be one of: ${VALID_NETWORKS.join(', ')}` })
  }

  const placeholders = [...content.matchAll(/\[AFFILIATE LINK:\s*([A-Z0-9_]+)\]/g)]

  if (placeholders.length === 0) {
    return res.json({
      content,
      links_inserted: 0,
      network_used: network,
      links: []
    })
  }

  const links = []
  let result = content

  for (const match of placeholders) {
    const [fullMatch, key] = match
    const indexStr = key.match(/_(\d+)$/)?.[1]
    const idx = indexStr ? parseInt(indexStr) - 1 : 0
    const product = products[idx] || products[0]

    if (!product) {
      continue
    }

    const url = await buildUrl(product, network)
    if (!url) continue

    const verified = await verifyLink(url)
    const usedNetwork = effectiveNetwork(product, network)

    links.push({
      placeholder: key,
      product: product.name,
      url,
      verified,
      network: usedNetwork
    })

    const imgMd = product.image_url ? `![${product.name}](${product.image_url})\n\n` : ''
    result = result.replace(fullMatch, `${imgMd}[${product.name}](${url})`)
  }

  return res.json({
    content: result,
    links_inserted: links.length,
    network_used: network,
    links
  })
})

module.exports = router
