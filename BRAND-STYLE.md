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
Long-form post body sits in a **white article card on the dark shell**:
- Article card: `background:#ffffff`, `border-radius:12px`, `padding:36px 44px`
- Body text on white: `#333` (primary), `#444` (secondary), `#888` (meta), `#1a1a1a` (headings)
- Light borders on white: `#e8e8e8`; light panel fill: `#fafafa`
- Verdict/highlight box: `background:#fffbf2`, accent-left-border — use `--accent` `#e67e22` for the left border and label color

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

**Widescreen, always.** No max-width cap on page wrappers — `max-width:none`, full viewport width with `padding: 0 40px` desktop / `16px` mobile (matches homepage). Never reintroduce 760px/1200px reading columns.

1. Force dark body + hide theme chrome: `body{background:#0f0f0f!important}` + hide `.site-header/.site-footer/.wp-block-post-title` etc.
2. PriceHawk header: wordmark + mono nav links (`#888`, 13px JetBrains Mono) + Alerts button (outline-accent)
3. Content: dark UI sections, or white article card for long-form prose
4. Footer: mono 12px links `#888`, tagline "Find the Best Price. Every Time." in `#5f5f5f` mono, commission disclosure line in mono `--text-3`
5. ASCI/affiliate disclosure above fold (compliance — see project memory)

## 6. Voice markers (visual)

- Live/data energy: green pulse dot (`box-shadow: 0 0 8px var(--green)`), "LIVE" mono labels, ticker marquee (38s linear loop, pause on hover)
- Panel pattern: title row on `#0b0b0b` with mono uppercase label + green "▼ live" tag, rows below
- Price display: bold `now` + struck-through `was` in `--text-3` + `% off` in `--red`
- Stars: glyphs in `--gold`, rating bold, count in `--text-2` 12px

---

## Enforcement status (2026-06-12)

All generator off-brand hexes (`#ff9900`, `#e8a020`, `#e65100`, `#b07b10`) replaced with `#e67e22`/`#140a02` across `lib/templates.js`, `lib/content.js`, `generate-reviews.js`, `generate-comparisons.js`, `generate-brand-comparisons.js`, `generate-phase1-content.js`, `generate-price-alert-page.js`. Shells (`postShell`, `wideShell`, `publish-design-to-wp.js`) converted to widescreen (`max-width:none`, 40px gutters).
