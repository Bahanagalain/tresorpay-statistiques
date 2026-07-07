function currentLang() {
  try {
    return localStorage.getItem('lang') === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

function localeFor(lang) {
  return lang === 'en' ? 'en-US' : 'fr-FR';
}

export function formatEntier(n, lang) {
  const value = Number(n ?? 0);
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(localeFor(lang || currentLang()), {
    maximumFractionDigits: 0,
  }).format(Math.trunc(value));
}

export function formatMontant(n, lang) {
  return `${formatEntier(n, lang)} FCFA`;
}
