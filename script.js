document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── helpers ─────────────────────────────────────────────── */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smoothstep = (edge0, edge1, x) => {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
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
  const heroNav = document.getElementById('hero-nav');
  const heroNavBar = document.getElementById('hero-nav-bar');
  const stupaLight = document.getElementById('stupa-light');
  const stupaLightGlow = document.getElementById('stupa-light-glow');
  const stupaLightCore = document.getElementById('stupa-light-core');

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

  /* The morph (avatar shrink/travel, nav fade-in, dock) is rescaled to
     finish at this fraction of the pin scroll instead of the very end
     (1.0), so consolidation happens well before the scroll is done.
     Background panning keeps using the raw, un-rescaled progress the
     whole way, so it keeps moving through the rest of the photo after
     docking. */
  const DOCK_AT = 0.4;

  /* Yellow light embedded pixel-for-pixel in hero-bg.jpg (1728x1727),
     sitting on the stupa's spire tip at column 190, row 1065 (sampled
     directly from the photo). Its screen size and position are
     derived from the exact object-fit:cover math the background pan
     already uses — the scale factor (how much bigger than its native
     1728x1727 the photo is currently rendered) is applied to the
     light's own "native pixel" size, so it grows/shrinks with the
     photo instead of staying a fixed CSS size. remeasureStupaLight()
     handles the viewport-dependent parts (scale, x, glow/core size —
     resize only); updateStupaLight() handles the pan-dependent y
     position every scroll frame, since the photo keeps moving after
     the header has already docked. */
  const IMG_W = 1728;
  const IMG_H = 1727;
  const STUPA_TOP_COL = 175;
  const STUPA_TOP_ROW = 1108;
  const LIGHT_CORE_ORIG = 16;
  const LIGHT_GLOW_ORIG = 90;

  let lightScale = 1;
  let lightXPx = 0;
  let lightExcessHOrig = 0;

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
  }

  function updateStupaLight(panPct) {
    const windowTopOrig = (panPct / 100) * lightExcessHOrig;
    const yPx = (STUPA_TOP_ROW - windowTopOrig) * lightScale;
    stupaLight.style.transform = `translate(${lightXPx}px, ${yPx}px)`;
  }

  let dockDx = 0;
  let dockDy = 0;

  function remeasureHeroMorph() {
    const wasDocked = heroMorph.classList.contains('is-docked');
    if (wasDocked) {
      heroMorph.classList.remove('is-docked');
      heroNav.classList.remove('is-docked');
      heroNavBar.classList.remove('is-docked');
    }
    heroMorph.style.transform = 'none';
    const rect = heroMorph.getBoundingClientRect();
    dockDx = DOCK_SIDE - rect.left;
    dockDy = DOCK_TOP - rect.top;
    if (wasDocked) {
      heroMorph.classList.add('is-docked');
      heroNav.classList.add('is-docked');
      heroNavBar.classList.add('is-docked');
    }
  }

  function updateHero() {
    const pinHeight = heroPin.offsetHeight;
    const vh = window.innerHeight;
    const raw = (window.scrollY - heroPin.offsetTop) / (pinHeight - vh);
    const p = clamp01(raw);
    const morphP = clamp01(p / DOCK_AT);
    const isDocked = heroMorph.classList.contains('is-docked');

    if (morphP >= 1) {
      if (!isDocked) {
        heroMorph.classList.add('is-docked');
        heroNav.classList.add('is-docked');
        heroNavBar.classList.add('is-docked');
        heroMorph.style.transform = '';
      }
    } else {
      if (isDocked) {
        heroMorph.classList.remove('is-docked');
        heroNav.classList.remove('is-docked');
        heroNavBar.classList.remove('is-docked');
      }
      const scale = 1 - (1 - TARGET_SCALE) * morphP;
      heroMorph.style.transform = `translate(${dockDx * morphP}px, ${dockDy * morphP}px) scale(${scale})`;
    }

    const navP = smoothstep(0.55, 1, morphP);
    heroNav.style.opacity = String(navP);
    heroNavBar.style.opacity = String(navP);

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
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  const navLinkEls = document.querySelectorAll('.nav-link');

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
     DEBUG: SCROLL PREVIEW BUTTON
     Temporary — plays the hero scroll animation smoothly and
     deterministically by animating window.scrollTo directly,
     bypassing trackpad/wheel input entirely (which is what was
     causing the glitchy playback). Remove this block along with
     #scroll-preview-btn in index.html and .debug-scroll-btn in
     style.css once the animation is solid.
  ═══════════════════════════════════════════════════════════ */
  const scrollPreviewBtn = document.getElementById('scroll-preview-btn');
  if (scrollPreviewBtn) {
    let previewRunning = false;
    scrollPreviewBtn.addEventListener('click', () => {
      if (previewRunning) return;
      previewRunning = true;
      scrollPreviewBtn.disabled = true;
      scrollPreviewBtn.textContent = 'Playing…';

      const startY = window.scrollY;
      const endY = heroPin.offsetTop + (heroPin.offsetHeight - window.innerHeight);
      const duration = 5000;
      const startTime = performance.now();

      function step(now) {
        const t = clamp01((now - startTime) / duration);
        const eased = t * t * (3 - 2 * t);
        window.scrollTo(0, startY + (endY - startY) * eased);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          previewRunning = false;
          scrollPreviewBtn.disabled = false;
          scrollPreviewBtn.textContent = '▶ Preview scroll';
        }
      }
      requestAnimationFrame(step);
    });
  }
});
