function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getDateRangeFromPreset(datePreset, customStartDate, customEndDate) {
  const now = new Date();

  switch (datePreset) {
    case 'today':
      return {
        startDate: formatDate(now),
        endDate: formatDate(now),
      };
    case 'month':
      return {
        startDate: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: formatDate(now),
      };
    case 'custom':
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    default:
      return {
        startDate: undefined,
        endDate: undefined,
      };
  }
}

function normalizeRegionKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function formatRegionAmount(value) {
  return `${value.toFixed(1)} M`;
}

export function mergeRegionTelemetry(staticRegions, telemetry = []) {
  const telemetryById = new Map();
  const telemetryByName = new Map();

  telemetry.forEach((item) => {
    telemetryById.set(normalizeRegionKey(item.id), item);
    telemetryByName.set(normalizeRegionKey(item.name), item);
  });

  return staticRegions.map((region) => {
    const telemetryItem =
      telemetryById.get(normalizeRegionKey(region.id)) ||
      telemetryByName.get(normalizeRegionKey(region.name));

    if (!telemetryItem) return region;

    return {
      ...region,
      status: telemetryItem.status || region.status,
      value: formatRegionAmount(telemetryItem.value),
      target: formatRegionAmount(telemetryItem.target),
    };
  });
}
