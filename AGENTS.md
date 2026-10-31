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
| `style.css` | Design tokens (copied from DESIGN.md) at the top, then layout. Breakpoints at 860px (stack columns) and 520px (phone). |
| `script.js` | `SETTINGS` at the top, each overridable from the URL (`?showHeadshot=false`, `?showSkills=false`). |
| `images/headshot.webp` | Formal headshot (black suit, gray background). |
| `images/cover-ez-brow.png`, `images/cover-propertypixel.webp` | Project covers, copied from the old site (`case-study-thumbnail.png`, `pp-mobile-mockup.webp`). |
| `Rishav-Gautam-Resume.pdf` | Résumé, linked from Contact. Copied from `Desktop/Resume 2026 New.pdf`; replace this file when the résumé changes. Note: it includes a phone number. |
| `tools/sync-preview.sh`, `tools/serve.py` | Preview. The browser pane can't read Documents, so `sync-preview.sh` mirrors this folder (`rishavux.github.io` now) to `~/.portfolio-preview/site` and `serve.py` serves it uncached on port 5176 (config "portfolio" in `Documents/.claude/launch.json`). Run the sync after every edit, then reload http://localhost:5176/. |

## Page content

- **Hero:** eyebrow "Product Designer | UX Strategy | AI Native"; name; intro "Design is my *sixth sense.*" (the gold word on the page); Based in San Francisco Bay Area; Open to Full-Time Product Design roles; headshot on the right (above the text on phones).
- **I. Selected Work:** 01 EZ Brow & Beauty (Design Lead, 2026, Solo) → rishavux.github.io/ez-case-study; 02 PropertyPixel (UX Designer, 2026, Solo) → rishavux.github.io/pp-case-study. Each: cover, facts, Problem, What I did, link. No outcomes, by request. Problem / What I did copy drafted by Claude from the case studies; Rishav will edit.
- **II. About:** "Born in Nepal. Raised in California." Double major, business problems with design as the medium. "Practice" skills line from the résumé (setting `showSkills`).
- **III. Contact:** email, LinkedIn, GitHub, résumé PDF.

## Current state

- 2026-10-31: v1 built and checked at desktop (1440px) and phone (375px) widths.
- 2026-10-31: v1 replaced the old site at rishavux.github.io. Old site, plus its last uncommitted edits, saved on branch `old-site`.

## Decisions

- 2026-10-31: Base is black (ink/900). Everything else is tentative.
- 2026-10-31: Projects: EZ Brow & Beauty and PropertyPixel only. No outcomes shown.
- 2026-10-31: Sections numbered with Roman numerals (I., II., III.) for the ordered, legal feel. Gold used only for the numerals, "sixth sense.", the case-study links and one short rule under the headshot.
- 2026-10-31: Nothing kept from the old site (stupa light, name dock animation, travel photos dropped).
