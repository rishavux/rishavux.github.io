# CLAUDE.md — Portfolio (v1)

Standing brief for this repository: what exists now and how we work. Update it with every change Rishav asks for.

## How we work

- Rishav is a UX / interaction designer who directs; you implement. Explain changes in plain language.
- Take adjustments one at a time. Verify each in the browser preview and show a screenshot before reporting back.
- When a real design decision hasn't been answered, ask with 2–3 options rather than picking silently.
- When Rishav is unsure about an element, hide it behind a setting instead of deleting it.
- "Commit" means: commit, update this file in the same commit, then push.
- Plain HTML, CSS and a little JavaScript. No build step, no dependencies without asking.

## The vision

A one-page portfolio to land a first full-time product design role. Live at https://rishavux.github.io, served by GitHub Pages from `main` of `rishavux/rishavux.github.io` (folder `Documents/rishavux.github.io`). Work here from now on. The old site is kept on the `old-site` branch. v1 was first built in `Documents/portfolio` (private repo `rishavux/new-portfolio`), which is now only the starting point. Show the work and let the work speak; the voice is stern and mature. The visual system (black core, gold accent, Libre Caslon Text + Inter, restrained and ordered) lives in `../presentation-system/DESIGN.md`, which is the source of truth for color, type and tone.

## Files

| File | What it holds |
|---|---|
| `index.html` | The whole page, top to bottom: header, hero, I. Selected Work, II. About, III. Contact, footer. |
| `style.css` | Design tokens (copied from DESIGN.md) at the top, plus the type scale (`--fs-display`, `--fs-h2`, `--fs-h3`, `--fs-statement`, `--fs-body`, `--fs-secondary`, `--fs-label`) and 8px spacing scale (`--space-1`…`--space-10`), then layout. Content width 1120px with the gutter outside it. Breakpoints at 860px (stack columns, section padding 80px) and 520px (phone); body text 18px from 1200px. |
| `script.js` | `SETTINGS` at the top, each overridable from the URL (`?showHeadshot=false`, `?showSkills=false`). |
| `images/headshot.webp` | Formal headshot (black suit, gray background). |
| `images/cover-ez-brow.png`, `images/cover-propertypixel.webp` | Project covers, copied from the old site (`case-study-thumbnail.png`, `pp-mobile-mockup.webp`). |
| `Rishav-Gautam-Resume.pdf` | Résumé, linked from Contact. Copied from `Desktop/Resume 2026 New.pdf`; replace this file when the résumé changes. Note: it includes a phone number. |
| `tools/sync-preview.sh`, `tools/serve.py` | Preview. The browser pane can't read Documents, so `sync-preview.sh` mirrors this folder (`rishavux.github.io` now) to `~/.portfolio-preview/site` and `serve.py` serves it uncached on port 5176 (config "portfolio" in `Documents/.claude/launch.json`). Run the sync after every edit, then reload http://localhost:5176/. |

## Figma

Figma file "Portfolio v1 — Desktop, Tablet, Mobile": https://www.figma.com/design/7DY8xrAAFjf5SLpd9mpfWf

Page "Portfolio v1" holds three frames side by side: Desktop — 1440 (`1:2`), Tablet — 768 (`2:2`), Mobile — 375 (`3:2`). They are editable layers (not components, no variables or styles), captured from this site on 2026-10-31 with the Figma MCP `html_to_figma` tool: one self-contained HTML per width, with images inlined as base64 and each width's `clamp()` and `@media` rules resolved in advance. The file is a snapshot and does not update with the site; capture again after site changes.

## Page content

- **Hero:** on a 12-column grid, name block on 7 columns, portrait on 5; at least 90% of the screen tall on desktop, so the first screen shows only the hero. Eyebrow "Product Designer | UX Strategy | AI Native" with gold dividers; name in the display size; intro "Design is my *sixth sense.*" (italic, no gold); a short gold rule; Based in San Francisco Bay Area; Open to Full-Time Product Design roles, with a gold dot. Portrait 4:5 with a fade into the black at the bottom and the signature offset gold frame behind it (`--frame-offset`, 18px; 12px on tablet and phone). At 1024px and below the hero stacks: name first, then the portrait full width (3:2 crop, head to tie knot, on tablet; 4:5 on phones).
- **I. Selected Work:** 01 EZ Brow & Beauty (Design Lead, 2026, Solo) → rishavux.github.io/ez-case-study; 02 PropertyPixel (UX Designer, 2026, Solo) → rishavux.github.io/pp-case-study. Each: cover, facts, Problem, What I did, link. No outcomes, by request. Layout on the 12-column grid: cover 7 columns, one empty column, text 4; 01 has the cover left, 02 (`project--flip`) has it right; at 1024px and below both stack cover above text. Covers sit in an ink/800 box with an ink/700 border; hovering anywhere on a case turns the border gold/900 and scales the image 1.02. The EZ cover (`has-frame`) carries the hero's offset gold frame, its only other use on the page. Numerals "01"/"02" in 3rem gold serif; Problem / What I did labels in gold; Role / Year / Team separated by thin rules. "Read the case study" has a quiet gold-900 underline and a brighter gold line drawn across it on hover, arrow nudging 4px, 44px tap height. Problem / What I did copy drafted by Claude from the case studies; Rishav will edit.
- **II. About:** "Born in Nepal. Raised in California." Double major, business problems with design as the medium. "Practice" skills line from the résumé (setting `showSkills`).
- **III. Contact:** email, LinkedIn, GitHub, résumé PDF.

## Current state

- 2026-10-31: v1 built and checked at desktop (1440px) and phone (375px) widths.
- 2026-10-31: v1 replaced the old site at rishavux.github.io. Old site, plus its last uncommitted edits, saved on branch `old-site`.
- 2026-10-31: Desktop, tablet and mobile versions captured into Figma (see Figma).
- 2026-10-31: Design improvements under way on branch `design-improvements`, following Rishav's PORTFOLIO-DESIGN-IMPROVEMENTS brief in 6 phases, one at a time, with Rishav's review after each. `main` (the live site) is unchanged until the work is approved and merged. Phase 1 (foundations) done: type scale, spacing scale, 12px minimum text, muted text raised to ink/300, 2px gold focus outline, 1120px content width. Checked at 1440, 768, 390 and 320: no text under 12px, no sideways scroll; the only text under 4.5:1 is the decorative "|" dividers in the title line (to become gold in Phase 2). Known: at 320px the header name wraps to two lines, to be fixed with the nav in Phase 4. Phase 2 (hero) done: see Page content. The offset gold frame may appear at most once more on the page (one case-study cover). Phase 3 (Selected Work) done: see Page content. "01 / 02" kept (no "Exhibit" labels).

## Decisions

- 2026-10-31: Base is black (ink/900). Everything else is tentative.
- 2026-10-31: Projects: EZ Brow & Beauty and PropertyPixel only. No outcomes shown.
- 2026-10-31: Sections numbered with Roman numerals (I., II., III.) for the ordered, legal feel.
- 2026-10-31: Gold budget (from the improvements brief): hero rule and offset frame, the availability dot, the eyebrow dividers, section and case-study numerals, link underlines and hover states, the active nav item. Never body text, fills or backgrounds; at most one gold rule per screen. "sixth sense." is no longer gold.
- 2026-10-31: Tagline "Design is my sixth sense." kept in place for now (pending decision in the brief).
- 2026-10-31: Nothing kept from the old site (stupa light, name dock animation, travel photos dropped).
