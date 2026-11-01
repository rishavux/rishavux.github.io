// Tunable settings. Each can be overridden from the URL, e.g. ?showHeadshot=false
const SETTINGS = {
  showHeadshot: true, // hero portrait
  showSkills: true,   // "Practice" line in About
};

const params = new URLSearchParams(location.search);
for (const key of Object.keys(SETTINGS)) {
  if (params.has(key)) SETTINGS[key] = params.get(key) !== 'false';
}

document.querySelectorAll('[data-setting]').forEach((el) => {
  el.classList.toggle('is-hidden', !SETTINGS[el.dataset.setting]);
});
document.querySelector('.hero').classList.toggle('no-portrait', !SETTINGS.showHeadshot);

// Phone menu: the nav folds behind a "Menu" button below 600px
const header = document.querySelector('.site-header');
const menuToggle = header.querySelector('.menu-toggle');
const setMenu = (open) => {
  header.classList.toggle('is-open', open);
  menuToggle.setAttribute('aria-expanded', open);
  menuToggle.textContent = open ? 'Close' : 'Menu';
};
menuToggle.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
header.querySelectorAll('.site-nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && header.classList.contains('is-open')) { setMenu(false); menuToggle.focus(); }
});

// Active nav item: whichever section crosses the middle of the screen (none while in the hero)
const navLinks = [...header.querySelectorAll('.site-nav a[href^="#"]')];
const spy = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting) continue;
    for (const a of navLinks) {
      if (a.hash === '#' + target.id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  }
}, { rootMargin: '-50% 0px -50% 0px' });
document.querySelectorAll('.hero, main > section[id]').forEach((s) => spy.observe(s));
