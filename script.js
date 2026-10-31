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
