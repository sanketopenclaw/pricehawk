const { Router } = require('express')
const OpenAI = require('openai')
const path = require('path')

const router = Router()

const PRICEHAWK_CONFIG = require(path.join(__dirname, '../config/pricehawk.json'))

const VALID_CONTENT_TYPES = ['guide', 'comparison', 'deals', 'pricedrop', 'review']

const BRAND_VOICE = `You are a helpful, analytical, consumer-first shopping advisor for PriceHawk — India's trusted price tracking platform.
Rules:
- Never hype products or use fake urgency ("limited time", "hurry", "act now" are banned)
- Never recommend based on affiliate commission alone
- Act like an intelligent friend helping someone spend money wisely in India
- Always cite real specs, real ₹ prices, real review counts
- Use Indian context: monsoon durability, Indian voltage (230V), local brand familiarity (boAt, Noise, Redmi)
- Validate mentally: "Would a real Indian shopper find this useful?" — if no, rewrite`

function validateContent(content, type) {
  const wordCount = content.split(/\s+/).length
  const limits = { guide: [2000, 4000], comparison: [1200, 3000], deals: [600, 1500], pricedrop: [300, 800], review: [1200, 2500] }
  const [min, max] = limits[type] || [500, 5000]
  if (wordCount < min) throw new Error(`Content too short: ${wordCount} words (min ${min})`)
  if (/limited time offer|hurry now|act now|don.t miss/i.test(content)) {
    throw new Error('Brand voice violation: fake urgency detected')
  }
  return { passed: true, word_count: wordCount }
}

function buildSchema(contentType, title, products, niche) {
  const today = new Date().toISOString().split('T')[0]
  const base = {
    '@context': 'https://schema.org',
    '@type': contentType === 'review' ? 'Review' : 'Article',
    headline: title,
    dateModified: today,
    author: { '@type': 'Organization', name: 'PriceHawk', url: 'https://pricehawk.in' },
    publisher: { '@type': 'Organization', name: 'PriceHawk' }
  }
  if (contentType === 'guide' && products.length) {
    base.about = {
      '@type': 'ItemList',
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.name
      }))
    }
  }
  return base
}

