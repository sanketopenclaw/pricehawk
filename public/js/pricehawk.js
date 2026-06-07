function esc(s) { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; }

function initPricehawk(container) {
  container.innerHTML = `
<link rel="stylesheet" href="/css/pricehawk.css">
<div class="ph-tabs">
  ${['Research','Products','Content','Monetize','Publish','Deals','KPI'].map(t =>
    `<button class="ph-tab${t==='Research'?' active':''}" onclick="phTab('${t.toLowerCase()}')">${t}</button>`
  ).join('')}
</div>

<!-- RESEARCH -->
<div class="ph-section active" id="ph-research">
  <h3 style="color:#e67e22;margin-bottom:16px">Agent 1 — Keyword Research</h3>
  <div class="ph-row">
    <div class="ph-col"><span class="ph-label">Niche</span><input id="ph-niche" class="ph-input" placeholder="earbuds, laptops, air-fryers..."></div>
    <div class="ph-col"><span class="ph-label">Budget (₹)</span><input id="ph-budget" class="ph-input" type="number" placeholder="2000"></div>
    <button class="ph-btn-primary" onclick="phResearch()">Analyse</button>
  </div>
  <div id="ph-opp-result"></div>
</div>

<!-- PRODUCTS -->
<div class="ph-section" id="ph-products">
  <h3 style="color:#e67e22;margin-bottom:16px">Agent 2 — Product Intelligence</h3>
  <button class="ph-btn-primary" onclick="phScrapeProducts()" style="margin-bottom:16px">Scrape Amazon.in</button>
  <ul class="ph-product-list" id="ph-product-list"><li style="color:#888">Run Research first, then scrape products.</li></ul>
</div>

<!-- CONTENT -->
<div class="ph-section" id="ph-content">
  <h3 style="color:#e67e22;margin-bottom:16px">Agent 3 — Content Generation</h3>
  <div class="ph-content-type-grid">
    ${[['guide','📚','Buying Guide'],['comparison','⚖️','Comparison'],['deals','🔥','Deals'],['pricedrop','📉','Price Drop'],['review','⭐','Review']].map(([v,icon,label]) =>
      `<div class="ph-type-btn${v==='guide'?' active':''}" id="ph-type-${v}" onclick="phSelectType('${v}')"><span class="icon">${icon}</span>${label}</div>`
    ).join('')}
  </div>
  <div style="margin-bottom:10px"><button class="ph-btn-primary" onclick="phGenerateContent()">Generate Content</button> <span id="ph-content-status" style="color:#888;font-size:13px;margin-left:8px"></span></div>
  <textarea id="ph-generated-content" class="ph-input" style="height:380px;font-family:monospace;font-size:12px;resize:vertical" placeholder="Generated content appears here..."></textarea>
</div>

<!-- MONETIZE -->
<div class="ph-section" id="ph-monetize">
  <h3 style="color:#e67e22;margin-bottom:16px">Agent 4 — Affiliate Links</h3>
  <div style="margin-bottom:12px">
    <span class="ph-label" style="display:inline">Network:</span>
    <select id="ph-network" style="margin-left:8px;padding:6px;background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#fff">
      <option value="auto">Auto (Amazon → EarnKaro)</option>
      <option value="amazon">Amazon Associates</option>
      <option value="earnkaro">EarnKaro</option>
      <option value="cuelinks">Cuelinks</option>
    </select>
  </div>
  <button class="ph-btn-primary" onclick="phMonetize()" style="margin-bottom:10px">Insert Affiliate Links</button>
  <div id="ph-monetize-result"></div>
</div>

<!-- PUBLISH -->
<div class="ph-section" id="ph-publish">
  <h3 style="color:#e67e22;margin-bottom:16px">Agent 5 — Publish to WordPress</h3>
  <div id="ph-wp-status" style="margin-bottom:12px;font-size:13px;color:#888">Checking WordPress...</div>
  <div class="ph-row">
    <div class="ph-col"><span class="ph-label">Post Title</span><input id="ph-pub-title" class="ph-input" placeholder="Best Earbuds Under ₹2000 in 2025"></div>
    <div><span class="ph-label">Status</span>
      <select id="ph-pub-status" style="padding:8px;background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#fff">
        <option value="draft">Draft</option>
        <option value="publish">Publish Now</option>
      </select>
    </div>
  </div>
  <button class="ph-btn-primary" onclick="phPublish()">Publish to WordPress</button>
  <div id="ph-publish-result" style="margin-top:12px;font-size:13px"></div>
</div>

<!-- DEALS -->
<div class="ph-section" id="ph-deals">
  <h3 style="color:#e67e22;margin-bottom:16px">Agent 6 — Deal Monitor</h3>
  <div class="ph-row">
    <div class="ph-col"><span class="ph-label">ASIN</span><input id="ph-deal-asin" class="ph-input" placeholder="B09X2XWWTZ"></div>
    <div class="ph-col"><span class="ph-label">Product Name</span><input id="ph-deal-name" class="ph-input" placeholder="boAt Airdopes 141"></div>
    <div class="ph-col"><span class="ph-label">Alert at ₹</span><input id="ph-deal-threshold" class="ph-input" type="number" placeholder="1200"></div>
    <button class="ph-btn-primary" onclick="phTrackDeal()">Track</button>
  </div>
  <button class="ph-btn-success" onclick="phCheckDeals()" style="margin-bottom:16px">Check All Prices Now</button>
  <table class="ph-deals-table">
    <thead><tr><th>Product</th><th>ASIN</th><th>Baseline</th><th>Alert at</th><th>Status</th><th></th></tr></thead>
    <tbody id="ph-deals-body"><tr><td colspan="6" style="color:#888;padding:12px">No products tracked yet</td></tr></tbody>
  </table>
  <div id="ph-deals-result" style="margin-top:12px;font-size:13px;color:#888"></div>
</div>

<!-- KPI -->
<div class="ph-section" id="ph-kpi">
  <h3 style="color:#e67e22;margin-bottom:16px">KPI Dashboard — Year One Targets</h3>
  <div class="ph-kpi-grid">
    <div class="ph-kpi-card"><div class="value" id="kpi-published">—</div><div class="label">Published</div></div>
    <div class="ph-kpi-card"><div class="value" id="kpi-draft">—</div><div class="label">Drafts</div></div>
    <div class="ph-kpi-card"><div class="value" id="kpi-revenue">—</div><div class="label">Revenue (₹)</div></div>
    <div class="ph-kpi-card"><div class="value" id="kpi-clicks">—</div><div class="label">Affiliate Clicks</div></div>
  </div>
  <div class="ph-card">
    <div id="ph-target-label" style="font-size:13px;color:#ccc;margin-bottom:6px">Loading...</div>
    <div class="ph-progress-bar"><div class="ph-progress-fill" id="ph-progress" style="width:0%"></div></div>
    <div id="ph-target-detail" style="font-size:12px;color:#888;margin-top:4px"></div>
  </div>
  <button class="ph-btn-secondary" onclick="phLoadKpi()" style="margin-top:8px">Refresh</button>
</div>
`;

  window._ph = { niche:'', budget:'', products:[], contentType:'guide', content:'', schema:null, title:'' };
  phCheckWpStatus();
  phLoadKpi();
  phLoadWatchlist();
});

