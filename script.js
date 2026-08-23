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
  const heroNav = document.getElementById('hero-nav');
  const heroNavBar = document.getElementById('hero-nav-bar');
  const navToggle = document.getElementById('nav-toggle');
  const navLinkEls = document.querySelectorAll('.nav-link');
  const stupaLight = document.getElementById('stupa-light');
  const stupaLightGlow = document.getElementById('stupa-light-glow');
  const stupaLightCore = document.getElementById('stupa-light-core');
  const stupaLightBeam = document.getElementById('stupa-light-beam');
  const heroSpotlightCard = document.getElementById('hero-spotlight-card');

  const rootStyles = getComputedStyle(document.documentElement);
  const DOCK_TOP = parseFloat(rootStyles.getPropertyValue('--dock-top'));
  const DOCK_SIDE = parseFloat(rootStyles.getPropertyValue('--dock-side'));
  const AVATAR_BASE = parseFloat(rootStyles.getPropertyValue('--avatar-base'));
  const AVATAR_DOCK = parseFloat(rootStyles.getPropertyValue('--avatar-dock'));
  const TARGET_SCALE = AVATAR_DOCK / AVATAR_BASE;

  /* hero-bg.jpg's own object-position starts at "center 22%" (see
     .hero-bg-img in style.css). Panning it further down as you scroll
     is what makes the background feel like it's carrying along with
     you, instead of sitting frozen behind the content. */
  const BG_PAN_START = 22;
  const BG_PAN_END = 100;

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
  const ARRANGE_PHASE_END = 0.45;
  const HERO_SCROLL_BTN_SIZE = 64; // matches .hero-scroll-btn's width/height
  const HERO_SCROLL_BTN_GAP = 28;

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
  const CARD_ASPECT = 660 / 1312;
  /* How far down the card's height the glow sits (matches the ~0.3
     ratio from the original Figma frame). Fixed relative to the glow
     — NOT derived from viewport centering — so the beam's taper always
     has a real point to aim at, at any viewport size or scroll
     position, instead of clamping to a corner when the glow's rest
     position happens to fall outside a viewport-centered box. */
  const CARD_TOP_FRACTION = 0.48;
  /* Extra flat pixel lift on top of the proportional fraction above —
     a simple "nudge it up a bit more" knob independent of card height. */
  const CARD_EXTRA_LIFT = 10;

  let lightScale = 1;
  let lightXPx = 0;
  let lightExcessHOrig = 0;
  let cardTopLocal = 0;

  function remeasureStupaLight() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    lightScale = Math.max(vw / IMG_W, vh / IMG_H);
    const excessWOrig = IMG_W - vw / lightScale;
    lightExcessHOrig = IMG_H - vh / lightScale;
    const windowLeftOrig = excessWOrig / 2;
    lightXPx = (STUPA_TOP_COL - windowLeftOrig) * lightScale;
    stupaLightCore.style.width = `${LIGHT_CORE_ORIG * lightScale}px`;
    stupaLightCore.style.height = `${LIGHT_CORE_ORIG * lightScale}px`;
    stupaLightGlow.style.width = `${LIGHT_GLOW_ORIG * lightScale}px`;
    stupaLightGlow.style.height = `${LIGHT_GLOW_ORIG * lightScale}px`;

    /* Horizontal is safe to derive from the viewport: lightXPx only
       changes on resize (there's no horizontal pan), so it's stable
       for the whole scroll range, unlike the light's y-position. */
    const cardPaddingRight = clampPx(CARD_PADDING_RIGHT_MIN, vw * CARD_PADDING_RIGHT_VW, CARD_PADDING_RIGHT_MAX);
    const cardW = clampPx(CARD_W_MIN, vw * CARD_W_VW, CARD_W_MAX);
    const cardH = cardW * CARD_ASPECT;
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
    heroSpotlightCard.style.width = `${cardW}px`;
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
    stupaLightBeam.style.left = '0px';
    stupaLightBeam.style.top = `${cardTop}px`;
    stupaLightBeam.style.width = `${beamW}px`;
    stupaLightBeam.style.height = `${beamH}px`;
    stupaLightBeam.style.clipPath = `polygon(0 ${apexYPct}%, 100% 0%, 100% 100%)`;
    stupaLightBeam.style.filter = `blur(${beamH * 0.08}px)`;
  }

  function updateStupaLight(panPct) {
    const windowTopOrig = (panPct / 100) * lightExcessHOrig;
    const yPx = (STUPA_TOP_ROW - windowTopOrig) * lightScale;
    stupaLight.style.transform = `translate(${lightXPx}px, ${yPx}px)`;
    heroSpotlightCard.style.top = `${yPx + cardTopLocal}px`;
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

    const avatarDockCenterX = DOCK_SIDE + AVATAR_DOCK / 2;
    const avatarDockCenterY = DOCK_TOP + AVATAR_DOCK / 2;
    /* Text width scales roughly with font-size for the same string, so
       this estimates the docked name's width well enough to place the
       hub/arm — exact to the pixel isn't needed. */
    const nameDockW = nameRestW * (DOCK_NAME_FONT_PX / nameRestFontPx);
    const nameDockCenterX = DOCK_SIDE + AVATAR_DOCK + DOCK_GAP + nameDockW / 2;
    const nameDockCenterY = avatarDockCenterY;

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
  }

  function updateHero() {
    const pinHeight = heroPin.offsetHeight;
    const vh = window.innerHeight;
    const raw = (window.scrollY - heroPin.offsetTop) / (pinHeight - vh);
    const p = clamp01(raw);
    const morphP = clamp01((p - DOCK_START) / (DOCK_AT - DOCK_START));
    const isDocked = heroMorph.classList.contains('is-docked');

    if (morphP >= 1 && !isDocked) {
      heroMorph.classList.add('is-docked');
      heroNav.classList.add('is-docked');
      heroNavBar.classList.add('is-docked');
    } else if (morphP < 1 && isDocked) {
      heroMorph.classList.remove('is-docked');
      heroNav.classList.remove('is-docked');
      heroNavBar.classList.remove('is-docked');
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
    const nameScale = 1 - (1 - DOCK_NAME_FONT_PX / nameRestFontPx) * sizeP;

    const hubX = restHubX + (dockHubX - restHubX) * travelP;
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

    /* The glass bar + mobile toggle fade in across the same travelP
       (avatar/name's actual migration to the corner) instead of an
       independent morphP window — so the nav only starts appearing
       once the lockup is actually underway toward the dock spot, and
       finishes exactly as it arrives, instead of running on its own
       disconnected schedule. Each nav-link chip gets its own slice of
       that same travelP span and slides in from the left individually
       — Home settles into place, then About Me, then Projects. */
    heroNav.style.opacity = '1';
    heroNavBar.style.opacity = String(travelP);
    if (navToggle) navToggle.style.opacity = String(travelP);

    /* Each chip starts offset to the RIGHT of its own resting spot, by
       roughly the spacing between chips — since they're staggered in
       sequence (Home, then About Me, then Projects), each one starts
       close to where its next sibling is still sitting, so early on
       they read as a stack piled up near the right edge, peeling off
       leftward into place one at a time rather than each traveling in
       independently from far away. */
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
      heroBgImg.style.objectPosition = `center ${panPct}%`;
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
      updateHero();
      updateTravel();
      updateProgressBar();
      ticking = false;
    });
  }
  function onResize() {
    remeasureHeroMorph();
    remeasureTravel();
    remeasureStupaLight();
    onScroll();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  remeasureHeroMorph();
  remeasureTravel();
  remeasureStupaLight();
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

  const sections = document.querySelectorAll('main section[id]');
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
     HERO SCROLL BUTTON
     The only trigger for the dock transition — user scroll input stays
     blocked (see blockScrollInput above) permanently, this button and
     nav-link anchor clicks are the only way to move the page. Plays
     the exact same scroll-driven animation a manual scroll through
     #hero-pin would (animating window.scrollTo from the current
     position all the way to the end of the pin, in one continuous
     eased pass), so updateHero() drives the whole thing exactly as it
     already does for real scrolling. */
  let heroScrollRunning = false;
  heroScrollBtn.addEventListener('click', () => {
    if (heroScrollRunning) return;
    heroScrollRunning = true;
    heroScrollBtn.disabled = true;

    const startY = window.scrollY;
    const pinScrollable = heroPin.offsetHeight - window.innerHeight;
    const endY = heroPin.offsetTop + pinScrollable;

    /* Force instant scrolling for the duration of this hand-rolled
       animation — CSS `scroll-behavior: smooth` (set globally on html,
       for nav-link anchor jumps) would otherwise make the BROWSER try
       to smoothly animate toward each new scrollTo() target on top of
       the one from the previous frame, compounding into exactly the
       slow/stuttery motion this was meant to avoid. Restored after. */
    const prevScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    const scrollNow = (y) => window.scrollTo({ top: y, left: 0, behavior: 'auto' });

    if (prefersReducedMotion) {
      scrollNow(endY);
      document.documentElement.style.scrollBehavior = prevScrollBehavior;
      heroScrollRunning = false;
      return;
    }

    /* One continuous eased scroll for the entire distance — no seam
       to hesitate at. A two-stage version (fast/slow split at DOCK_AT)
       was tried, but each stage decelerating to a near-stop before the
       next one re-accelerated read as the animation pausing partway. */
    const duration = 3000;
    const startTime = performance.now();

    function step(now) {
      const t = clamp01((now - startTime) / duration);
      const eased = t * t * (3 - 2 * t);
      scrollNow(startY + (endY - startY) * eased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        document.documentElement.style.scrollBehavior = prevScrollBehavior;
        heroScrollRunning = false;
      }
    }
    requestAnimationFrame(step);
  });
});