function buildPrompt(contentType, { niche, budget, products = [], keyword, research = null }) {
  const effectiveKeyword = keyword || `Best ${niche} Under ₹${budget}`
  const productList = products.map((p, i) =>
    `${i + 1}. ${p.name} — ₹${p.price_inr || 'N/A'} | ${p.rating || 'N/A'}★ | ${p.reviews ? p.reviews.toLocaleString('en-IN') : 'N/A'} reviews | ${p.badge || ''}`
  ).join('\n')

  // Inject competitive intelligence when available from research agent
  const competitiveContext = research ? `
COMPETITIVE INTELLIGENCE (from scraping top ${research.competitors_scraped?.length || 0} competitor articles):
- Topics competitors cover well: ${(research.topics_covered || []).join(', ') || 'N/A'}
- Topics competitors MISSED (cover these to win): ${(research.topics_missing || []).join(', ') || 'N/A'}
- Competitor weak spots: ${(research.weak_spots || []).join(', ') || 'N/A'}
- Average competitor word count: ${research.avg_word_count || 'N/A'} words — write at least ${research.min_word_count || 2500}
- Winning angle: ${research.content_angle || 'N/A'}
- Suggested H2 structure: ${(research.suggested_h2s || []).join(' → ') || 'use standard guide structure'}

USE THIS INTELLIGENCE: Cover all topics competitors missed. Follow the suggested H2 structure. Exploit every weak spot listed above.
` : ''

  switch (contentType) {
    case 'guide':
      return `${BRAND_VOICE}
${competitiveContext}
Write a comprehensive buying guide: "${effectiveKeyword}"

Products to cover (use real data):
${productList || '(No products provided — write general guide)'}

Structure (mandatory):
# [Title with ₹ budget and current year]
_Last Updated: ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}_

## Quick Answer (first 100 words — name top pick + key stat, direct answer)

## Comparison Table
| Product | Price | Rating | Reviews | Best For | Our Score |

## [Product Name] — H2 per product
### Overview
### Key Specs (table)
### Pros
### Cons
### Verdict (2-3 sentences)
[AFFILIATE LINK: ${niche.toUpperCase()}_PRODUCT_N]

## FAQ (6-8 questions, 40-60 word answers each)

## Author Bio (E-E-A-T signal)

Word count: ${research?.min_word_count || 2500}-${(research?.min_word_count || 2500) + 1000}. No keyword stuffing. No fake urgency.`

    case 'comparison':
      return `${BRAND_VOICE}

Write a detailed head-to-head comparison article: "${effectiveKeyword}"

Products to compare:
${productList || '(No products provided — write general comparison template)'}

Structure (mandatory):
# [Product A] vs [Product B]: Which Should You Buy in India?
_Last Updated: ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}_

## TL;DR — Quick Verdict (100 words, clear winner for each use case)

## Side-by-Side Specs Table
| Feature | [Product A] | [Product B] |

## [Product A] — Deep Dive
### Build & Design
### Sound/Performance
### Battery Life
### Value for Money

## [Product B] — Deep Dive
(same structure)

## Who Should Buy [Product A]?
## Who Should Buy [Product B]?

## Our Final Verdict

## FAQ (4-6 questions)

Word count: 1500-2500. Balanced, not biased toward higher-priced option.`

    case 'deals':
      return `${BRAND_VOICE}

Write a deals roundup post: "Best ${niche} Deals This Week in India"

Products/Deals to feature:
${productList || '(No products provided — write general deals template with placeholder examples)'}

Structure (mandatory):
# Best ${niche} Deals This Week — Up to [X]% Off on Amazon & Flipkart
_Updated: ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}_

## Why These Deals Are Worth It (2-3 sentences, factual context — no hype)

## Deal #N — [Product Name]
- **Price:** ₹X (was ₹Y)
- **Discount:** X%
- **Where:** Amazon.in / Flipkart
- **Why it's good value:** (2-3 sentences with real specs)
- **Who should buy:** (specific use case)
[DEAL LINK: ${niche.toUpperCase()}_DEAL_N]

(Repeat for each deal)

## Deals We Skipped (and Why)
## Price Tracking Tip

Word count: 800-1200. Factual, no urgency language.`

    case 'pricedrop':
      return `${BRAND_VOICE}

Write a price drop alert post for: ${products[0]?.name || niche}

Product details:
${productList || `Product: ${niche}, Budget range: ₹${budget || 'N/A'}`}

Structure (mandatory):
# [Product Name] Price Drops to ₹[Price] — Is It Worth Buying Now?
_Alert: ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}_

## The Drop (factual, no hype)
- Previous price: ₹X
- Current price: ₹Y
- Discount: X%
- Available at: [platform]

## Quick Verdict (is this a good price historically?)

## Key Specs Reminder (bullet points, 5-6 specs)

## Who Should Buy at This Price?

## Price History Context (1-2 sentences)

[PRODUCT LINK: ${niche.toUpperCase()}_PRICEDROP]

Word count: 400-600. Tone: calm and analytical, like a knowledgeable friend.`

    case 'review':
      return `${BRAND_VOICE}

Write a comprehensive product review: ${products[0]?.name || niche}

Product details:
${productList || `Product: ${niche}, Budget: ₹${budget || 'N/A'}`}

Structure (mandatory):
# [Product Name] Review: Honest Assessment After [X] Days of Use
_Reviewed: ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}_

## Review Summary (rating out of 10, 3-sentence verdict)

## Unboxing & First Impressions

## Build Quality & Design

## Performance (core use case — sound quality / camera / battery / etc.)

## Full Specs Table

## Real-World Usage
### [Use Case 1]
### [Use Case 2]

## Pros (bullet points, specific)
## Cons (bullet points, specific — include at least 2 genuine cons)

## Who Should Buy This?
## Who Should Skip This?

## Verdict & Rating
| Category | Score |
| Build | /10 |
| Performance | /10 |
| Value | /10 |
| Overall | /10 |

## FAQ (4-5 questions)

[BUY LINK: ${niche.toUpperCase()}_REVIEW]

Word count: 1500-2000. Honest — include real cons.`
  }
}

router.post('/content', async (req, res) => {
  const { content_type, niche, budget, products = [], keyword, research = null } = req.body

  if (!content_type) {
    return res.status(400).json({ error: 'content_type required' })
  }
  if (!VALID_CONTENT_TYPES.includes(content_type)) {
    return res.status(400).json({ error: `content_type must be one of: ${VALID_CONTENT_TYPES.join(', ')}` })
  }
  if (!niche) {
    return res.status(400).json({ error: 'niche required' })
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (!openrouterKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' })
  }

  const prompt = buildPrompt(content_type, { niche, budget, products, keyword, research })
  const title = keyword || `Best ${niche}${budget ? ` Under ₹${budget}` : ''}`

  try {
    const client = new OpenAI({
      apiKey: openrouterKey,
      baseURL: 'https://openrouter.ai/api/v1',
    })

    const model = process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free'

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }]
    })

    const content = completion.choices[0]?.message?.content || ''

    let validation
    try {
      validation = validateContent(content, content_type)
    } catch (err) {
      return res.status(422).json({ error: err.message, content_type, title })
    }

    const wordCount = validation.word_count
    const metaDescription = content.replace(/[#*`\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 155)
    const schema = buildSchema(content_type, title, products, niche)

    return res.json({
      content_type,
      title,
      content,
      word_count: wordCount,
      meta_description: metaDescription,
      schema,
      validation
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

module.exports = router
