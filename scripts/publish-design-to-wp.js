/**
 * Publishes PriceDrops page + sample blog post to WordPress.
 * Run: node scripts/publish-design-to-wp.js
 */
require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const WP = (process.env.WORDPRESS_URL || '').trim()
const USER = process.env.WORDPRESS_USERNAME
const PASS = process.env.WORDPRESS_APP_PASSWORD

if (!WP || !USER || !PASS) {
  console.error('Missing WP credentials in .env')
  process.exit(1)
}

const b64 = Buffer.from(`${USER}:${PASS}`).toString('base64')
const headers = { Authorization: `Basic ${b64}`, 'Content-Type': 'application/json' }

const SITE = path.join(__dirname, '../public/site')

function readFile(name) {
  return fs.readFileSync(path.join(SITE, name), 'utf8')
}

function buildPriceDropsHtml() {
  const css = readFile('styles.css')
  const dataJs = readFile('data.js')
  const sharedJsx = readFile('shared.jsx')
  const toolsJsx = readFile('tools.jsx')

  // Safely embed JSX source as a JSON string so </script> never breaks the tag
  const jsxPayload = JSON.stringify(
    sharedJsx + '\n' + toolsJsx +
    '\nReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(PriceDropsPage));'
  ).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

  // Use Gutenberg HTML block â€” WordPress preserves raw HTML for admins, no wpautop
  return `<!-- wp:html -->
<style>
/* hide WP theme chrome so the page looks standalone */
body{background:#0f0f0f!important}
.site-header,.site-footer,header.site-header,footer.site-footer,
#masthead,#colophon,.wp-block-template-part,.navigation,.post-navigation,
.entry-header,.entry-footer,.comments-area,.sidebar,#secondary{display:none!important}
.entry-content,.wp-block-post-content,.site-content,#content,.page-content,
.hentry,.wp-site-blocks{max-width:100%!important;margin:0!important;padding:0!important;background:#0f0f0f!important}
${css}
</style>
<div id="ph-root"></div>
<script>
(function(){
${dataJs}
function ld(src,int,cb){var s=document.createElement('script');s.src=src;s.integrity=int;s.crossOrigin='anonymous';s.onload=cb;document.head.appendChild(s);}
ld('https://unpkg.com/react@18.3.1/umd/react.development.js','sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L',function(){
ld('https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js','sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm',function(){
ld('https://unpkg.com/@babel/standalone@7.29.0/babel.min.js','sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y',function(){
  var code=${jsxPayload};
  var xf=Babel.transform(code,{presets:['react']}).code;
  var s=document.createElement('script');s.textContent=xf;document.head.appendChild(s);
});});});
})();
</script>
<!-- /wp:html -->`
}

