# PriceHawk Review Page Template

**Generator:** `scripts/generate-reviews.js`  
**WP post type:** `posts` (status: `draft`)  
**Slug pattern:** `{brand}-{product-model-words}-review` (e.g. `ninja-air-fryer-max-pro-6-2l-review`)  
**Title pattern:** `{Short Name} Review — Worth Buying in India {YEAR}?`

---

## Page Section Order

| # | Section | Function/Source | Data required | Fallback |
|---|---------|----------------|---------------|----------|
| 1 | ASCI affiliate disclosure | `asciDisclosure()` | — | always shown |
| 2 | Breadcrumb nav | inline | catSlug, catLabel | — |
| 3 | H1 title | inline | verdictName, YEAR | — |
| 4 | Verdict box | `verdictBox()` | seg, whoFor, keyStrength, link | — |
| 5 | Updated line | `updatedLine()` | — | — |
| 6 | TOC | `tocBlock()` | section IDs present | omits missing sections |
| 7 | Intro paragraph | `buildIntro()` + `reviewIntroLead()` | specs, catLabel, seg | generic |
| 8 | Body copy | `CAT_BODY[catSlug]()` | catSlug match | omitted |
| 9 | Header card | inline | `_legacy.img`, name, brand, sparkline | no image if absent |
| 10 | **Product Gallery** | `productImageGallery()` | `_legacy.images[]` ≥2 | omitted if <2 images |
| 11 | Pros / Cons | `prosConsBlock()` | comparison vs categoryProducts | omitted if empty |
| 12 | How It Stacks Up | `howItStacksUp()` | categoryProducts | omitted |
| 13 | What Makes This Stand Out | `featureHighlights()` | specs._features | omitted |
| 14 | **In Your Kitchen** | `buildInYourKitchen()` | capacity, wattage, ctrl, features | omitted if no specs |
| 15 | **Key Specs Explained** | `buildSpecsExplained()` | wattage, capacity, ctrl, temp, material | omitted if no specs |
| 16 | Who Should Buy This | `buildWhoShouldBuy()` | specs, catLabel, features | generic bullets |
| 17 | Can't Tell You | `cantTellYouBlock()` | catLabel | always shown |
| 18 | Full Specifications | `specsAccordion()` | specifications (non-_prefixed) | placeholder text |
| 19 | **What Amazon Reviewers Say** | `reviewsBlock()` | reviews, rating, review_count | omitted if no reviews |
| 20 | Methodology block | `methodologyBlock()` | product name | always shown |
| 21 | Track Price CTA | inline | link | always shown |
| 22 | Telegram CTA | `telegramCTA()` | — | always shown |
| 23 | Ready to Buy CTA | inline | link | always shown |
| 24 | FAQ | inline `<details>` | `CAT_FAQS[catSlug]` | omitted |
| 25 | Related Links | `relatedLinks()` | slugIndex, catSlug | hub link at minimum |
| 26 | Schema JSON-LD | `reviewSchema()` | name, brand, faqs, asinSlug | — |

---

## Component Specs

### Product Gallery (`productImageGallery`)
- Source: `product._legacy.images[]` (array of full-res Amazon CDN URLs)
- Min 2 images to render; single image skipped (already shown in header card)
- Format: horizontal scroll row, each tile 160×160, `background:#141414 border:#2a2a2a`
- Images upsized to `_SL500_` when scraping from Amazon
- To add images: Firecrawl ASIN page → extract imageUrls → strip size suffix → append `._SL500_.jpg` → verify loads → store in `_legacy.images[]`

### What Amazon Reviewers Say (`reviewsBlock`)
- Sentiment summary: 2-3 sentences synthesised from `star_distribution`, `sentiment_score`, `feature_highlights`, `top_positive`, `top_critical`
- Star bars: 5→1 star, orange fill if ≥50%, grey otherwise
- Buyer highlights: `_cleanHighlights()` filters URL junk, short fragments, raw platform strings
- Review cards: `_cleanReviewText()` strips Amazon mobile UI boilerplate prefix
- Compliance footer: "Based on Amazon India customer reviews. PriceHawk has not independently verified these claims."

### In Your Kitchen (`buildInYourKitchen`)
- Up to 4 scenario cards: family size (from capacity), weeknight speed (from wattage), preset/controls, defrost/keep-warm
- Each card: dark `#1a1a1a` bg, heading + 1-2 sentence scenario
- Sub-label: "Concrete scenarios based on the documented specs — not a lab test."

### Key Specs Explained (`buildSpecsExplained`)
- 3-column table: spec name (mono) · value (saffron accent) · plain-language explanation
- Covers: wattage, capacity, controls, temperature range, basket coating
- Wattage thresholds: ≥2000W = high, ≥1500W = standard, <1500W = lower
- Capacity thresholds: ≥6L = large family, ≥4L = mid, <4L = compact

---

## Slug Rules

```
rawName = product_name OR _legacy.name
nameForSlug = rawName
  .strip (AF180IN...) and [...]    // parentheticals
  .strip at pipe |                  // "Product Name | Spec" pattern
  .strip at wattage (if ≥3 words remain)  // "2000W Digital..." suffix
  .take first 6 words
slug = slugify(nameForSlug) + '-review'
```

Examples:
- `ninja-air-fryer-max-pro-6-2l-review`
- `philips-air-fryer-na120-00-review`
- `havells-prolife-crystal-digital-air-fryer-review`

---

## Data Requirements per Product

```
product._legacy.asin          — required (queue key)
product._legacy.name          — required (display name)
product._legacy.img           — header card image
product._legacy.images[]      — gallery (optional, needs manual Firecrawl scrape)
product._legacy.rating        — reviews section (e.g. 4.6)
product._legacy.review_count  — reviews section (e.g. 1868)
product.brand_id              — slug, breadcrumb
product.price_segment         — verdict box, specs table colour
product.specifications{}      — all content sections
product.specifications._features[] — highlights, kitchen scenarios
product.reviews.star_distribution  — star bars
product.reviews.sentiment_score    — sentiment chip
product.reviews.feature_highlights — buyer highlights (filtered)
product.reviews.top_positive{}     — review card
product.reviews.top_critical{}     — review card
product.offers[].affiliate_url     — all CTAs
product.product_id            — sparkline, price tracking note
```

---

## Compliance Checklist

- [ ] ASCI disclosure above fold (section 1)
- [ ] Methodology block present (section 20) — "PriceHawk has not independently lab-tested this unit"
- [ ] No scraped Amazon prices displayed (no `current_price` / `mrp` in HTML)
- [ ] No star ratings displayed as PriceHawk's own (only in "Amazon Reviewers" section with disclaimer)
- [ ] All Amazon links: `rel="nofollow sponsored noopener"` + `target="_blank"`
- [ ] Status: `draft` always — never auto-publish
- [ ] Affiliate link uses `tag=` parameter from `offers[].affiliate_url`