window.phTab = function(tab) {
  document.querySelectorAll('.ph-tab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase() === tab));
  document.querySelectorAll('.ph-section').forEach(s => s.classList.toggle('active', s.id === `ph-${tab}`));
};

window.phResearch = async function() {
  const niche = document.getElementById('ph-niche').value.trim();
  const budget = document.getElementById('ph-budget').value.trim();
  if (!niche) return alert('Enter a niche first');
  window._ph.niche = niche; window._ph.budget = budget;
  const el = document.getElementById('ph-opp-result');
  el.innerHTML = '<div style="color:#888">Scraping SERP + analysing top 3 competitor articles... (30-60s)</div>';
  try {
    const r = await fetch('/api/pricehawk/research', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({niche,budget}) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    const o = d.opportunities[0];
    window._ph.research = o; // store for content generation

    const competitorRows = (o.competitors_scraped || []).map(c =>
      `<tr>
        <td style="color:#ccc;padding:4px 8px">${esc(c.title || c.url)}</td>
        <td style="color:#e67e22;padding:4px 8px;text-align:right">${esc(c.word_count || '?')}w</td>
        <td style="color:#888;padding:4px 8px;font-size:11px">${esc((c.headings || []).slice(0,3).join(' · '))}</td>
      </tr>`
    ).join('');

    const missingTopics = (o.topics_missing || []).map(t => `<li style="color:#27ae60">${esc(t)}</li>`).join('');
    const suggestedH2s = (o.suggested_h2s || []).map(h => `<li style="color:#ccc">${esc(h)}</li>`).join('');

    el.innerHTML = `<div class="ph-card">
      <div style="font-size:15px;font-weight:600;color:#fff;margin-bottom:10px">${esc(o.suggested_title || d.keyword)}</div>
      <div style="display:flex;gap:24px;margin-bottom:12px">
        <div><div style="color:#e67e22;font-size:22px;font-weight:700">${esc(o.opportunity_score||'?')}</div><div style="color:#888;font-size:11px">Score</div></div>
        <div><div style="color:#fff;font-size:22px;font-weight:700">${esc(o.competitor_count||'?')}</div><div style="color:#888;font-size:11px">Competitors</div></div>
        <div><div style="color:#fff;font-size:22px;font-weight:700">${esc(o.avg_word_count||'?')}</div><div style="color:#888;font-size:11px">Avg Words</div></div>
        <div><div style="color:#27ae60;font-size:22px;font-weight:700">${esc(o.min_word_count||'?')}</div><div style="color:#888;font-size:11px">Beat At</div></div>
      </div>

      ${competitorRows ? `<div style="margin-bottom:12px">
        <div style="font-size:12px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Scraped Competitors</div>
        <table style="width:100%;border-collapse:collapse">${competitorRows}</table>
      </div>` : ''}

      ${missingTopics ? `<div style="margin-bottom:10px">
        <div style="font-size:12px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Topics Competitors Missed ✓</div>
        <ul style="margin:0;padding-left:16px;font-size:12px">${missingTopics}</ul>
      </div>` : ''}

      ${suggestedH2s ? `<div style="margin-bottom:10px">
        <div style="font-size:12px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Suggested H2 Structure</div>
        <ol style="margin:0;padding-left:16px;font-size:12px">${suggestedH2s}</ol>
      </div>` : ''}

      ${o.content_angle ? `<div style="font-size:12px;color:#e67e22;margin-top:6px">Angle: ${esc(o.content_angle)}</div>` : ''}
      <button class="ph-btn-secondary" onclick="phTab('products')" style="margin-top:12px">→ Scrape Products</button>
    </div>`;
  } catch(e) { el.innerHTML = `<div class="ph-status-err">${esc(e.message)}</div>`; }
};

window.phScrapeProducts = async function() {
  const {niche,budget} = window._ph;
  if (!niche) return alert('Run Research first');
  const list = document.getElementById('ph-product-list');
  list.innerHTML = '<li style="color:#888">Scraping Amazon.in...</li>';
  try {
    const r = await fetch('/api/pricehawk/products', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({niche,budget}) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    window._ph.products = d.products;
    list.innerHTML = !d.products.length ? '<li style="color:#888">No products found — try a different niche</li>' :
      d.products.map((p,i) => `<li>
        <input type="checkbox" checked id="ph-prod-${i}">
        <span style="flex:1;font-weight:500">${esc(p.name)}</span>
        <span style="color:#e67e22">₹${esc((p.price_inr||0).toLocaleString('en-IN'))}</span>
        <span style="color:#888;font-size:12px">${esc(p.rating||'?')}★ · ${esc((p.reviews||0).toLocaleString('en-IN'))}</span>
        ${p.badge ? `<span class="ph-badge">${esc(p.badge)}</span>` : ''}
      </li>`).join('');
  } catch(e) { list.innerHTML = `<li class="ph-status-err">${e.message}</li>`; }
};

window.phSelectType = function(type) {
  window._ph.contentType = type;
  document.querySelectorAll('.ph-type-btn').forEach(b => b.classList.toggle('active', b.id === `ph-type-${type}`));
};

window.phGenerateContent = async function() {
  const {niche,budget,contentType} = window._ph;
  if (!niche) return alert('Run Research first');
  const checked = window._ph.products.filter((_,i) => document.getElementById(`ph-prod-${i}`)?.checked !== false);
  const status = document.getElementById('ph-content-status');
  const ta = document.getElementById('ph-generated-content');
  status.textContent = 'Generating... (30-60s)'; ta.value = '';
  try {
    const keyword = budget ? `Best ${niche} Under ₹${budget}` : `Best ${niche} India`;
    const r = await fetch('/api/pricehawk/content', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({content_type:contentType,niche,budget,products:checked,keyword,research:window._ph.research||null}) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    window._ph.content = d.content; window._ph.schema = d.schema; window._ph.title = d.title;
    ta.value = d.content;
    document.getElementById('ph-pub-title').value = d.title || '';
    status.innerHTML = `<span class="ph-status-ok">✓ ${d.word_count} words</span>`;
  } catch(e) { status.innerHTML = `<span class="ph-status-err">${e.message}</span>`; }
};

window.phMonetize = async function() {
  const content = document.getElementById('ph-generated-content').value;
  if (!content) return alert('Generate content first');
  const network = document.getElementById('ph-network').value;
  const el = document.getElementById('ph-monetize-result');
  el.textContent = 'Inserting links...';
  try {
    const r = await fetch('/api/pricehawk/monetize', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({content,products:window._ph.products,network}) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    document.getElementById('ph-generated-content').value = d.content;
    window._ph.content = d.content;
    el.innerHTML = `<span class="ph-status-ok">✓ ${d.links_inserted} links inserted via ${d.network_used}</span>`;
  } catch(e) { el.innerHTML = `<span class="ph-status-err">${e.message}</span>`; }
};

window.phCheckWpStatus = async function() {
  try {
    const r = await fetch('/api/pricehawk/publish/status');
    const d = await r.json();
    const el = document.getElementById('ph-wp-status');
    if (el) el.innerHTML = d.connected
      ? `<span class="ph-status-ok">✓ WordPress connected: ${d.url}</span>`
      : `<span class="ph-status-err">✗ Not connected — set WORDPRESS_URL / USERNAME / APP_PASSWORD in .env</span>`;
  } catch {}
};

window.phPublish = async function() {
  const title = document.getElementById('ph-pub-title').value.trim();
  const status = document.getElementById('ph-pub-status').value;
  const content = window._ph.content;
  const el = document.getElementById('ph-publish-result');
  if (!title) return alert('Enter post title');
  if (!content) return alert('Generate content first');
  el.textContent = 'Publishing...';
  try {
    const r = await fetch('/api/pricehawk/publish', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({title,content,content_type:window._ph.contentType,schema:window._ph.schema,status}) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    el.innerHTML = `<span class="ph-status-ok">✓ Post ID: ${d.post_id} · <a href="${d.url}" target="_blank" style="color:#e67e22">${d.url}</a></span>`;
    phLoadKpi();
  } catch(e) { el.innerHTML = `<span class="ph-status-err">${e.message}</span>`; }
};

window.phLoadWatchlist = async function() {
  try {
    const r = await fetch('/api/pricehawk/deals/watchlist');
    const d = await r.json();
    const tbody = document.getElementById('ph-deals-body');
    if (!tbody) return;
    if (!d.watchlist.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:#888;padding:12px">No products tracked yet</td></tr>';
    } else {
      tbody.innerHTML = '';
      d.watchlist.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${esc(p.name)}</td>
          <td style="color:#888;font-size:12px">${esc(p.asin)}</td>
          <td>${p.baseline_price ? '₹'+esc(p.baseline_price.toLocaleString('en-IN')) : '—'}</td>
          <td>${p.threshold_inr ? '₹'+esc(p.threshold_inr.toLocaleString('en-IN')) : 'Auto'}</td>
          <td style="color:#888">—</td>
          <td></td>`;
        const btn = document.createElement('button');
        btn.textContent = '✕';
        btn.style.cssText = 'background:none;border:none;color:#e74c3c;cursor:pointer;font-size:12px';
        btn.addEventListener('click', () => phRemoveDeal(p.asin));
        tr.querySelector('td:last-child').appendChild(btn);
        tbody.appendChild(tr);
      });
    }
  } catch {}
};

window.phTrackDeal = async function() {
  const asin = document.getElementById('ph-deal-asin').value.trim();
  const name = document.getElementById('ph-deal-name').value.trim();
  const threshold = document.getElementById('ph-deal-threshold').value.trim();
  if (!asin || !name) return alert('ASIN and name required');
  const r = await fetch('/api/pricehawk/deals/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({asin,name,threshold_inr:threshold?parseInt(threshold):null,niche:window._ph.niche}) });
  if (r.ok) { document.getElementById('ph-deal-asin').value=''; document.getElementById('ph-deal-name').value=''; phLoadWatchlist(); }
};

window.phRemoveDeal = async function(asin) {
  await fetch(`/api/pricehawk/deals/track/${asin}`, {method:'DELETE'});
  phLoadWatchlist();
};

window.phCheckDeals = async function() {
  const el = document.getElementById('ph-deals-result');
  el.textContent = 'Checking prices...';
  try {
    const r = await fetch('/api/pricehawk/deals/check', {method:'POST'});
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    el.innerHTML = `<span class="ph-status-ok">✓ ${d.checked} checked · ${d.drops_found} drops found</span>`;
    phLoadWatchlist();
  } catch(e) { el.innerHTML = `<span class="ph-status-err">${e.message}</span>`; }
};

window.phLoadKpi = async function() {
  try {
    const d = await (await fetch('/api/pricehawk/kpi')).json();
    const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    set('kpi-published', d.articles_published||0);
    set('kpi-draft', d.articles_draft||0);
    set('kpi-revenue', d.revenue_inr ? '₹'+d.revenue_inr.toLocaleString('en-IN') : '₹0');
    set('kpi-clicks', d.affiliate_clicks||0);
    if (d.target) {
      const pct = Math.min(100, Math.round(((d.articles_published||0)/d.target.articles)*100));
      const p = document.getElementById('ph-progress'); if(p) p.style.width=pct+'%';
      const l = document.getElementById('ph-target-label'); if(l) l.textContent=`Month ${d.current_month} Target: ${d.target.articles} articles · ₹${(d.target.revenue_min).toLocaleString('en-IN')}–₹${(d.target.revenue_max).toLocaleString('en-IN')}`;
      const dt = document.getElementById('ph-target-detail'); if(dt) dt.textContent=`${d.articles_published||0} / ${d.target.articles} articles published (${pct}%)`;
    }
  } catch {}
};


document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('app')
  initPricehawk(container)
})