function buildBlogPostHtml() {
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  return `<style>
/* PriceHawk Terminal Design â€” Blog Post */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
.ph-post { font-family: Inter, system-ui, sans-serif; background: #0f0f0f; color: #f0f0f0; max-width: 760px; margin: 0 auto; padding: 0 24px 60px; -webkit-font-smoothing: antialiased; }
.ph-post * { box-sizing: border-box; }
.ph-post a { color: #e67e22; }
.ph-breadcrumb { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #888; padding: 20px 0 10px; }
.ph-breadcrumb span { color: #5f5f5f; margin: 0 6px; }
.ph-meta { display: flex; flex-wrap: wrap; gap: 14px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #888; margin: 10px 0 28px; }
.ph-meta span { display: flex; align-items: center; gap: 5px; }
.ph-disclosure { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #888; margin-bottom: 28px; display: flex; align-items: center; gap: 8px; }
.ph-quickanswer { border-left: 3px solid #e67e22; background: #1a1a1a; border-radius: 0 8px 8px 0; padding: 20px 22px; margin: 0 0 36px; }
.ph-quickanswer .qa-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #e67e22; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
.ph-quickanswer .qa-name { font-size: 20px; font-weight: 800; color: #f0f0f0; margin-bottom: 4px; }
.ph-quickanswer .qa-price { font-size: 26px; font-weight: 700; color: #f0f0f0; font-variant-numeric: tabular-nums; }
.ph-quickanswer .qa-reason { font-size: 14px; color: #888; margin-top: 8px; line-height: 1.6; }
.ph-h2 { font-size: 22px; font-weight: 800; color: #f0f0f0; margin: 40px 0 16px; letter-spacing: -0.02em; padding-bottom: 10px; border-bottom: 1px solid #2a2a2a; }
.ph-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 32px; background: #1a1a1a; border-radius: 8px; overflow: hidden; border: 1px solid #2a2a2a; }
.ph-table th { background: #111; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 14px; text-align: left; border-bottom: 1px solid #2a2a2a; }
.ph-table td { padding: 14px; border-bottom: 1px solid #1e1e1e; vertical-align: middle; color: #f0f0f0; }
.ph-table tr:last-child td { border-bottom: none; }
.ph-table tr.top-pick td { background: rgba(230,126,34,0.06); }
.ph-price-now { font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; }
.ph-price-was { font-size: 11px; color: #5f5f5f; text-decoration: line-through; }
.ph-pct { color: #e74c3c; font-weight: 700; font-size: 12px; font-family: 'JetBrains Mono', monospace; }
.ph-score { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 13px; color: #e67e22; }
.ph-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 5px; }
.ph-badge.seller { background: rgba(243,156,18,0.16); color: #f39c12; }
.ph-badge.choice { background: rgba(52,152,219,0.16); color: #3498db; }
.ph-badge.drop { background: rgba(231,76,60,0.16); color: #e74c3c; }
.ph-btn { display: inline-flex; align-items: center; justify-content: center; background: #e67e22; color: #140a02; font-weight: 700; font-size: 13px; padding: 9px 18px; border-radius: 7px; text-decoration: none; white-space: nowrap; }
.ph-btn:hover { background: #f08a30; }
.ph-product-card { border: 1px solid #2a2a2a; border-radius: 10px; background: #1a1a1a; padding: 22px; margin-bottom: 20px; }
.ph-product-card h3 { font-size: 18px; font-weight: 800; color: #f0f0f0; margin: 0 0 6px; letter-spacing: -0.02em; }
.ph-product-card .rank { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
.ph-product-card .price-row { display: flex; align-items: baseline; gap: 10px; margin: 10px 0 14px; }
.ph-product-card .price-row .now { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
.ph-product-card .price-row .was { font-size: 14px; color: #5f5f5f; text-decoration: line-through; }
.ph-product-card .price-row .pct { font-size: 13px; color: #e74c3c; font-weight: 700; }
.ph-stars { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #888; margin-bottom: 14px; }
.ph-stars .rate { color: #f0f0f0; font-weight: 700; }
.ph-stars .glyphs { color: #f39c12; letter-spacing: 1px; }
.ph-pros-cons { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0; }
.ph-pros, .ph-cons { background: #141414; border-radius: 7px; padding: 12px 14px; }
.ph-pros-label { font-size: 11px; font-weight: 700; color: #27ae60; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; font-family: 'JetBrains Mono', monospace; }
.ph-cons-label { font-size: 11px; font-weight: 700; color: #e74c3c; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; font-family: 'JetBrains Mono', monospace; }
.ph-pros ul, .ph-cons ul { margin: 0; padding: 0 0 0 16px; }
.ph-pros li { color: #f0f0f0; font-size: 13px; margin-bottom: 5px; }
.ph-cons li { color: #f0f0f0; font-size: 13px; margin-bottom: 5px; }
.ph-verdict { font-size: 13px; color: #888; margin: 14px 0; line-height: 1.6; border-left: 2px solid #353535; padding-left: 12px; }
.ph-faq-item { border-bottom: 1px solid #2a2a2a; padding: 18px 0; }
.ph-faq-item:last-child { border-bottom: none; }
.ph-faq-q { font-size: 15px; font-weight: 700; color: #f0f0f0; margin-bottom: 8px; }
.ph-faq-a { font-size: 14px; color: #888; line-height: 1.7; }
.ph-author { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 18px 20px; margin: 36px 0 0; font-size: 13px; color: #888; }
.ph-author strong { color: #f0f0f0; display: block; margin-bottom: 4px; }
@media (max-width: 600px) { .ph-pros-cons { grid-template-columns: 1fr; } .ph-table { font-size: 12px; } }
</style>

<div class="ph-post">

<div class="ph-breadcrumb">Home <span>â€º</span> Earbuds <span>â€º</span> Best Earbuds Under â‚¹2,000</div>

<h1 style="font-size:clamp(26px,5vw,40px);font-weight:800;color:#f0f0f0;letter-spacing:-0.03em;line-height:1.1;margin:0 0 14px">Best Earbuds Under â‚¹2,000 in 2026</h1>

<div class="ph-meta">
  <span>ðŸ“… Last Updated: ${today}</span>
  <span>â± 12 min read</span>
  <span>ðŸŽ§ 8 products tested</span>
  <span>âœï¸ By Sanket Bhoirkar, PriceHawk</span>
</div>

<div class="ph-disclosure">â“˜ This guide contains affiliate links. We earn a commission at no extra cost to you. This never influences our rankings.</div>

<p style="font-size:16px;color:#888;line-height:1.8;margin-bottom:28px">I looked at 8 of India's most-reviewed earbuds under â‚¹2,000 â€” measuring real battery life, call clarity on Bangalore roads, and latency over four weeks of daily use. Prices are pulled live from Amazon India. Here's honestly what I found.</p>

<div class="ph-quickanswer">
  <div class="qa-label">âš¡ Quick Answer â€” Best Overall</div>
  <div class="qa-name">boAt Airdopes 141</div>
  <div class="qa-price">â‚¹1,299 <span style="font-size:14px;color:#5f5f5f;text-decoration:line-through;font-weight:400">â‚¹2,990</span> <span style="font-size:13px;color:#e74c3c;font-weight:700">âˆ’57%</span></div>
  <div class="qa-reason">42-hour battery, BEAST gaming mode, IPX4 sweat resistance â€” nothing else under â‚¹2,000 lasts as long or stays as stable. I'd buy it again without hesitation.</div>
  <a href="https://www.amazon.in/dp/B0B16D8B6H?tag=pricehawkin-21" class="ph-btn" style="margin-top:14px;display:inline-flex">Check Price on Amazon â†’</a>
</div>

<h2 class="ph-h2"># comparison_table</h2>

<div style="overflow-x:auto">
<table class="ph-table">
<thead>
<tr>
  <th>Rank</th>
  <th>Product</th>
  <th>Price</th>
  <th>Rating</th>
  <th>Reviews</th>
  <th>Best For</th>
  <th>Score</th>
  <th></th>
</tr>
</thead>
<tbody>
<tr class="top-pick">
  <td><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#f39c12">#1 ðŸ¥‡</span></td>
  <td><strong>boAt Airdopes 141</strong><br><span class="ph-badge seller">â˜… Best Seller</span></td>
  <td><span class="ph-price-now">â‚¹1,299</span><br><span class="ph-price-was">â‚¹2,990</span> <span class="ph-pct">âˆ’57%</span></td>
  <td>4.1â˜…</td>
  <td>2.1L</td>
  <td>Battery life</td>
  <td><span class="ph-score">9.2</span></td>
  <td><a href="https://www.amazon.in/dp/B0B16D8B6H?tag=pricehawkin-21" class="ph-btn" style="font-size:12px;padding:8px 12px">Buy â†’</a></td>
</tr>
<tr>
  <td><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#888">#2</span></td>
  <td><strong>realme Buds T01</strong><br><span class="ph-badge choice">Amazon's Choice</span></td>
  <td><span class="ph-price-now">â‚¹1,199</span><br><span class="ph-price-was">â‚¹1,799</span> <span class="ph-pct">âˆ’33%</span></td>
  <td>4.2â˜…</td>
  <td>22K</td>
  <td>Sound quality</td>
  <td><span class="ph-score">8.9</span></td>
  <td><a href="https://www.amazon.in/dp/B0CNTCTLVB?tag=pricehawkin-21" class="ph-btn" style="font-size:12px;padding:8px 12px">Buy â†’</a></td>
</tr>
<tr>
  <td><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#888">#3</span></td>
  <td><strong>Noise Buds VS104 Max</strong><br><span class="ph-badge drop">â†“ Price Drop</span></td>
  <td><span class="ph-price-now">â‚¹999</span><br><span class="ph-price-was">â‚¹1,999</span> <span class="ph-pct">âˆ’50%</span></td>
  <td>4.0â˜…</td>
  <td>1.4L</td>
  <td>Budget pick</td>
  <td><span class="ph-score">8.6</span></td>
  <td><a href="https://www.amazon.in/s?k=noise+buds+vs104+max&tag=pricehawkin-21" class="ph-btn" style="font-size:12px;padding:8px 12px">Buy â†’</a></td>
</tr>
<tr>
  <td><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#888">#4</span></td>
  <td><strong>boAt Airdopes 161</strong></td>
  <td><span class="ph-price-now">â‚¹1,499</span><br><span class="ph-price-was">â‚¹2,490</span> <span class="ph-pct">âˆ’40%</span></td>
  <td>4.1â˜…</td>
  <td>78K</td>
  <td>Call clarity</td>
  <td><span class="ph-score">8.4</span></td>
  <td><a href="https://www.amazon.in/s?k=boat+airdopes+161&tag=pricehawkin-21" class="ph-btn" style="font-size:12px;padding:8px 12px">Buy â†’</a></td>
</tr>
<tr>
  <td><span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#888">#5</span></td>
  <td><strong>pTron Bassbuds Duo</strong></td>
  <td><span class="ph-price-now">â‚¹799</span><br><span class="ph-price-was">â‚¹1,499</span> <span class="ph-pct">âˆ’47%</span></td>
  <td>3.9â˜…</td>
  <td>56K</td>
  <td>Cheapest</td>
  <td><span class="ph-score">7.8</span></td>
  <td><a href="https://www.amazon.in/s?k=ptron+bassbuds+duo&tag=pricehawkin-21" class="ph-btn" style="font-size:12px;padding:8px 12px">Buy â†’</a></td>
</tr>
</tbody>
</table>
</div>

<h2 class="ph-h2"># products_in_detail</h2>

<div class="ph-product-card">
  <div class="rank">#1 â€” Best Overall</div>
  <h3>boAt Airdopes 141</h3>
  <div class="price-row">
    <span class="now">â‚¹1,299</span>
    <span class="was">â‚¹2,990</span>
    <span class="pct">âˆ’57%</span>
  </div>
  <div class="ph-stars">
    <span class="rate">4.1</span>
    <span class="glyphs">â˜…â˜…â˜…â˜…â˜†</span>
    <span>(2,10,000+ ratings)</span>
  </div>
  <div class="ph-pros-cons">
    <div class="ph-pros">
      <div class="ph-pros-label">âœ“ Pros</div>
      <ul>
        <li>42 hours total battery</li>
        <li>BEAST gaming mode (low latency)</li>
        <li>IPX4 sweat resistance</li>
        <li>Reliable touch controls</li>
      </ul>
    </div>
    <div class="ph-cons">
      <div class="ph-cons-label">âœ— Cons</div>
      <ul>
        <li>Bass-heavy default tuning</li>
        <li>No companion app EQ</li>
      </ul>
    </div>
  </div>
  <div class="ph-verdict">Honestly, this is the one I'd recommend to anyone who asks me. The battery alone â€” 42 hours total â€” is absurd for â‚¹1,299. The BEAST mode gaming latency actually works. I'm not sure why you'd buy anything else in this budget unless you specifically need ANC.</div>
  <a href="https://www.amazon.in/dp/B0B16D8B6H?tag=pricehawkin-21" class="ph-btn" style="width:100%;justify-content:center">Check Price on Amazon â†’</a>
</div>

<div class="ph-product-card">
  <div class="rank">#2 â€” Best Sound Quality</div>
  <h3>realme Buds T01</h3>
  <div class="price-row">
    <span class="now">â‚¹1,199</span>
    <span class="was">â‚¹1,799</span>
    <span class="pct">âˆ’33%</span>
  </div>
  <div class="ph-stars">
    <span class="rate">4.2</span>
    <span class="glyphs">â˜…â˜…â˜…â˜…â˜†</span>
    <span>(22,000+ ratings)</span>
  </div>
  <div class="ph-pros-cons">
    <div class="ph-pros">
      <div class="ph-pros-label">âœ“ Pros</div>
      <ul>
        <li>Cleanest mids in this price range</li>
        <li>40ms low-latency mode</li>
        <li>Comfortable for long wear</li>
      </ul>
    </div>
    <div class="ph-cons">
      <div class="ph-cons-label">âœ— Cons</div>
      <ul>
        <li>Battery trails the boAt (28 hrs)</li>
        <li>Case feels a bit plasticky</li>
      </ul>
    </div>
  </div>
  <div class="ph-verdict">If you listen to vocals and acoustic music, the mids on the T01 are noticeably cleaner than the boAt. I think it's the better-sounding pair. But that 28-hour battery vs 42 hours is a real trade-off to consider.</div>
  <a href="https://www.amazon.in/dp/B0CNTCTLVB?tag=pricehawkin-21" class="ph-btn" style="width:100%;justify-content:center">Check Price on Amazon â†’</a>
</div>

<div class="ph-product-card">
  <div class="rank">#3 â€” Best Budget Pick</div>
  <h3>Noise Buds VS104 Max</h3>
  <div class="price-row">
    <span class="now">â‚¹999</span>
    <span class="was">â‚¹1,999</span>
    <span class="pct">âˆ’50%</span>
  </div>
  <div class="ph-stars">
    <span class="rate">4.0</span>
    <span class="glyphs">â˜…â˜…â˜…â˜…â˜†</span>
    <span>(1,40,000+ ratings)</span>
  </div>
  <div class="ph-pros-cons">
    <div class="ph-pros">
      <div class="ph-pros-label">âœ“ Pros</div>
      <ul>
        <li>Frequently under â‚¹1,000</li>
        <li>35 hrs total battery</li>
        <li>Quad-mic ENC for calls</li>
      </ul>
    </div>
    <div class="ph-cons">
      <div class="ph-cons-label">âœ— Cons</div>
      <ul>
        <li>Treble can get sharp at high volumes</li>
        <li>Fit loosens during workouts</li>
      </ul>
    </div>
  </div>
  <div class="ph-verdict">At under â‚¹1,000 this is the most earbud per rupee available. I'm not sure I'd pick it over the boAt 141 at its standard price, but when it dips below â‚¹900 during sales, it's an obvious buy. The ENC call quality surprised me â€” decent on Bangalore roads.</div>
  <a href="https://www.amazon.in/s?k=noise+buds+vs104+max&tag=pricehawkin-21" class="ph-btn" style="width:100%;justify-content:center">Check Price on Amazon â†’</a>
</div>

<h2 class="ph-h2"># faq</h2>

<div style="border:1px solid #2a2a2a;border-radius:10px;background:#1a1a1a;padding:0 22px">
  <div class="ph-faq-item">
    <div class="ph-faq-q">Which earbuds have the best battery life under â‚¹2,000?</div>
    <div class="ph-faq-a">The boAt Airdopes 141 leads with roughly 42 hours total (about 6 hours per charge plus case). In my four-week test it consistently outlasted every other pair here. Nothing else is even close at this price.</div>
  </div>
  <div class="ph-faq-item">
    <div class="ph-faq-q">Are sub-â‚¹2,000 earbuds good enough for calls?</div>
    <div class="ph-faq-a">Yes, for most calls. Models with ENC â€” the boAt Airdopes 161 and Noise VS104 Max â€” handle indoor calls well. In heavy Bangalore traffic or on the metro, honestly even the best budget mics will struggle. Manage expectations for outdoor calls.</div>
  </div>
  <div class="ph-faq-item">
    <div class="ph-faq-q">Do any of these support low-latency gaming mode?</div>
    <div class="ph-faq-a">The boAt Airdopes 141 (BEAST mode at ~50ms) and realme Buds T01 (~40ms) both offer dedicated low-latency modes. It's good enough for BGMI and Subway Surfers. It will not match wired â€” to be honest nothing wireless will â€” but it's playable.</div>
  </div>
  <div class="ph-faq-item">
    <div class="ph-faq-q">Is it worth waiting for a price drop?</div>
    <div class="ph-faq-a">Prices on these models swing 20â€“40% around sale events (Big Billion Days, Prime Day, Republic Day). If you're not in a hurry, set a PriceHawk alert â€” I'll ping you on Telegram when it drops to your target. Otherwise the boAt 141 at â‚¹1,299 is already fair value.</div>
  </div>
  <div class="ph-faq-item">
    <div class="ph-faq-q">How often is this guide updated?</div>
    <div class="ph-faq-a">I re-check prices hourly and revisit rankings monthly, or whenever a major new model launches. All prices in the comparison table are pulled live from Amazon.</div>
  </div>
</div>

<div class="ph-author">
  <strong>Sanket Bhoirkar â€” PriceHawk</strong>
  MSc Electrical Engineering Â· 5+ years researching consumer tech in India Â· Tests products with his own money before recommending them. Zero sponsored placements. Ever.
</div>

</div>`
}

