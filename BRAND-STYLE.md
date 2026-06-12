# PriceHawk Brand Style Guide

**Single source of truth for every generated page/post.** Extracted from the live homepage (page 12, snapshot 2026-06-11_12-19). Any generator (G1–G4, future) must use these exact tokens. Do not invent new hex values.

Aesthetic in one line: **dark, trustworthy-analyst terminal — WireCutter × 91mobiles.** Dense, sharp, monospace numerics, saffron accent.

---

## 1. Colors

### Surfaces (dark theme)
| Token | Hex | Use |
|-------|-----|-----|
| `--bg` | `#0f0f0f` | Page background (body forced to this) |
| `--bg-2` | `#141414` | Secondary background |
| `--card` | `#1a1a1a` | Cards, panels, header chips |
| `--card-2` | `#1e1e1e` | Nested cards |
| `--border` | `#2a2a2a` | Default 1px borders |
| `--border-2` | `#353535` | Stronger borders, button outlines |
| (ticker/panel headers) | `#0b0b0b` | Extra-dark strips (ticker bar, panel title rows) |

### Text (on dark)
| Token | Hex | Use |
|-------|-----|-----|
| `--text` | `#f0f0f0` | Primary text |
| `--text-2` | `#888888` | Secondary text, nav links, labels |
| `--text-3` | `#5f5f5f` | Tertiary — strikethrough prices, fine print |

### Accents
| Token | Hex | Use |
|-------|-----|-----|
| `--accent` | `#e67e22` | **Primary brand saffron/burnt orange.** Headline highlights, CTAs, active pills, links, LIVE label |
| `--accent-h` | `#f08a30` | Accent hover state |
| `--green` | `#27ae60` | Deals, price drops, "good", live dot |
| `--red` | `#e74c3c` | Price-drop %, alerts, strikethrough emphasis |
| `--gold` | `#f39c12` | Best Seller badge |
| `--blue` | `#3498db` | Amazon's Choice badge |

**Text on accent fills:** dark, not white — `#140a02` on `--accent` buttons/pills, `#04210f` on solid green badges.

### Article reading surface (posts only)
Generated posts use **dark theme throughout** — no white article card:
- Article bg: `transparent` (inherits `#0f0f0f` from shell)
- Body text: `#c8c8c8` (prose), `#f0f0f0` (headings), `#a0a0a0` (secondary)
- Cards/panels: `#1a1a1a` bg, `1px solid #2a2a2a` border
- Verdict/highlight box: `rgba(230,126,34,0.07)` bg, `rgba(230,126,34,0.28)` left border

### Banned / off-brand colors
Never use: `#ff9900` (raw Amazon orange), `#e8a020`, `#e65100`, `#b07b10`, generic bootstrap blues/greens. CTA buttons = `--accent` `#e67e22` with `#140a02` text. Links on white = `#e67e22`.

---

## 2. Typography

Google Fonts import (every page):
```
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap
```

| Token | Stack | Use |
|-------|-------|-----|
| `--font-head` | `'Inter', system-ui, sans-serif` | Headings (h1–h4) |
| `--font-body` | `'Inter', system-ui, sans-serif` | Body copy |
| `--font-mono` | `'JetBrains Mono', ui-monospace, monospace` | **All numbers/prices, nav links, labels, badges-as-data, taglines, footer fine print, section eyebrows** |

Rules:
- Headings: `line-height:1.12`, `letter-spacing:-0.02em`, weight 700–800
- Hero h1: 50px desktop / 36px mobile, weight 800, `line-height:1.04`; one phrase highlighted in `--accent`
- Body: `line-height:1.5` (UI) / `1.7–1.75` (article prose)
- Mono labels/eyebrows: 10–12px, weight 700, `text-transform:uppercase`, `letter-spacing:0.04–0.08em`
- Prices/numerics: mono + `font-variant-numeric:tabular-nums`
- Selection: `::selection { background: var(--accent); color: #0f0f0f; }`

---

## 3. Shape & spacing

- **Radius: `T_RAD = 4px` — sharp corners everywhere** on homepage/dark UI (cards, pills, chips, panels). Exceptions: buttons 8px, white article card 12px, FAQ details 8px, round pills `999px` only for legacy `.pill`.
- Borders: 1px solid `--border`; hover → `--border-2`
- Page padding: 40px desktop / 16px mobile
- Card hover (`.elev`): `translateY(-3px)`, `box-shadow: 0 12px 30px rgba(0,0,0,.45)`
- Badges: `padding:3px 8px`, `border-radius:5px`, 11px/700; tinted style = `color-mix(in srgb, <color> 16%, transparent)` background + same color text

## 4. Buttons

