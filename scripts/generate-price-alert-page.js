// scripts/generate-price-alert-page.js
require('dotenv').config()
const { makeAuth, wpUpsertPage } = require('./lib/wp')
const { asciDisclosure } = require('./lib/content')

const WP   = (process.env.WORDPRESS_URL || '').replace(/\/$/, '')
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD
const AUTH = makeAuth(USER, PASS)

const YEAR = new Date().getFullYear()

// Replace with your Formspree form ID from formspree.io
const FORMSPREE_ACTION = process.env.FORMSPREE_ACTION || 'https://formspree.io/f/REPLACE_WITH_YOUR_FORM_ID'

function buildAlertPageHTML() {
  return `${asciDisclosure()}

<div style="max-width:560px;margin:0 auto;padding:20px 0;">

<h1 style="font-size:24px;font-weight:700;margin:0 0 12px;line-height:1.3;">Get Notified When Prices Drop</h1>
<p style="font-size:16px;color:#444;line-height:1.7;margin:0 0 24px;">
PriceHawk tracks prices on 1,900+ kitchen appliances across Amazon India every day.
Leave your email and we'll alert you when a product you're watching drops to its lowest price.
</p>

<div style="background:#fff8e1;border-left:4px solid #f9a825;padding:12px 16px;font-size:14px;margin:0 0 24px;">
<strong>Launching August 2026.</strong> Sign up now to be first in line when price-drop alerts go live.
</div>

<form action="${FORMSPREE_ACTION}" method="POST" style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:24px;">
  <div style="margin-bottom:16px;">
    <label for="email" style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:#333;">Your Email Address</label>
    <input type="email" id="email" name="email" required placeholder="yourname@email.com"
           style="width:100%;box-sizing:border-box;padding:10px 14px;font-size:15px;border:1px solid #ccc;border-radius:4px;outline:none;">
  </div>
  <div style="margin-bottom:16px;">
    <label for="category" style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:#333;">Most interested in (optional)</label>
    <select id="category" name="category" style="width:100%;padding:10px 14px;font-size:15px;border:1px solid #ccc;border-radius:4px;background:#fff;">
      <option value="">— Select category —</option>
      <option value="air-fryers">Air Fryers</option>
      <option value="mixer-grinders">Mixer Grinders</option>
      <option value="coffee-machines">Coffee Machines</option>
      <option value="induction-cooktops">Induction Cooktops</option>
      <option value="electric-kettles">Electric Kettles</option>
      <option value="food-processors">Food Processors</option>
      <option value="hand-blenders">Hand Blenders</option>
      <option value="sandwich-makers">Sandwich Makers</option>
      <option value="rice-cookers">Rice Cookers</option>
    </select>
  </div>
  <button type="submit"
          style="width:100%;background:#e65100;color:#fff;border:none;padding:12px;font-size:16px;font-weight:700;border-radius:4px;cursor:pointer;">
    Notify me when prices drop →
  </button>
  <p style="font-size:12px;color:#999;margin:12px 0 0;text-align:center;">No spam. Unsubscribe any time. Price alerts only.</p>
  <input type="hidden" name="_subject" value="PriceHawk Alert Signup">
  <input type="hidden" name="_next" value="https://pricehawk.in/alert-confirmed/">
</form>

<div style="margin:32px 0;padding:20px;background:#f5f5f5;border-radius:6px;">
<h3 style="font-size:16px;font-weight:700;margin:0 0 12px;">How PriceHawk price alerts work</h3>
<ul style="font-size:14px;line-height:1.8;color:#444;margin:0;padding-left:20px;">
  <li>We track prices on 1,900+ products on Amazon India every day</li>
  <li>When a product hits its lowest tracked price, we send you one email</li>
  <li>No promotional emails, no brand partnerships — price data only</li>
  <li>Each alert includes the product, the current price, and a direct Amazon link</li>
</ul>
</div>

</div>`
}

async function main() {
  const args   = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  if (!WP || !USER || !PASS) { console.error('Missing WP credentials in .env'); process.exit(1) }

  const slug  = 'get-price-alerts'
  const title = `Get Price Drop Alerts — PriceHawk ${YEAR}`
  const metaDesc = 'Sign up for free price drop alerts on kitchen appliances in India. PriceHawk tracks 1,900+ products on Amazon India daily.'
  const html  = buildAlertPageHTML()

  if (dryRun) { console.log(`[dry] ${slug}`); return }

  const result = await wpUpsertPage({ title, slug, content: html }, { wp: WP, auth: AUTH, dryRun, metaDesc })
  if (result) {
    console.log(`✓ [${result.action}] ID ${result.id}`)
    console.log(`  Draft: ${result.link}`)
    console.log(`\nNext steps:`)
    console.log(`  1. Create free Formspree account at https://formspree.io`)
    console.log(`  2. Set FORMSPREE_ACTION=https://formspree.io/f/YOUR_FORM_ID in .env`)
    console.log(`  3. Re-run this script to update the form action`)
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
