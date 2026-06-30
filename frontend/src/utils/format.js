export function formatMontant(value, currency = 'FCFA') {
  const num = Number(value) || 0;
  const formatted = num.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  return `${formatted} ${currency}`;
}

export function formatMontantCompact(value) {
  const num = Number(value) || 0;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} Mrd`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)} k`;
  return num.toLocaleString('fr-FR');
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatPourcentage(value, decimals = 1) {
  const num = Number(value) || 0;
  return `${num.toFixed(decimals)}%`;
}

export function formatNombre(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('fr-FR');
}
