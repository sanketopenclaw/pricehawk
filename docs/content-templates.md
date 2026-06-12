# PriceHawk Content Templates v1

Research-backed page anatomies for the three core content types. Sources: Google's
"Write high quality reviews" guidance (developers.google.com, updated 2025-12),
Wirecutter page anatomy (verdict-first, flaws-not-dealbreakers), Sanket DNA voice file.

Hard rules that override everything: master doc v2.3 compliance (no scraped Amazon
price/image/rating display, ASCI disclosure above fold, methodology block, draft-only).

---

## T1 — Product Review (G2)

| # | Section | Why (source) |
|---|---------|--------------|
| 1 | ASCI disclosure | Compliance, above fold |
| 2 | Breadcrumb nav | Site architecture |
| 3 | **Verdict box** — 2-sentence verdict, segment badge, who-it's-for one-liner, CTA | Wirecutter: name the answer immediately; lazy readers convert at top |
| 4 | Recency line — "Specs reviewed June 2026 · price tracked daily" | Wirecutter: recency signal builds trust; ours is honest (daily logger) |
| 5 | Intro — voice lead + spec-derived summary | DNA voice layer (exists) |
| 6 | Product card — brand, name, sparkline, tracking note, CTA | exists |
| 7 | **Pros / Where it falls short** — two-column, spec-derived, honest cons | Google: "discuss benefits AND drawbacks"; Wirecutter "flaws but not dealbreakers". Cons computed from specs vs category norms — never fabricated |
| 8 | Full specifications table | Google: quantitative measurements |
| 9 | Feature highlights | exists |
| 10 | Who should buy this | Google: best-for-circumstances |
| 11 | What we can't tell you | DNA honesty block (exists) |
| 12 | Methodology block | Compliance |
| 13 | Price alert CTA | Owned audience |
| 14 | Amazon CTA block | Conversion |
| 15 | FAQ (schema) | SERP features |
| 16 | Related pages | Google: links to other resources |

## T2 — Comparison (G3)

1. Disclosure → breadcrumb → hedged framing intro
2. Dual product cards with CTAs (multiple buying options per Google guidance;
   Flipkart second button when Cuelinks lands)
3. Spec-by-spec table (differences bolded)
4. Hedged tradeoff verdict (DNA, exists) + Pick A if / Pick B if boxes (exists)
5. **Per-product "falls short" line** — drawbacks parity with reviews
6. Methodology → FAQ → related pages

## T3 — Buying Guide (G4)

1. Disclosure → breadcrumb → diagnosis opener (DNA, exists) + category context
2. Quick picks table — Top / Budget / Upgrade pick named immediately (Wirecutter);
   each row one-sentence "main selling point"
3. How we picked / trust section (exists)
4. Comparison table of all picks
5. Per-product deep-dive cards — each with pros + falls-short (Google: ranked list
   entries must stand on their own)
6. PriceHawk Labs / best value badge (exists)
7. What actually matters when choosing (buying factors, exists)
8. Alternatives → FAQ → final recs → internal links

## Cons derivation rules (never fabricate)

Cons come only from documented specs measured against category context:
- Wattage below category median → slower preheat/cook than rivals
- Capacity ≤ 2.5L → too small for a family of four
- Capacity ≥ 6L → bulky for small counters
- Manual/knob controls → no digital presets
- Missing common safety/convenience feature present in ≥half of category → call it out
- Budget segment → expectation-setting on build quality (phrase as tradeoff, not flaw)

If fewer than 2 honest cons derivable → render "falls short" with what IS known +
defer to "What we can't tell you" block. Never pad with invented negatives.
