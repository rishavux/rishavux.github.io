/* The browser's own scroll restoration (returning to wherever you were
   scrolled to on refresh/back-forward) fights this page's model: the
   hero's docked-avatar state follows scrollY directly, but the stupa-
   light/beam/spotlight-card reveal is separate state that only ever
   moves via the down-button/avatar click handlers below and always
   starts reset to 0 on load — so landing mid-scroll on refresh showed
   a docked nav with a reveal that hadn't played, i.e. a broken-looking
   mismatched state. Every load now forces back to the real start. */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}
window.scrollTo(0, 0);

document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Blocks user-initiated scrolling (wheel/touch/keyboard) at all
     times — navigation only ever happens via #hero-scroll-btn or a nav
     link, both of which move the page with window.scrollTo()/anchor
     navigation directly, neither of which fires these events, so
     they're never affected by the block. Event-based rather than CSS
     `overflow: hidden` specifically so it never risks fighting with
     those programmatic scrolls. Only ever set up here, in JS, so a
     page with JS disabled/failed stays normally scrollable instead of
     being permanently stuck. */
  let scrollLocked = true;
  const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
  const SPACE_ACTIVATABLE_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA']);
  function blockScrollInput(e) {
    if (!scrollLocked) return;
    if (e.type === 'keydown') {
      if (!SCROLL_KEYS.has(e.key)) return;
      /* Space normally activates a focused button/link — don't eat
         that just because space is also a scroll key. */
      if (e.key === ' ' && SPACE_ACTIVATABLE_TAGS.has(e.target.tagName)) return;
    } else if (e.type === 'touchmove' && e.target.closest('button, a')) {
      /* Same idea as the space-key carve-out above, for touch: don't
         eat a touch that's happening on/starting from an interactive
         control. A real finger (and notably Chrome DevTools' mouse-to-
         touch emulation, used when testing via the device toolbar) can
         generate a tiny touchmove even for what's meant to be a
         stationary tap — preventDefault()ing that here was swallowing
         the tap outright (no click ever fires, e.g. on #hero-scroll-btn)
         instead of just blocking page scroll, which is all this is
         actually meant to stop. */
      return;
    }
    e.preventDefault();
  }
  window.addEventListener('wheel', blockScrollInput, { passive: false });
  window.addEventListener('touchmove', blockScrollInput, { passive: false });
  window.addEventListener('keydown', blockScrollInput);

  /* ── helpers ─────────────────────────────────────────────── */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const clampPx = (min, v, max) => Math.min(max, Math.max(min, v));
  const smoothstep = (edge0, edge1, x) => {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };
  /* Fast start, gentle stop — unlike smoothstep (symmetric ease-in-out),
     used where a reveal should decelerate into its resting state rather
     than easing in and out equally (see the card's clip-path unravel in
     renderStupaReveal, which otherwise reads as mechanical). */
  const easeOutCubic = (edge0, edge1, x) => {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return 1 - Math.pow(1 - t, 3);
  };
  /* Shortest signed angle (radians) from a to b, wrapped to (-π, π] —
     without this, lerping raw atan2() outputs can rotate the long way
     round instead of the short way. */
  const shortestAngleDelta = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  /* ═══════════════════════════════════════════════════════════
     HERO MORPH
     The avatar+name lockup is one element the whole time. Scroll
     progress through #hero-pin (which is taller than the viewport
     on purpose) drives it continuously shrinking + traveling from
     its centered rest position toward the nav corner — a FLIP-style
     transform, not a threshold snap. At progress 1 it "docks":
     swaps from being positioned inside the sticky hero to
     position: fixed at the exact same on-screen spot, so it keeps
     existing as a persistent nav for the rest of the page. Scroll
     back up and it undocks and resumes following scroll exactly
     the way it came.
  ═══════════════════════════════════════════════════════════ */
  const heroPin = document.getElementById('hero-pin');
  const hero = document.getElementById('hero');
  const heroBgImg = document.getElementById('hero-bg-img');
  const heroMorph = document.getElementById('hero-morph');
  const heroAvatar = heroMorph.querySelector('.hero-avatar');
  const heroMorphName = heroMorph.querySelector('.hero-morph-name');
  const heroScrollBtn = document.getElementById('hero-scroll-btn');
  const projectsNavBackBtn = document.getElementById('projects-nav-back-btn');
  const heroNav = document.getElementById('hero-nav');
  const heroNavBar = document.getElementById('hero-nav-bar');
  /* Same stacking-context escape as the avatar/name (see the relocation
     at the end of remeasureHeroMorph for the full explanation) — .hero's
     position:sticky traps these inside its own stacking context
     otherwise, regardless of their own z-index. Their positioning is
     already fully CSS-var/viewport-driven (--dock-top/--dock-side, or
     `right:`/`top:` before docking, when they're invisible anyway), so
     moving them has no positioning dependency on their old parent. */
  document.body.appendChild(heroNav);
  document.body.appendChild(heroNavBar);
  const navToggle = document.getElementById('nav-toggle');
  const navLinkEls = document.querySelectorAll('.nav-link');
  const stupaLight = document.getElementById('stupa-light');
  const stupaLightGlow = document.getElementById('stupa-light-glow');
  const stupaLightInner = document.getElementById('stupa-light-inner');
  const stupaLightCore = document.getElementById('stupa-light-core');
  const stupaLightBeam = document.getElementById('stupa-light-beam');
  const stupaLightBeamFar = document.getElementById('stupa-light-beam-far');
  const stupaLightBeamBloom = document.getElementById('stupa-light-beam-bloom');
  const heroSpotlightCard = document.getElementById('hero-spotlight-card');
  const heroSpotlightContent = heroSpotlightCard.querySelector('.hero-spotlight-content');
  const heroSpotlightHighlight = document.getElementById('hero-spotlight-highlight');
  const heroSpotlightMeta = document.getElementById('hero-spotlight-meta');
  const heroSpotlightActions = document.getElementById('hero-spotlight-actions');
  const mobileRoleChip = document.getElementById('mobile-role-chip');

  const rootStyles = getComputedStyle(document.documentElement);
  const DOCK_TOP = parseFloat(rootStyles.getPropertyValue('--dock-top'));
  const DOCK_SIDE = parseFloat(rootStyles.getPropertyValue('--dock-side'));
  const AVATAR_BASE = parseFloat(rootStyles.getPropertyValue('--avatar-base'));
  const AVATAR_DOCK = parseFloat(rootStyles.getPropertyValue('--avatar-dock'));
  const TARGET_SCALE = AVATAR_DOCK / AVATAR_BASE;
  /* Mobile-only (see style.css's mobile :root override) — the shared
     size/inset for .projects-nav-back-btn and the hamburger, read here
     purely so navBackShift below can reserve the CORRECT amount of
     room next to it once Projects is open, instead of the desktop-only
     assumption (back button == avatar-dock sized) that used to stand
     in for it everywhere. Undefined/NaN on desktop, where these two
     custom properties don't exist — harmless, since navBackShift only
     ever reads them inside its own isMobileViewport() branch. */
  const NAV_CORNER_BTN_SIZE = parseFloat(rootStyles.getPropertyValue('--nav-corner-btn-size'));
  const NAV_CORNER_BTN_INSET = parseFloat(rootStyles.getPropertyValue('--nav-corner-btn-inset'));

  /* hero-bg.jpg's own object-position starts at "center 22%" (see
     .hero-bg-img in style.css). Panning it further down as you scroll
     is what makes the background feel like it's carrying along with
     you, instead of sitting frozen behind the content. */
  const BG_PAN_START = 22;
  const BG_PAN_END = 100;
  /* On phone-width viewports the horizontal crop switches from
     "center" to "left" (see updateHero below) so the stupa — which
     sits on the left third of the photo — stays on screen instead of
     being cropped out by a centered crop on a narrow, tall viewport.
     Matches the site's existing mobile-nav breakpoint. */
  const MOBILE_BREAKPOINT_PX = 760;
  const isMobileViewport = () => window.innerWidth <= MOBILE_BREAKPOINT_PX;

  /* The morph (avatar/name travel, nav fade-in, dock) starts the
     instant scrolling does, and plays out over (0, DOCK_AT] of the
     pin scroll, finishing well before the scroll is done rather than
     at the very end (1.0). Background panning keeps using the raw,
     un-rescaled progress the whole way, so it keeps moving through
     the rest of the photo after docking. */
  const DOCK_START = 0;
  const DOCK_AT = 0.6;

  /* ── Avatar/name shared-hub dock ──────────────────────────────────
     Rest state: avatar stacked above the name (see .hero-morph in
     style.css). Docked: avatar small, name to its right, top-left
     corner. Avatar and name are always exactly opposite each other
     around one shared hub (hub ± halfVec — see remeasureHeroMorph()),
     so they can never stray independently of one another.
     Three separate progress curves, not one:
       - SIZE (avatar/name scale, and the arm's own length) runs the
         WHOLE journey (0 → 1) — shrinking starts the instant scroll
         does and never stops, so the pair is already getting smaller,
         and the gap between them already getting proportionally
         tighter, while anything else is happening.
       - ROTATE (vertical stack → side-by-side) is confined to an early
         phase (0 → ARRANGE_PHASE_END) and finishes there — the orbit
         happens while shrinking is already well underway, so the pair
         stays close-but-clear of each other instead of two full-size
         shapes sweeping past one another.
       - TRAVEL (hub: rest position → dock corner) only starts once
         rotation is done (ARRANGE_PHASE_END → 1) — no migrating toward
         the corner until they're already adjacent and orbiting is
         finished, then it migrates while size keeps proportionally
         resizing down to the final dock size. */
  const DOCK_GAP = 12;
  const DOCK_NAME_FONT_PX = 27;
  /* Mobile docks the name (and, since it's anchored to the name's own
     scale, the role chip riding along with it) smaller than desktop's
     27px — a separate, mobile-only override rather than changing the
     shared constant above, which desktop's own docked nav also
     depends on. dockNameFontPx() replaces every direct read of
     DOCK_NAME_FONT_PX below so both stay in sync automatically. */
  const MOBILE_DOCK_NAME_FONT_PX = 19;
  const dockNameFontPx = () => (isMobileViewport() ? MOBILE_DOCK_NAME_FONT_PX : DOCK_NAME_FONT_PX);
  const ARRANGE_PHASE_END = 0.45;
  const HERO_SCROLL_BTN_SIZE = 64; // matches .hero-scroll-btn's width/height
  const HERO_SCROLL_BTN_GAP = 28;
  /* Gap between the name's own bottom edge and the mobile-only role
     chip below it (see #mobile-role-chip in index.html), scaled up
     from 0 (touching, at rest) to this value as travelP goes 0→1 —
     same idiom as DOCK_GAP/restGapPx for the avatar/name's own arm
     length above. The chip is otherwise anchored directly to the
     name's own live position/scale every frame (see updateHero) —
     "the same element", not a separately tuned animation — so this is
     the only chip-specific number left to tune. Set to 0 (touching,
     same as rest) — a docked gap here read as too much empty space
     between the name and the chip. */
  const MOBILE_ROLE_CHIP_DOCKED_GAP = 0;
  /* Chip's own natural (unscaled, rest) size — measured once in
     remeasureHeroMorph, the same "unstyle, measure" trick used for the
     name/avatar. Needed because the chip is still a wide (60vw at
     rest) box: a plain CSS `translateX(-50%) scale()` centers/shrinks
     it around its OWN (unscaled) width, which silently drifts the
     visual left edge away from whatever `left` is set to once the
     box is actually meant to be left-aligned instead of centered —
     the exact "why won't it sit right under the name" bug. Using the
     avatar/name's own explicit translate(center - scaledHalfSize)
     technique instead (see updateHero) sidesteps that entirely. */
  let mobileRoleChipRestW = 0;
  let mobileRoleChipRestH = 0;

  /* Yellow light embedded pixel-for-pixel in hero-bg.jpg (1728x1390,
     cropped from the original 1728x1727), sitting on the stupa's
     spire tip at column 190, row 1065 (sampled directly from the
     photo). Its screen size and position are derived from the exact
     object-fit:cover math the background pan already uses — the
     scale factor (how much bigger than its native
     1728x1390 the photo is currently rendered) is applied to the
     light's own "native pixel" size, so it grows/shrinks with the
     photo instead of staying a fixed CSS size. remeasureStupaLight()
     handles the viewport-dependent parts (scale, x, glow/core size —
     resize only); updateStupaLight() handles the pan-dependent y
     position every scroll frame, since the photo keeps moving after
     the header has already docked. */
  const IMG_W = 1728;
  const IMG_H = 1390;
  const STUPA_TOP_COL = 175;
  const STUPA_TOP_ROW = 1058;
  /* Bumped up from the strictly-realistic 16/90 so the light reads as
     proportionate to the much bigger card below, rather than looking
     like a tiny pinprick next to it. Ratio kept roughly the same. */
  const LIGHT_CORE_ORIG = 28;
  const LIGHT_INNER_ORIG = 64;
  const LIGHT_GLOW_ORIG = 160;

  /* Light beam + glass card (Figma node 107:15, "Frame 145") — a light
     shaft shooting off the stupa's light onto an (as-yet empty) frosted
     glass card. Both are children of #stupa-light, so they inherit its
     live pan/scroll transform for free and stay "attached" to the exact
     same anchor point as the glow/core above — the card gently pans
     with the photo just like the light does, rather than staying
     perfectly still.
     Unlike the glow/core (embedded in the photo, so sized in photo-
     native pixels), the card is a UI panel — sized in plain viewport
     units (big, generous padding from the right edge), but its
     POSITION is still locked to the glow via a fixed local offset
     (CARD_TOP_FRACTION below), not to the viewport — see that
     constant's comment for why. The beam remains a wedge computed
     purely from the two live anchor points (the glow at local origin
     0,0, and the card box), so it always exactly reaches and matches
     the card at any viewport size. */
  const CARD_PADDING_RIGHT_MIN = 32;
  const CARD_PADDING_RIGHT_VW = 0.06;
  const CARD_PADDING_RIGHT_MAX = 96;
  const CARD_W_MIN = 640;
  const CARD_W_VW = 0.64;
  const CARD_W_MAX = 1100;
  /* How far down the card's height the glow sits (matches the ~0.3
     ratio from the original Figma frame). Fixed relative to the glow
     — NOT derived from viewport centering — so the beam's taper always
     has a real point to aim at, at any viewport size or scroll
     position, instead of clamping to a corner when the glow's rest
     position happens to fall outside a viewport-centered box. */
  const CARD_TOP_FRACTION = 0.48;
  /* Extra flat pixel lift on top of the proportional fraction above —
     a simple "nudge it up/down a bit" knob independent of card height.
     Negative values push the card down instead of up. */
  const CARD_EXTRA_LIFT = -5;

  let lightScale = 1;
  let lightXPx = 0;
  let lightExcessHOrig = 0;
  let cardTopLocal = 0;

  function remeasureStupaLight() {
    /* Mobile drops the stupa-light + glass-card system entirely — every
       hero element gets plain, manually-authored CSS placement instead
       (see the mobile block in style.css). Skip all of this viewport-
       scale/beam/card geometry outright rather than just hiding its
       result, and clear any inline geometry a wider viewport may have
       left behind so the manual CSS positioning takes over cleanly. */
    if (isMobileViewport()) {
      heroSpotlightCard.style.width = '';
      heroSpotlightCard.style.left = '';
      heroSpotlightCard.style.top = '';
      heroSpotlightCard.style.height = '';
      heroSpotlightCard.style.clipPath = '';
      cardTopLocal = 0;
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    lightScale = Math.max(vw / IMG_W, vh / IMG_H);
    const excessWOrig = IMG_W - vw / lightScale;
    lightExcessHOrig = IMG_H - vh / lightScale;
    const windowLeftOrig = excessWOrig / 2;
    lightXPx = (STUPA_TOP_COL - windowLeftOrig) * lightScale;
    stupaLightCore.style.width = `${LIGHT_CORE_ORIG * lightScale}px`;
    stupaLightCore.style.height = `${LIGHT_CORE_ORIG * lightScale}px`;
    stupaLightInner.style.width = `${LIGHT_INNER_ORIG * lightScale}px`;
    stupaLightInner.style.height = `${LIGHT_INNER_ORIG * lightScale}px`;
    stupaLightGlow.style.width = `${LIGHT_GLOW_ORIG * lightScale}px`;
    stupaLightGlow.style.height = `${LIGHT_GLOW_ORIG * lightScale}px`;

    /* Horizontal is safe to derive from the viewport: lightXPx only
       changes on resize (there's no horizontal pan), so it's stable
       for the whole scroll range, unlike the light's y-position. */
    const cardPaddingRight = clampPx(CARD_PADDING_RIGHT_MIN, vw * CARD_PADDING_RIGHT_VW, CARD_PADDING_RIGHT_MAX);
    const cardW = clampPx(CARD_W_MIN, vw * CARD_W_VW, CARD_W_MAX);
    /* Width has to land on the actual element (and the meta/actions
       rows have to be synced to their final widths, see
       syncSpotlightActionsWidth below) BEFORE measuring height — text
       wrapping, and therefore how tall the content is, depends on it. */
    heroSpotlightCard.style.width = `${cardW}px`;
    syncSpotlightActionsWidth();
    /* Height is content-driven, not a fixed aspect ratio — the frame
       holds real, variable-length copy now (headline + role/location +
       CTAs), so it has to grow or shrink with whatever that content
       actually needs at this width. A fixed ratio here (the original
       empty-frame Figma proportions) would leave the content clipped
       or overflowing past the card's own background/padding, so top
       and bottom padding stop matching. */
    const cardH = heroSpotlightContent.offsetHeight;
    const cardLeftViewport = vw - cardPaddingRight - cardW;
    const cardLeft = cardLeftViewport - lightXPx;
    const cardTop = -CARD_TOP_FRACTION * cardH - CARD_EXTRA_LIFT;
    cardTopLocal = cardTop;

    /* The card is a separate top-level position:fixed element (see
       index.html/CSS comments for why), so unlike the beam it doesn't
       inherit #stupa-light's transform for free — left is set here
       directly in viewport coordinates (lightXPx doesn't change with
       scroll, so this is stable), and top is kept in sync with the
       live, pan-dependent yPx every scroll frame in updateStupaLight(). */
    heroSpotlightCard.style.left = `${lightXPx + cardLeft}px`;
    heroSpotlightCard.style.height = `${cardH}px`;

    /* Beam bounding box: left edge at the glow (x=0), right edge at
       the card's LEFT edge (not through the card) — the beam is the
       projector, the card is what it's projecting onto, so it should
       terminate right where the card starts, at the card's full
       height, rather than washing across the card itself. Within that
       box, a clip-path wedge tapers from a point at the glow's y
       (wherever that lands inside the box) out to the box's full
       height at the far edge. */
    const beamW = cardLeft;
    const beamH = cardH;
    const apexYPct = clamp01(-cardTop / cardH) * 100;
    /* Two identically-shaped/positioned layers (see index.html) — the
       --near one lightly blurred (still reads as a fairly defined
       shaft close to the glow), the --far one heavily blurred (soft,
       diffuse, genuinely feathers the clip-path wedge's edges instead
       of just fading at the tip). style.css's mask-image crossfades
       which one is actually visible along the beam's length, so
       together they read as blur increasing with distance from the
       core rather than one uniformly-blurred hard-edged shape. */
    [
      { el: stupaLightBeam, blurFactor: 0.05 },
      { el: stupaLightBeamFar, blurFactor: 0.12 },
    ].forEach(({ el, blurFactor }) => {
      el.style.left = '0px';
      el.style.top = `${cardTop}px`;
      el.style.width = `${beamW}px`;
      el.style.height = `${beamH}px`;
      el.style.clipPath = `polygon(0 ${apexYPct}%, 100% 0%, 100% 100%)`;
      el.style.filter = `blur(${beamH * blurFactor}px)`;
      /* Box stays at its FULL final size always — the clip-path wedge
         above is expressed in percentages of this box, so keeping the
         box fixed keeps that wedge's true taper/proportions correct.
         The reveal (renderStupaReveal below) instead scales the whole
         already-correctly-shaped wedge via transform, anchored on this
         exact apex point — same "opening up" language as the light
         source, and the anchor means the apex (nearest the glow) stays
         visually pinned in place while the rest of the cone flares open
         around it, in both reach and spread at once, rather than only
         extending sideways at a fixed height. */
      el.style.transformOrigin = `0% ${apexYPct}%`;
    });
    /* Bloom shares the near/far box exactly, but its clip-path is a
       trapezoid instead of a point at the apex — it already has some
       vertical spread at x=0 (apexYPct ± BLOOM_SPREAD_PCT) rather than
       tapering from nothing, so it reads as ambient spill widening
       around the shaft rather than a third, even-wider wedge stacked
       on top of it. */
    const BLOOM_SPREAD_PCT = 6;
    const bloomTopPct = Math.max(0, apexYPct - BLOOM_SPREAD_PCT);
    const bloomBottomPct = Math.min(100, apexYPct + BLOOM_SPREAD_PCT);
    stupaLightBeamBloom.style.left = '0px';
    stupaLightBeamBloom.style.top = `${cardTop}px`;
    stupaLightBeamBloom.style.width = `${beamW}px`;
    stupaLightBeamBloom.style.height = `${beamH}px`;
    stupaLightBeamBloom.style.clipPath = `polygon(0 ${bloomTopPct}%, 0 ${bloomBottomPct}%, 100% 0%, 100% 100%)`;
    stupaLightBeamBloom.style.filter = `blur(${beamH * 0.22}px)`;
    stupaLightBeamBloom.style.transformOrigin = `0% ${apexYPct}%`;
  }

  /* The chip row AND the About Me / Projects buttons row below it are
     both pinned to the exact rendered width of the "Intelligence,
     Behavior & Culture" line — clearing the inline widths first so
     the highlight can size to its own text naturally before being
     measured, otherwise a stale width from a previous (larger)
     viewport would lock it too wide. */
  function syncSpotlightActionsWidth() {
    heroSpotlightMeta.style.width = '';
    heroSpotlightActions.style.width = '';
    const w = `${heroSpotlightHighlight.offsetWidth}px`;
    heroSpotlightMeta.style.width = w;
    heroSpotlightActions.style.width = w;
  }

  function updateStupaLight(panPct) {
    if (isMobileViewport()) return;
    const windowTopOrig = (panPct / 100) * lightExcessHOrig;
    const yPx = (STUPA_TOP_ROW - windowTopOrig) * lightScale;
    stupaLight.style.transform = `translate(${lightXPx}px, ${yPx}px)`;
    heroSpotlightCard.style.top = `${yPx + cardTopLocal}px`;
  }

  /* ═══════════════════════════════════════════════════════════
     STUPA LIGHT REVEAL — toggles with the hero button / docked name
     The light/beam/card render fully hidden (see their CSS defaults)
     until the hero's down-arrow is clicked, then animate in, in sync
     with that same click-triggered scroll — renderStupaReveal is
     passed to animateScrollTo() as its onProgress callback below
     (down button) or wrapped to run in reverse (docked name, "back to
     top"), so it's driven by the exact same eased 0→1 value already
     moving the page in either direction, not a second/independent
     scroll listener. Going up resets it back to fully hidden, so the
     next trip down plays the whole intro again — see the click
     handlers near the bottom of this file for the reverse wrapper.
     remeasureStupaLight() above still owns all the FINAL geometry
     (sizes, positions, the beam's clip-path wedge shape) — this only
     ever gates how much of that already-computed geometry is
     currently visible, via three overlapping phases of one shared
     progress value (same smoothstep-phase-split idiom as the avatar/
     name dock's sizeP/rotateP/travelP): the light fades on first, the
     beam starts extending while the light is still settling in, and
     the card only starts uncovering once the beam is mostly across.
     Pure function of t — safe to call with any value, any number of
     times, in either direction. */
  let stupaRevealP = 0;

  function renderStupaReveal(t) {
    stupaRevealP = t;
    if (isMobileViewport()) return;
    /* Beam window starts at the same 0.25 as before (kept so the light
       still visibly blooms first — see the earlier note this replaced),
       but stretched wider (0.25→0.95, was 0.25→0.85) so the reveal
       itself plays out more slowly instead of rushing through in the
       same fraction of the click-scroll's fixed real-time duration.
       Card window likewise widened (0.6→0.95, was 0.55→0.8) — started
       a touch later since the beam now takes longer to read as "mostly
       across", and still finishes with a small margin before t=1 (not
       a fraction to 1.0 itself) so there's no last-frame snap, same
       reasoning as MORPH_DOCK_AT elsewhere in this file. */
    const lightP = smoothstep(0, 0.4, t);
    const beamP = smoothstep(0.25, 0.95, t);
    const cardP = easeOutCubic(0.6, 0.95, t);

    /* "Opening up" rather than panning in: scale from 0 → 1 (an iris/
       aperture growing open), combined with the opacity fade, so the
       dominant read is expansion, not the lateral motion already
       coming from #stupa-light's own scroll-driven pan transform
       (updateStupaLight — untouched, still just moves the parent).
       translate(-50%, -50%) is glow/core's own CSS centering trick
       (keeps the growing circle centered on the light's x/y instead
       of growing from its top-left corner) — it has to be repeated
       here since setting .style.transform from JS replaces the
       stylesheet's transform entirely rather than adding to it. */
    const lightTransform = `translate(-50%, -50%) scale(${lightP})`;
    stupaLightGlow.style.transform = lightTransform;
    stupaLightInner.style.transform = lightTransform;
    stupaLightCore.style.transform = lightTransform;
    stupaLightGlow.style.opacity = String(lightP);
    stupaLightInner.style.opacity = String(lightP);
    stupaLightCore.style.opacity = String(lightP);
    /* Beam "opens up" the same way as the light — scale(0→1) anchored
       on its own apex point (transform-origin set once in
       remeasureStupaLight, right at the glow), not a width change, so
       the cone flares open in reach AND spread together instead of
       just sliding rightward at a fixed height. Both layers (near/far
       blur, see remeasureStupaLight + style.css) move as one unit. */
    const beamTransform = `scale(${beamP})`;
    stupaLightBeam.style.transform = beamTransform;
    stupaLightBeamFar.style.transform = beamTransform;
    stupaLightBeam.style.opacity = String(beamP);
    stupaLightBeamFar.style.opacity = String(beamP);
    /* Bloom opens in sync with near/far but is capped to a low peak
       (0.15, vs. their full 0→1) — it's ambient spill, not a third
       equally-strong wedge. */
    stupaLightBeamBloom.style.transform = beamTransform;
    stupaLightBeamBloom.style.opacity = String(beamP * 0.15);
    /* Card unravels left-to-right, starting exactly where the beam
       terminates (the card's left edge) — right-side clip shrinks
       from 100% (nothing visible) to 0% (fully visible) as cardP goes
       0→1, so it reads as the beam's leading edge uncovering the
       card, not the card just materializing. */
    heroSpotlightCard.style.clipPath = `inset(0 ${(1 - cardP) * 100}% 0 0)`;
    /* Text fades/lifts in only once the clip has fully unraveled — a
       second, layered beat after the card itself is uncovered, rather
       than fading in underneath the still-moving clip edge. */
    heroSpotlightCard.classList.toggle('is-revealed', cardP >= 1);
    stupaLight.classList.toggle('is-lit', t >= 1);
  }

  let avatarRestSize = 0;
  let nameRestW = 0, nameRestH = 0, nameRestFontPx = 0;
  /* Shared hub the avatar and name are always symmetric around (hub ±
     halfVec) — see the phase breakdown in the comment above. The arm's
     LENGTH (halfLen) is NOT interpolated between two fixed numbers —
     that was the actual bug (a scalar tuned for the small vertical
     rest-gap has no relation to how much horizontal clearance a WIDE
     name needs once rotated beside a circular avatar). Instead it's
     recomputed every frame in updateHero() from the real current
     geometry: a circle's reach toward the hub is always its radius,
     but a rectangle's reach depends on the angle you're approaching it
     from, so halfLen = avatarRadius + nameReach(angle) + gap, with
     nameReach = nameHalfW·|cos(angle)| + nameHalfH·|sin(angle)| (the
     standard support function of an axis-aligned box in a direction).
     That guarantees actual clearance at every instant, not just at the
     two endpoints. */
  let restHubX = 0, restHubY = 0, restAngle = 0, restGapPx = 0;
  let dockHubX = 0, dockHubY = 0;
  let angleDelta = 0;

  function remeasureHeroMorph() {
    /* Move back under .hero-morph first (a no-op on the very first
       call; on every later one — resize — they were relocated to
       <body> at the end of the previous call, see below) so the
       "unstyle, measure" step below reads their real flex-column rest
       layout, not wherever they'd land as a stray body child. */
    heroMorph.appendChild(heroAvatar);
    heroMorph.appendChild(heroMorphName);

    /* Measure the natural (CSS flex-column) rest layout by clearing
       any inline overrides first — same "unstyle, measure, restyle"
       trick the old single-transform version used. */
    heroAvatar.style.position = 'static';
    heroAvatar.style.transform = 'none';
    heroMorphName.style.position = 'static';
    heroMorphName.style.transform = 'none';

    const avatarRect = heroAvatar.getBoundingClientRect();
    const nameRect = heroMorphName.getBoundingClientRect();

    const avatarRestX = avatarRect.left + avatarRect.width / 2;
    const avatarRestY = avatarRect.top + avatarRect.height / 2;
    avatarRestSize = avatarRect.width;

    const nameRestX = nameRect.left + nameRect.width / 2;
    const nameRestY = nameRect.top + nameRect.height / 2;
    nameRestW = nameRect.width;
    nameRestH = nameRect.height;
    nameRestFontPx = parseFloat(getComputedStyle(heroMorphName).fontSize);

    restHubX = (avatarRestX + nameRestX) / 2;
    restHubY = (avatarRestY + nameRestY) / 2;
    const restVecX = avatarRestX - restHubX;
    const restVecY = avatarRestY - restHubY;
    restAngle = Math.atan2(restVecY, restVecX);
    /* Actual CSS gap between the avatar's bottom edge and the name's
       top edge at rest — the real starting spacing, not a guess. */
    restGapPx = nameRect.top - avatarRect.bottom;

    /* The scroll button sits centered below the name at rest — it
       only ever matters before any scrolling happens, so a one-time
       rest-position placement (not a per-frame transform like the
       avatar/name) is enough. */
    heroScrollBtn.style.left = `${nameRestX - HERO_SCROLL_BTN_SIZE / 2}px`;
    heroScrollBtn.style.top = `${nameRect.bottom + HERO_SCROLL_BTN_GAP}px`;

    /* Mobile role chip's REST position — centered under the name,
       touching (its live position during the dock transition is
       anchored directly to the name's own transform every frame in
       updateHero instead, see the isMobileViewport() branch there).
       Measures the chip's own natural size first (clearing any
       transform so the measurement isn't skewed by a stale scale),
       same "unstyle, measure, restyle" idea as the avatar/name above,
       then places it and pushes the down-arrow button down to clear
       whatever height it actually renders at. */
    if (isMobileViewport()) {
      mobileRoleChip.style.transform = 'none';
      const chipRect = mobileRoleChip.getBoundingClientRect();
      mobileRoleChipRestW = chipRect.width;
      mobileRoleChipRestH = chipRect.height;
      mobileRoleChip.style.transform = `translate(${nameRestX - mobileRoleChipRestW / 2}px, ${nameRect.bottom}px)`;
      const chipBottom = nameRect.bottom + mobileRoleChipRestH;
      heroScrollBtn.style.top = `${chipBottom + HERO_SCROLL_BTN_GAP}px`;
    }

    /* On mobile the name now has the role chip docked directly beneath
       it (see the isMobileViewport() branch in updateHero), so the
       docked pair reads as a two-line block (name, then chip) next to
       the avatar rather than one single-line label — the avatar's own
       dock center shifts down by this much so it stays vertically
       centered on that whole block instead of sitting high, centered
       on just the name's own line. Desktop has no chip below the name,
       so it isn't shifted. style.css's mobile --dock-center-y (which
       .hero-nav/.projects-nav-back-btn center themselves on) hand-copies
       this same 16px — keep both in sync if this ever changes. */
    const MOBILE_AVATAR_DOCK_Y_SHIFT = 16;
    const avatarDockCenterX = DOCK_SIDE + AVATAR_DOCK / 2;
    const avatarDockCenterY = DOCK_TOP + AVATAR_DOCK / 2 + (isMobileViewport() ? MOBILE_AVATAR_DOCK_Y_SHIFT : 0);
    /* Text width/height scale roughly with font-size for the same
       string, so this estimates the docked name's box well enough to
       place the hub/arm (width) and the mobile role chip below it
       (height) — exact to the pixel isn't needed either way. */
    const nameDockW = nameRestW * (dockNameFontPx() / nameRestFontPx);
    const nameDockCenterX = DOCK_SIDE + AVATAR_DOCK + DOCK_GAP + nameDockW / 2;
    /* Name itself stays anchored to the UNshifted row position — only
       the avatar moves down to meet it partway relative to the taller
       (name + chip) block; see the comment above. */
    const nameDockCenterY = DOCK_TOP + AVATAR_DOCK / 2;

    dockHubX = (avatarDockCenterX + nameDockCenterX) / 2;
    dockHubY = (avatarDockCenterY + nameDockCenterY) / 2;
    const dockVecX = avatarDockCenterX - dockHubX;
    const dockVecY = avatarDockCenterY - dockHubY;
    const dockAngle = Math.atan2(dockVecY, dockVecX);
    angleDelta = shortestAngleDelta(restAngle, dockAngle);

    heroAvatar.style.position = 'fixed';
    heroAvatar.style.left = '0';
    heroAvatar.style.top = '0';
    heroMorphName.style.position = 'fixed';
    heroMorphName.style.left = '0';
    heroMorphName.style.top = '0';

    /* Relocate to <body> now that they're position:fixed and their
       transform is purely viewport-px-based (no longer dependent on
       .hero-morph's own layout). This is the actual fix for a real
       bug: .hero has position:sticky, which — regardless of the
       avatar/name's own fixed positioning and high z-index — makes
       CSS treat .hero's entire subtree as ONE stacking-context unit
       when compared against outside siblings. Once .projects (a
       later sibling with z-index:190) existed, that whole unit lost
       to it, hiding the avatar/name/nav behind the panel even though
       their own z-index (200-220) is higher — z-index only compares
       within the same stacking context. Moving them to be direct
       body children escapes .hero's context entirely. */
    document.body.appendChild(heroAvatar);
    document.body.appendChild(heroMorphName);
  }

  /* Declared up here (not down by PROJECTS OVERLAY where it's actually
     set) because updateHero below reads it, and updateHero starts
     getting called — via onScroll() — well before that section runs. */
  let projectsOpen = false;

  /* forceMorphP: overrides morphP with an explicit value instead of
     deriving it from real scrollY. Two callers:
       - openProjects (see PROJECTS OVERLAY below) snaps straight to
         the fully-docked visual state — e.g. when "My Projects" is
         clicked from the hero itself, before any real scrolling has
         happened — without touching actual scrollY or the background
         pan/stupa-light (those stay tied to the real, unchanged scroll
         position, same as everything else this overlay doesn't
         actually navigate).
       - the down-button's arrange-then-scroll sequence (see
         animateArrangeThenScroll below, via activeForcedMorphP) drives
         morphP by hand for its whole run, since its first phase plays
         with scrollY not moving at all.
     Omitted (undefined) on every other call, which keeps morphP
     computed from real scroll exactly as before. */
  /* Pure — no side effects — so the Projects overlay's open/close dock
     animation (see animateProjectsDock below) can read "what morphP
     would be right now" as an animation start/end point without
     actually applying it (calling updateHero() itself would apply real
     scroll's value immediately, defeating the point of animating INTO
     that value from wherever the dock currently visually is). */
  function computeRealMorphP() {
    const pinHeight = heroPin.offsetHeight;
    const vh = window.innerHeight;
    const raw = (window.scrollY - heroPin.offsetTop) / (pinHeight - vh);
    const p = clamp01(raw);
    return clamp01((p - DOCK_START) / (DOCK_AT - DOCK_START));
  }

  function updateHero(forceMorphP) {
    const pinHeight = heroPin.offsetHeight;
    const vh = window.innerHeight;
    const raw = (window.scrollY - heroPin.offsetTop) / (pinHeight - vh);
    const p = clamp01(raw);
    const morphP = forceMorphP !== undefined ? forceMorphP : computeRealMorphP();
    const isDocked = heroMorph.classList.contains('is-docked');

    if (morphP >= 1 && !isDocked) {
      heroMorph.classList.add('is-docked');
      heroNav.classList.add('is-docked');
      heroNavBar.classList.add('is-docked');
      /* Mobile hero copy keys its own slide-in reveal off this same
         flag (see the mobile block in style.css) — no-op on wider
         viewports, where the class just sits unused on this element. */
      heroSpotlightCard.classList.add('is-docked');
    } else if (morphP < 1 && isDocked) {
      heroMorph.classList.remove('is-docked');
      heroNav.classList.remove('is-docked');
      heroNavBar.classList.remove('is-docked');
      heroSpotlightCard.classList.remove('is-docked');
    }

    /* The scroll button is only relevant before the transition starts
       — fade it out fast the instant scrolling begins (whether from
       its own click-triggered animation or, once unlocked, any other
       scroll) rather than lingering through the whole journey. */
    const btnFadeP = smoothstep(0, 0.04, morphP);
    heroScrollBtn.style.opacity = String(1 - btnFadeP);
    heroScrollBtn.style.pointerEvents = btnFadeP > 0 ? 'none' : 'auto';

    /* Three separate curves — see the comment above ARRANGE_PHASE_END
       for what each one drives. */
    const sizeP = smoothstep(0, 1, morphP);
    const rotateP = smoothstep(0, ARRANGE_PHASE_END, morphP);
    const travelP = smoothstep(ARRANGE_PHASE_END, 1, morphP);

    const avatarScale = 1 - (1 - TARGET_SCALE) * sizeP;
    const nameScale = 1 - (1 - dockNameFontPx() / nameRestFontPx) * sizeP;

    /* Reserves room for .projects-nav-back-btn at the left edge, so the
       avatar/name row lands right next to it instead of overlapping —
       only while the Projects panel is open, and scaled by travelP so
       it's already at full strength by the time the lockup actually
       reaches the corner, not a snap. On mobile the back button is its
       own separate size/inset (--nav-corner-btn-size/-inset, shared
       with the hamburger — see style.css), positioned independently of
       DOCK_SIDE, so the shift needed is "however far its right edge
       sits past where the avatar would normally start (DOCK_SIDE),
       plus the usual DOCK_GAP" rather than the desktop-only shorthand
       of just reusing the avatar's own dock width — desktop's back
       button (46px) happens to be sized/positioned off DOCK_SIDE/
       AVATAR_DOCK already, so it keeps that simpler original math. */
    const navBackShift = projectsOpen
      ? (isMobileViewport()
          ? NAV_CORNER_BTN_INSET + NAV_CORNER_BTN_SIZE + DOCK_GAP - DOCK_SIDE
          : AVATAR_DOCK + DOCK_GAP
        ) * travelP
      : 0;
    const hubX = restHubX + (dockHubX - restHubX) * travelP + navBackShift;
    const hubY = restHubY + (dockHubY - restHubY) * travelP;

    const angle = restAngle + angleDelta * rotateP;

    /* Precise spacing arc: halfLen isn't interpolated between two
       fixed numbers — it's derived every frame from the ACTUAL current
       sizes and angle, so there's a real guaranteed gap between the
       avatar's circle and the name's box at every instant, not just at
       the two endpoints. See the comment above restGapPx. */
    const avatarR = (avatarRestSize * avatarScale) / 2;
    const nameHalfW = (nameRestW * nameScale) / 2;
    const nameHalfH = (nameRestH * nameScale) / 2;
    const nameReach = nameHalfW * Math.abs(Math.cos(angle)) + nameHalfH * Math.abs(Math.sin(angle));
    const gapPx = restGapPx + (DOCK_GAP - restGapPx) * sizeP;
    /* avatarR + nameReach + gapPx is the needed distance BETWEEN the
       two elements; halfLen is the distance from the hub (their
       midpoint) to each one, so it's half of that. */
    const halfLen = (avatarR + nameReach + gapPx) / 2;

    const vecX = Math.cos(angle) * halfLen;
    const vecY = Math.sin(angle) * halfLen;

    const avatarCx = hubX + vecX;
    const avatarCy = hubY + vecY;
    heroAvatar.style.transform =
      `translate(${avatarCx - (avatarRestSize * avatarScale) / 2}px, ${avatarCy - (avatarRestSize * avatarScale) / 2}px) scale(${avatarScale})`;

    const nameCx = hubX - vecX;
    const nameCy = hubY - vecY;
    heroMorphName.style.transform =
      `translate(${nameCx - (nameRestW * nameScale) / 2}px, ${nameCy - (nameRestH * nameScale) / 2}px) scale(${nameScale})`;

    /* Mobile role chip anchored directly to the name's own live
       transform — not a separately tuned animation, but the same scale
       (nameScale) and a position pinned to the name's own current
       bottom edge (nameCy + nameHalfH, both already scaled), so it
       moves, shrinks, and docks exactly as the name does, as if it
       were physically attached to it.
       Positioned with the SAME explicit translate(center - scaledHalf-
       Size) technique as the avatar/name above (see avatarCx/nameCx),
       not a CSS translateX(%)/left combo — that earlier approach
       centered/shrank the chip's still-wide (60vw) rest-state box
       around ITS OWN unscaled width every frame, which silently
       dragged the visual left edge away from the name's real left
       edge as it scaled down, instead of landing flush under it.
       Horizontal target blends from the name's own center (rest) to a
       center point that puts the CHIP's (measured, scaled) left edge
       exactly on the name's left edge (docked); vertical target is the
       chip's top edge sitting at the name's bottom edge plus a gap
       that opens from 0 (touching, at rest) to MOBILE_ROLE_CHIP_DOCKED_GAP
       once docked — same idiom as gapPx above for the avatar/name
       arm's own spacing. */
    if (isMobileViewport()) {
      const chipGapPx = MOBILE_ROLE_CHIP_DOCKED_GAP * travelP;
      const chipHalfWScaled = (mobileRoleChipRestW * nameScale) / 2;
      const chipHalfHScaled = (mobileRoleChipRestH * nameScale) / 2;
      const nameLeftEdge = nameCx - nameHalfW;
      const chipCenterXAtDock = nameLeftEdge + chipHalfWScaled;
      const chipCenterX = nameCx + (chipCenterXAtDock - nameCx) * travelP;
      const chipTopEdge = nameCy + nameHalfH + chipGapPx;
      const chipCenterY = chipTopEdge + chipHalfHScaled;
      mobileRoleChip.style.transform =
        `translate(${chipCenterX - chipHalfWScaled}px, ${chipCenterY - chipHalfHScaled}px) scale(${nameScale})`;
    }

    /* The glass bar + mobile toggle fade AND slide in across the same
       travelP (avatar/name's actual migration to the corner) instead
       of an independent morphP window — so the nav only starts
       appearing once the lockup is actually underway toward the dock
       spot, and finishes exactly as it arrives, instead of running on
       its own disconnected schedule. The bar itself emerges from the
       left edge of the screen (translateX from -100% to 0) rather than
       just fading in place — a bare opacity fade made it easy to miss
       entirely, especially since `.hero-nav-bar` also switches from
       position: absolute to fixed right as travelP reaches 1 (see
       is-docked below), and a plain fade gave that switch nothing to
       visually mask if the two coordinate systems didn't line up
       exactly. A real slide-in reads clearly regardless. Each nav-link
       chip gets its own slice of that same travelP span and slides in
       from the left individually — Home settles into place, then
       About Me, then Projects. */
    heroNav.style.opacity = '1';
    heroNavBar.style.opacity = String(travelP);
    heroNavBar.style.transform = `translateX(${(travelP - 1) * 100}%)`;
    if (navToggle) navToggle.style.opacity = String(travelP);

    /* Each chip starts offset to the RIGHT of its own resting spot, by
       roughly the spacing between chips — since they're staggered in
       sequence (Home, then About Me, then Projects), each one starts
       close to where its next sibling is still sitting, so early on
       they read as a stack piled up near the right edge, peeling off
       leftward into place one at a time — i.e. emerging from the right
       side of the screen — rather than each traveling in independently
       from far away. */
    const NAV_LINK_SLIDE_PX = 140;
    const perLinkSpan = 1 / navLinkEls.length;
    navLinkEls.forEach((link, i) => {
      const linkStart = perLinkSpan * i;
      const linkP = smoothstep(linkStart, linkStart + perLinkSpan, travelP);
      link.style.opacity = String(linkP);
      link.style.transform = `translateX(${(1 - linkP) * NAV_LINK_SLIDE_PX}px)`;
    });

    const panPct = prefersReducedMotion ? BG_PAN_START : BG_PAN_START + p * (BG_PAN_END - BG_PAN_START);
    if (!prefersReducedMotion) {
      const bgAlignH = isMobileViewport() ? 'left' : 'center';
      heroBgImg.style.objectPosition = `${bgAlignH} ${panPct}%`;
    }
    updateStupaLight(panPct);
  }

  /* ═══════════════════════════════════════════════════════════
     HORIZONTAL-SCROLL TRAVEL GALLERY
     A different interaction model on purpose: vertical scroll
     through #travel-pin drives a horizontal translateX on the
     photo track, so the page's usual up-down rhythm briefly
     becomes side-to-side.
  ═══════════════════════════════════════════════════════════ */
  const travelPin = document.getElementById('travel-pin');
  const travelViewport = document.querySelector('.travel-viewport');
  const travelTrack = document.getElementById('travel-track');
  let travelMax = 0;

  function remeasureTravel() {
    travelMax = Math.max(0, travelTrack.scrollWidth - travelViewport.clientWidth);
  }

  function updateTravel() {
    const pinHeight = travelPin.offsetHeight;
    const vh = window.innerHeight;
    const raw = (window.scrollY - travelPin.offsetTop) / (pinHeight - vh);
    const p = clamp01(raw);
    travelTrack.style.transform = `translateX(${-p * travelMax}px)`;
  }

  /* ═══════════════════════════════════════════════════════════
     SCROLL PROGRESS BAR
  ═══════════════════════════════════════════════════════════ */
  const scrollProgressEl = document.getElementById('scroll-progress');
  function updateProgressBar() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const p = scrollable > 0 ? clamp01(window.scrollY / scrollable) : 0;
    scrollProgressEl.style.transform = `scaleX(${p})`;
  }

  /* ── single rAF-throttled scroll loop drives all three ─────── */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      updateHero(activeForcedMorphP);
      updateTravel();
      updateProgressBar();
      ticking = false;
    });
  }
  function onResize() {
    remeasureHeroMorph();
    remeasureTravel();
    remeasureStupaLight();
    /* Reapply whatever reveal progress we're currently at (0 before
       the first reveal or after resetting via the docked name, 1 once
       fully revealed) against the freshly-recomputed geometry —
       otherwise a resize mid-transition would snap the beam/card back
       to their un-revealed CSS defaults. */
    renderStupaReveal(stupaRevealP);
    onScroll();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  remeasureHeroMorph();
  remeasureTravel();
  remeasureStupaLight();
  renderStupaReveal(0);
  /* Balthazar/Baloo 2/Fraunces (headline, chip values, and button
     labels) all load async — a fallback-font measurement taken before
     they're in would leave both the buttons row a few px off from the
     real text width AND, more visibly, heroSpotlightCard's own height
     locked to the fallback-font content height. Since .hero-spotlight-
     content isn't flex-centered inside the card, that stale height
     shows up as top-aligned content with a big dead gap below the
     buttons instead of matching top/bottom padding — full remeasure
     (which also re-syncs the widths) fixes both. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      remeasureStupaLight();
      renderStupaReveal(stupaRevealP);
    });
  }
  onScroll();

  /* ═══════════════════════════════════════════════════════════
     PROJECT CARD CURSOR TILT
  ═══════════════════════════════════════════════════════════ */
  if (!prefersReducedMotion) {
    document.querySelectorAll('.project-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 8).toFixed(2)}deg) translateY(-6px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     NAV — mobile toggle + active-section highlight
  ═══════════════════════════════════════════════════════════ */
  const navLinks = document.getElementById('nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    navLinkEls.forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* #projects excluded — it's a position:fixed overlay (see PROJECTS
     OVERLAY below), not a normal in-flow scroll section, and its
     active-state is already handled directly by openProjects/
     closeProjects. Leaving it in here let it occasionally register a
     false isIntersecting (fixed + translateX(100%) sitting exactly at
     the viewport's right edge is prone to sub-pixel rounding overlap)
     and steal the active state from Home with no scroll ever
     happening to correct it back. */
  const sections = document.querySelectorAll('main section[id]:not(#projects)');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        navLinkEls.forEach((link) => {
          link.classList.toggle('active', link.dataset.section === entry.target.id);
        });
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  sections.forEach((section) => sectionObserver.observe(section));

  /* ═══════════════════════════════════════════════════════════
     GENERIC SCROLL-REVEAL
  ═══════════════════════════════════════════════════════════ */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (prefersReducedMotion) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* ═══════════════════════════════════════════════════════════
     PROGRAMMATIC SCROLL — hero button (down) + docked name (up)
     These are the only two triggers for moving the page — user scroll
     input stays blocked (see blockScrollInput above) permanently, and
     the scrollbar itself is hidden (see style.css) so there's no
     thumb to drag either. Both ends of the trip play the exact same
     kind of animation a manual scroll would (animating window.scrollTo
     in one continuous eased pass), so updateHero() drives the whole
     thing exactly as it already does for real scrolling — a single
     shared `scrollAnimating` flag stops the two from overlapping if
     both get triggered in quick succession. The optional onProgress
     callback (used only by the down button, to drive the stupa-light
     reveal) gets the same eased 0→1 value driving the scroll itself,
     every frame — piggybacking on this loop instead of a second
     scroll listener, so there's nothing else to conflict with. */
  let scrollAnimating = false;
  /* Set only while the down-button's arrange-then-scroll sequence
     below is running, so onScroll's own updateHero() call (fired by
     the scrollTo calls inside that sequence) reads the same forced
     value instead of racing it with the real-scroll formula. Always
     cleared back to undefined by the time the sequence ends, at which
     point real scrollY already matches what the forced value implied,
     so there's no jump on handoff. */
  let activeForcedMorphP;
  function animateScrollTo(endY, onProgress, duration = 2800) {
    if (scrollAnimating) return;
    scrollAnimating = true;
    heroScrollBtn.disabled = true;

    const startY = window.scrollY;

    /* Force instant scrolling for the duration of this hand-rolled
       animation — CSS `scroll-behavior: smooth` (set globally on html,
       for nav-link anchor jumps) would otherwise make the BROWSER try
       to smoothly animate toward each new scrollTo() target on top of
       the one from the previous frame, compounding into exactly the
       slow/stuttery motion this was meant to avoid. Restored after. */
    const prevScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    const scrollNow = (y) => window.scrollTo({ top: y, left: 0, behavior: 'auto' });

    function finish() {
      document.documentElement.style.scrollBehavior = prevScrollBehavior;
      heroScrollBtn.disabled = false;
      scrollAnimating = false;
    }

    if (prefersReducedMotion) {
      scrollNow(endY);
      if (onProgress) onProgress(1);
      finish();
      return;
    }

    /* One continuous eased scroll for the entire distance — no seam
       to hesitate at. A two-stage version (fast/slow split at DOCK_AT)
       was tried, but each stage decelerating to a near-stop before the
       next one re-accelerated read as the animation pausing partway. */
    const startTime = performance.now();

    function step(now) {
      const t = clamp01((now - startTime) / duration);
      const eased = t * t * (3 - 2 * t);
      scrollNow(startY + (endY - startY) * eased);
      if (onProgress) onProgress(eased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        finish();
      }
    }
    requestAnimationFrame(step);
  }

  /* Down-button sequence — ONE continuous scroll, not two separate
     phases handed off to each other. Earlier versions tried gluing a
     slow "arrange" segment to a faster "scroll" segment, each with its
     own hand-picked easing; no matter how those two curves were
     chosen, their velocities never actually matched at the handoff, so
     there was always a kink where they met — sometimes a dead stall
     (both sides slow), sometimes a jolt (one slow, one fast). A single
     curve can't have that seam, because there's only one velocity
     function for the whole trip, guaranteed continuous everywhere.
     Morph, the stupa-light/beam/card reveal, and scroll all run on
     DIFFERENT curves of the same t — not sequential phases (nothing is
     ever handed off mid-flight, so there's still no seam to speak of),
     just independent, all-smooth functions evaluated every frame:
       steadyEased = smootherstep(t)               — natural, even pace
       scrollEased = smootherstep(t ^ SCROLL_BIAS)  — held back longer
     scrollEased alone drives scrollY, so the page visibly waits a bit
     before it really gets moving, exactly as asked. steadyEased drives
     the reveal directly (0 to 1 over the full duration — an earlier
     version fed it scrollEased instead, whose own steep late ramp
     compressed the whole reveal into a rushed burst).
     activeForcedMorphP = clamp01(steadyEased / MORPH_DOCK_AT), not
     steadyEased directly — two bugs happened in sequence learning why
     it needs the rescale:
       1) An earlier version rescaled by the ORIGINAL real-scroll
          DOCK_AT (0.6), tuned back when this whole thing rode a single
          scroll-driven curve. Combined with smootherstep's own steep
          midsection, that squeezed the nav-link stagger (which only
          runs across morphP's ARRANGE_PHASE_END-to-1 stretch) into
          under half a second — barely enough to read as animating.
       2) Removing the rescale entirely (activeForcedMorphP =
          steadyEased) fixed that, but introduced a worse bug: morphP
          then only reaches 1 — the threshold `.is-docked` (which
          switches the nav from `position: absolute` to `position:
          fixed`, see updateHero() below) waits for — at t = 1, the
          very last instant of the whole animation. For nearly the
          entire trip the nav sat un-fixed, scrolling away with the
          rest of the hero, then snapped fixed and faded in abruptly on
          the final frame.
     MORPH_DOCK_AT ≈ 0.94 splits the difference: docking (and the
     nav's switch to position: fixed) now completes around 80% through
     the animation — comfortably before the very end, so there's no
     last-frame snap — while the ARRANGE_PHASE_END-to-1 stretch feeding
     the nav-link stagger still spans roughly a third of the total
     duration (~900ms), long enough to read as a real slide-in. */
  const SCROLL_BIAS = 1.6;
  const MORPH_DOCK_AT = 0.94;
  const DOWN_SCROLL_DURATION = 2700;
  function smootherstep(x) {
    return x * x * x * (x * (x * 6 - 15) + 10);
  }
  function animateArrangeThenScroll() {
    if (scrollAnimating) return;
    const pinScrollable = heroPin.offsetHeight - window.innerHeight;
    const startY = window.scrollY;
    const endY = heroPin.offsetTop + pinScrollable;

    function settle() {
      activeForcedMorphP = undefined;
      updateHero();
      heroScrollBtn.disabled = false;
      scrollAnimating = false;
    }

    if (prefersReducedMotion) {
      window.scrollTo({ top: endY, left: 0, behavior: 'auto' });
      renderStupaReveal(1);
      settle();
      return;
    }

    scrollAnimating = true;
    heroScrollBtn.disabled = true;
    const prevScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    const startTime = performance.now();

    function step(now) {
      const t = clamp01((now - startTime) / DOWN_SCROLL_DURATION);
      const steadyEased = smootherstep(t);
      const scrollEased = smootherstep(Math.pow(t, SCROLL_BIAS));
      window.scrollTo({ top: startY + (endY - startY) * scrollEased, left: 0, behavior: 'auto' });
      activeForcedMorphP = clamp01(steadyEased / MORPH_DOCK_AT);
      updateHero(activeForcedMorphP);
      renderStupaReveal(steadyEased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        document.documentElement.style.scrollBehavior = prevScrollBehavior;
        settle();
      }
    }
    requestAnimationFrame(step);
  }

  heroScrollBtn.addEventListener('click', animateArrangeThenScroll);

  /* The docked avatar/name lockup doubles as a "back to top" toggle —
     same animated scroll as the button above, just in reverse, instead
     of relying on the browser's own (much faster, un-eased-with-our-
     math) native smooth-scroll for the #hero anchor jump. Resets the
     stupa-light reveal back to fully hidden as it goes, playing it
     backwards in sync with the same eased scroll: startP (wherever the
     reveal actually was when clicked — usually 1, but this stays
     correct even if clicked mid-reveal) ramps down to 0 as `eased`
     ramps 0→1, so the next trip down plays the whole intro again. */
  heroMorph.addEventListener('click', (e) => {
    e.preventDefault();
    const startP = stupaRevealP;
    animateScrollTo(heroPin.offsetTop, (eased) => {
      renderStupaReveal(startP * (1 - eased));
    }, 1700);
    closeProjects();
  });

  /* ═══════════════════════════════════════════════════════════
     PROJECTS OVERLAY
     A full-viewport panel (see .projects in style.css) that slides in
     over the hero on click instead of being scrolled to — the docked
     avatar/name/nav sits at a higher z-index than the panel, so it
     stays exactly where it is, fully clickable, the whole time this
     is open. It's the way in (Projects link / the hero's My Projects
     button) AND, along with the nav's own back arrow
     (.projects-nav-back-btn), the way back out (Home link / the
     docked avatar also close it) — none of these actually move the
     underlying page, so closing just reveals whatever state it was
     already in before opening.

     Opening also forces the avatar/name/nav into their fully-docked
     state (see the forceMorphP param on updateHero above) even if
     you triggered this from the hero itself before ever scrolling —
     otherwise there'd be no docked nav bar for the back arrow to live
     in. Closing hands back off to the real, unchanged scroll position
     (calling updateHero() with no override), so it un-docks again if
     you genuinely hadn't scrolled. */
  const projectsSection = document.getElementById('projects');
  const projectsOpenTriggers = [
    document.getElementById('hero-spotlight-projects-btn'),
    document.querySelector('.nav-link[data-section="projects"]'),
  ];
  const projectsCloseTriggers = [
    projectsNavBackBtn,
    document.querySelector('.nav-link[data-section="hero"]'),
    document.querySelector('.nav-link[data-section="about"]'),
  ];

  /* Animates the avatar/name dock smoothly into (or back out of) the
     fully-docked state instead of an instant, one-frame updateHero(1)/
     updateHero() snap — that snap used to happen at the exact same
     moment the .projects panel itself starts its own (now 1.1s) slide,
     so on top of an already-fast slide, the nav visibly jumping to its
     final state in a single frame made the whole transition read as
     abrupt no matter how the panel's own transition was tuned.
     fromMorphP defaults to computeRealMorphP() (no side effects, unlike
     calling updateHero() to find out, which would apply and jump to
     that value immediately) — right for opening, where the dock really
     is wherever real scroll currently puts it. Closing passes 1
     explicitly instead, since the dock is visually AT 1 the whole time
     the panel's open (forced there by the open animation), regardless
     of real scroll position underneath — computeRealMorphP() at that
     point would just describe where scroll already was, which is very
     often NOT 1, and starting "from" that would skip most of the
     animation instead of unwinding it. */
  function animateProjectsDock(targetMorphP, fromMorphP = computeRealMorphP()) {
    const DOCK_TRANSITION_DURATION = 450;
    const startTime = performance.now();
    function step(now) {
      const t = clamp01((now - startTime) / DOCK_TRANSITION_DURATION);
      const eased = smootherstep(t);
      updateHero(fromMorphP + (targetMorphP - fromMorphP) * eased);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function openProjects(e) {
    if (e) e.preventDefault();
    projectsSection.classList.add('is-open');
    projectsSection.setAttribute('aria-hidden', 'false');
    navLinkEls.forEach((link) => link.classList.toggle('active', link.dataset.section === 'projects'));
    projectsOpen = true;
    if (projectsNavBackBtn) projectsNavBackBtn.classList.add('is-visible');
    animateProjectsDock(1);
  }
  function closeProjects() {
    projectsSection.classList.remove('is-open');
    projectsSection.setAttribute('aria-hidden', 'true');
    /* Closing always lands back on the hero (nothing else is actually
       scrollable/visible behind the overlay yet) — the scroll-based
       sectionObserver won't fire to fix this on its own since closing
       never triggers a real scroll. */
    navLinkEls.forEach((link) => link.classList.toggle('active', link.dataset.section === 'hero'));
    projectsOpen = false;
    if (projectsNavBackBtn) projectsNavBackBtn.classList.remove('is-visible');
    animateProjectsDock(computeRealMorphP(), 1);
  }

  projectsOpenTriggers.forEach((el) => el && el.addEventListener('click', openProjects));
  projectsCloseTriggers.forEach((el) => el && el.addEventListener('click', closeProjects));
});
