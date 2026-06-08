require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const path = require('path')

const WP = process.env.WORDPRESS_URL.trim()
const b64 = Buffer.from(process.env.WORDPRESS_USERNAME + ':' + process.env.WORDPRESS_APP_PASSWORD).toString('base64')
const headers = { Authorization: 'Basic ' + b64, 'Content-Type': 'application/json' }
const SITE = path.join(__dirname, '../public/site')

const REACT_SRI    = 'sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L'
const REACTDOM_SRI = 'sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm'
const BABEL_SRI    = 'sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y'

const css      = fs.readFileSync(path.join(SITE, 'styles.css'), 'utf8')
const dataJs   = fs.readFileSync(path.join(SITE, 'data.js'), 'utf8')
const shared   = fs.readFileSync(path.join(SITE, 'shared.jsx'), 'utf8')
const terminal = fs.readFileSync(path.join(SITE, 'home-terminal.jsx'), 'utf8')

const jsx = shared + '\n' + terminal +
  '\nReactDOM.createRoot(document.getElementById("ph-root")).render(React.createElement(PHTerminal));'

const payload = JSON.stringify(jsx).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

const block = `<!-- wp:html {"align":"full"} -->
<style>
body{background:#0f0f0f!important}
.site-header,.site-footer,header.site-header,footer.site-footer,
#masthead,#colophon,.wp-block-template-part,.navigation,.post-navigation,
.entry-header,.entry-footer,.comments-area,.sidebar,#secondary,
.wp-block-post-title{display:none!important}
.entry-content,.wp-block-post-content,.site-content,#content,.page-content,
.hentry,.wp-site-blocks{max-width:100%!important;margin:0!important;padding:0!important;background:#0f0f0f!important}
main.wp-block-group,main.wp-block-group-is-layout-constrained{margin-top:0!important;padding-top:0!important}
.wp-block-group.has-global-padding,.wp-block-group.is-layout-constrained{padding-top:0!important;margin-top:0!important}
.wp-block-html,.wp-block-html.alignfull,#ph-root{max-width:100%!important;width:100%!important}
.entry-content.has-global-padding>*,.is-layout-constrained>*,.entry-content>*{max-width:none!important}
.has-global-padding>*{max-width:none!important;--wp--style--global--content-size:100%!important;--wp--style--global--wide-size:100%!important}
${css}
</style>
<div id="ph-root" style="max-width:100%;width:100%"></div>
<script>
(function(){
${dataJs}
function ld(src,int,cb){var s=document.createElement('script');s.src=src;s.integrity=int;s.crossOrigin='anonymous';s.onload=cb;document.head.appendChild(s);}
ld('https://unpkg.com/react@18.3.1/umd/react.development.js','${REACT_SRI}',function(){
ld('https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js','${REACTDOM_SRI}',function(){
ld('https://unpkg.com/@babel/standalone@7.29.0/babel.min.js','${BABEL_SRI}',function(){
  var code=${payload};
  var xf=Babel.transform(code,{presets:['react']}).code;
  var s=document.createElement('script');s.textContent=xf;document.head.appendChild(s);
});});});
})();
</script>
<!-- /wp:html -->`

async function main() {
  const r = await axios.get(`${WP}/wp-json/wp/v2/pages?slug=ph-home&per_page=1`, { headers })
  const id = r.data[0]?.id
  if (!id) { console.error('ph-home page not found'); process.exit(1) }
  const upd = await axios.post(`${WP}/wp-json/wp/v2/pages/${id}`, { content: block, status: 'publish' }, { headers })
  console.log('Updated:', upd.data.link)
}

main().catch(e => { console.error(e.response?.data?.message || e.message); process.exit(1) })
