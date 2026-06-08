// scripts/lib/schema.js

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function reviewSchema({ name, brand, catLabel, catSlug, link, faqs, asinSlug }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Review',
        name: `${name} Review`,
        reviewBody: `${name} — ${catLabel} review for Indian buyers.`,
        author: { '@type': 'Organization', name: 'PriceHawk' },
        publisher: { '@type': 'Organization', name: 'PriceHawk', url: 'https://pricehawk.in' },
        datePublished: new Date().toISOString().split('T')[0],
        itemReviewed: {
          '@type': 'Product',
          name,
          brand: { '@type': 'Brand', name: brand },
          category: catLabel,
          offers: {
            '@type': 'Offer',
            url: link,
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: 'Amazon India' },
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pricehawk.in/' },
          { '@type': 'ListItem', position: 2, name: `Best ${catLabel}s in India`, item: `https://pricehawk.in/best-${catSlug}/` },
          { '@type': 'ListItem', position: 3, name: `${name} Review`, item: `https://pricehawk.in/${asinSlug}/` },
        ],
      },
      ...(faqs.length ? [{
        '@type': 'FAQPage',
        mainEntity: faqs.map(([q, a]) => ({
          '@type': 'Question', name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      }] : []),
    ],
  }
}

function comparisonSchema({ name1, name2, catLabel, catSlug, link1, link2, faqs, slug }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: `${name1} vs ${name2} — ${catLabel} Comparison`,
        description: `Detailed specification comparison of ${name1} and ${name2} for Indian buyers.`,
        numberOfItems: 2,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: name1, url: link1 },
          { '@type': 'ListItem', position: 2, name: name2, url: link2 },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pricehawk.in/' },
          { '@type': 'ListItem', position: 2, name: `Best ${catLabel}s in India`, item: `https://pricehawk.in/best-${catSlug}/` },
          { '@type': 'ListItem', position: 3, name: `${name1} vs ${name2}`, item: `https://pricehawk.in/${slug}/` },
        ],
      },
      ...(faqs.length ? [{
        '@type': 'FAQPage',
        mainEntity: faqs.map(([q, a]) => ({
          '@type': 'Question', name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      }] : []),
    ],
  }
}

function guideSchema({ catLabel, catSlug, slug, products }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: `Best ${catLabel} in India`,
        numberOfItems: products.length,
        itemListElement: products.map((p, i) => ({
          '@type': 'ListItem', position: i + 1, name: p.name, url: p.link,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://pricehawk.in/' },
          { '@type': 'ListItem', position: 2, name: `Best ${catLabel} in India`, item: `https://pricehawk.in/${slug}/` },
        ],
      },
    ],
  }
}

module.exports = { reviewSchema, comparisonSchema, guideSchema, slugify }