| Class | Style |
|-------|-------|
| `.btn--amazon` (primary CTA) | bg `--accent`, text `#140a02`, weight 700; hover bg `--accent-h` |
| `.btn--ghost` | bg `--card`, 1px `--border-2`, text `--text` |
| `.btn--outline-accent` | 1px border accent@55%, text `--accent`; hover bg accent@12% |

Base: `border-radius:8px`, `padding:11px 18px`, 14px/600, `:active { translateY(1px) }`.

## 5. Page shell (every generated page/post)

**Centered wide — `max-width:1440px; margin:0 auto; padding:0 40px`** desktop / `padding:0 16px` mobile. Never reintroduce 760px/1200px narrow columns. Never go fully `max-width:none` (too wide on large monitors).

1. Force dark body + hide theme chrome: `body{background:#0f0f0f!important}` + hide `.site-header/.site-footer/.wp-block-post-title` etc.
2. PriceHawk sticky header: wordmark (30px logo) + mono nav links (`#888`, 13px JetBrains Mono) + Alerts button (outline-accent). `backdrop-filter:blur(10px)`, `background:rgba(15,15,15,0.92)`
3. Content: all dark — no white reading card
4. Footer: mono 12px links `#888`, tagline "Find the Best Price. Every Time." in `#5f5f5f` mono, commission disclosure line in mono `--text-3`
5. ASCI/affiliate disclosure above fold (compliance — see project memory)

## 6. Voice markers (visual)

- Live/data energy: green pulse dot (`box-shadow: 0 0 8px var(--green)`), "LIVE" mono labels, ticker marquee (38s linear loop, pause on hover)
- Panel pattern: title row on `#0b0b0b` with mono uppercase label + green "▼ live" tag, rows below
- Price display: bold `now` + struck-through `was` in `--text-3` + `% off` in `--red`
- Stars: glyphs in `--gold`, rating bold, count in `--text-2` 12px

---

## 7. Review Page Components

### Star distribution bars
```
5 bars (5→1★). Track: #2a2a2a. Fill: #e67e22 if pct≥50, else #5f5f5f. Height 6px. Width = pct%.
Labels: mono 11px #888. Percentage: mono 11px #5f5f5f.
```

### Sentiment chip
```
bg: rgba(39,174,96,0.15)  color: #4ade80  border: rgba(39,174,96,0.3)
font: mono 11px 700  padding: 3px 8px  radius: 4px
Label: "Sentiment {score}/10"
```

### Review cards (positive / critical)
```
Positive: bg rgba(39,174,96,0.06)  border rgba(39,174,96,0.2)  label #4ade80
Critical:  bg rgba(231,76,60,0.06)  border rgba(231,76,60,0.2)  label #f87171
Text: #c8c8c8 13.5px. Stars: #e67e22. Meta (reviewer·date): mono 10px #5f5f5f.
```

### Segment badges (hub + review pages)
```
Budget:    color #27ae60  bg rgba(39,174,96,0.10)   border #27ae6044
Mid-Range: color #e67e22  bg rgba(230,126,34,0.10)  border #e67e2244
Premium:   color #3498db  bg rgba(52,152,219,0.10)  border #3498db44
Flagship:  color #9b59b6  bg rgba(155,89,182,0.10)  border #9b59b644
Font: mono 10px 700. Padding: 2px 7px. Radius: 4px.
```

### Scenario cards (In Your Kitchen)
```
bg #1a1a1a  border #2a2a2a  radius 6px  padding 16px 18px
Heading: #f0f0f0 15px 700. Body: #a0a0a0 14px line-height 1.7.
```

### Key Specs table
```
bg #1a1a1a  border #2a2a2a  overflow hidden (for radius on table)
Col 1 (label): mono 12px 700 #888. Col 2 (value): mono 13px 700 #e67e22. Col 3 (explain): 13.5px #c8c8c8.
Row separator: border-bottom 1px solid #2a2a2a.
```

### Product gallery
```
Horizontal scroll div. gap 10px. scrollbar-color: #2a2a2a #0f0f0f.
Tiles: 160×160, bg #141414, border #2a2a2a, radius 6px. Image: object-fit:contain, 8px inner padding.
```

---

## Enforcement status (2026-06-12)

All generator off-brand hexes replaced with `#e67e22`/`#140a02`. Shells converted to dark, `max-width:1440px` centered, 40px gutters. New components (reviewsBlock, productImageGallery, buildInYourKitchen, buildSpecsExplained) follow dark token system above.

**Files in compliance:** `lib/templates.js`, `lib/content.js`, `lib/styles.js`, `lib/voice.js`, `generate-reviews.js`, `generate-comparisons.js`, `generate-brand-comparisons.js`, `generate-phase1-content.js`, `generate-price-alert-page.js`, `publish-design-to-wp.js`
