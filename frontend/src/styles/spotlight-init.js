// ── Spotlight effect: track mouse position relative to each [data-glow] card ──
// Imported once in main.jsx — sets --mouse-x and --mouse-y on each glow card
// Also applies user appearance preferences (glow size/hue/intensity) from localStorage.

export const DEFAULT_APPEARANCE = {
  glowEnabled: true,
  glowSize: 250,      // px, radius of the spotlight
  glowHue: 150,       // 0-360 color hue (150 = green)
  glowIntensity: 1,   // 0-1 opacity multiplier
};

export function loadAppearanceSettings() {
  try {
    const raw = localStorage.getItem('appearance_settings');
    return raw ? { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) } : DEFAULT_APPEARANCE;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearanceSettings(settings) {
  localStorage.setItem('appearance_settings', JSON.stringify(settings));
  applyAppearanceSettings(settings);
  window.dispatchEvent(new Event('appearance-settings-changed'));
}

export function applyAppearanceSettings(settings = loadAppearanceSettings()) {
  const root = document.documentElement;
  root.style.setProperty('--user-glow-size', `${settings.glowSize}px`);
  root.style.setProperty('--user-glow-hue', String(settings.glowHue));
  root.style.setProperty('--user-glow-intensity-mul', String(settings.glowIntensity));
  root.dataset.glowEnabled = settings.glowEnabled ? 'true' : 'false';
}

applyAppearanceSettings();

let rafId = null;
let lastX = 0;
let lastY = 0;

function updateGlowCards() {
  const cards = document.querySelectorAll('[data-glow]');
  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const x = lastX - rect.left;
    const y = lastY - rect.top;
    card.style.setProperty('--mouse-x', x.toFixed(0));
    card.style.setProperty('--mouse-y', y.toFixed(0));
  });
  rafId = null;
}

function onPointerMove(e) {
  lastX = e.clientX;
  lastY = e.clientY;
  if (!rafId) {
    rafId = requestAnimationFrame(updateGlowCards);
  }
}

document.addEventListener('pointermove', onPointerMove, { passive: true });
