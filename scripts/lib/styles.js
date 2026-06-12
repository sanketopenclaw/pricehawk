// scripts/lib/styles.js — injected style block for WP post content
// <style> tags are preserved by WP REST API for admin users (unfiltered_html cap)
// Needed for pseudo-element rules (::-webkit-details-marker, ::after) that
// can't be done with inline styles.

function buildPageStyles() {
  return `<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
.ph-faq details{border:1px solid #2a2a2a;border-radius:8px;margin-bottom:8px;overflow:hidden;background:#1a1a1a;}
.ph-faq summary{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;font-weight:600;font-size:15px;cursor:pointer;list-style:none;color:#f0f0f0;background:#1a1a1a;}
.ph-faq summary::-webkit-details-marker{display:none;}
.ph-faq summary::after{content:'+';font-size:20px;color:#e67e22;font-weight:300;line-height:1;flex-shrink:0;margin-left:12px;}
.ph-faq details[open] summary{background:rgba(230,126,34,0.10);border-bottom:1px solid #2a2a2a;}
.ph-faq details[open] summary::after{content:'−';}
.ph-faq .ph-ans{padding:14px 18px;font-size:14px;line-height:1.75;color:#c8c8c8;background:#161616;}
</style>`
}

module.exports = { buildPageStyles }