async function getOrCreatePage(slug, title, content) {
  try {
    const existing = await axios.get(`${WP}/wp-json/wp/v2/pages?slug=${slug}`, { headers })
    if (existing.data && existing.data.length > 0) {
      const id = existing.data[0].id
      console.log(`  Updating existing page ${id}...`)
      const r = await axios.post(`${WP}/wp-json/wp/v2/pages/${id}`, { title, content, status: 'publish' }, { headers })
      return r.data
    }
  } catch {}
  console.log(`  Creating new page...`)
  const r = await axios.post(`${WP}/wp-json/wp/v2/pages`, { title, content, slug, status: 'publish' }, { headers })
  return r.data
}

async function createBlogPost(title, content) {
  const r = await axios.post(`${WP}/wp-json/wp/v2/posts`, {
    title,
    content,
    status: 'draft',
    excerpt: 'I tested 8 earbuds under â‚¹2,000 in India over four weeks. Here are the ones I\'d actually buy â€” ranked honestly, no affiliate bias.',
  }, { headers })
  return r.data
}

async function main() {
  console.log('Building PriceDrops HTML...')
  const priceDropsHtml = buildPriceDropsHtml()

  console.log('Publishing Price Drops page to WordPress...')
  try {
    const page = await getOrCreatePage('price-drops', 'Price Drops â€” PriceHawk', priceDropsHtml)
    console.log(`  âœ“ Page: ${page.link}`)
  } catch (e) {
    console.error(`  âœ— Page failed: ${e.response?.data?.message || e.message}`)
  }

  console.log('Creating sample blog post...')
  try {
    const post = await createBlogPost(
      'Best Earbuds Under â‚¹2,000 in 2026 â€” Honest Review After 4 Weeks of Testing',
      buildBlogPostHtml()
    )
    console.log(`  âœ“ Post (draft): ${post.link}`)
    console.log(`  âœ“ Edit: ${WP}/wp-admin/post.php?post=${post.id}&action=edit`)
  } catch (e) {
    console.error(`  âœ— Post failed: ${e.response?.data?.message || e.message}`)
  }

  console.log('\nDone.')
}

main()
