const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 min — aligned with backend sync interval
const STORAGE_PREFIX = 'api_cache:';
const MAX_STORAGE_ENTRY = 512 * 1024; // skip sessionStorage for entries > 512 KB

const memStore = new Map();
const inflight = new Map();

function stableKey(path, params) {
  const entries = Object.entries(params || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return `${path}?${entries.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

function getEntry(key) {
  const now = Date.now();

  // 1. Memory (fastest)
  const mem = memStore.get(key);
  if (mem && (now - mem.at) < mem.ttl) return mem.data;
  if (mem) memStore.delete(key);

  // 2. sessionStorage (survives page refresh)
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (raw) {
      const entry = JSON.parse(raw);
      if ((now - entry.at) < (entry.ttl || DEFAULT_TTL_MS)) {
        memStore.set(key, entry); // promote back to memory
        return entry.data;
      }
      sessionStorage.removeItem(STORAGE_PREFIX + key);
    }
  } catch { /* ignore */ }

  return undefined;
}

function setEntry(key, data, ttlMs) {
  const entry = { data, at: Date.now(), ttl: ttlMs };
  memStore.set(key, entry);

  // Persist smaller entries to sessionStorage
  try {
    const json = JSON.stringify(entry);
    if (json.length <= MAX_STORAGE_ENTRY) {
      sessionStorage.setItem(STORAGE_PREFIX + key, json);
    }
  } catch {
    evictOldest();
    try {
      const json = JSON.stringify(entry);
      if (json.length <= MAX_STORAGE_ENTRY) {
        sessionStorage.setItem(STORAGE_PREFIX + key, json);
      }
    } catch { /* give up */ }
  }
}

function evictOldest() {
  const entries = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (!k?.startsWith(STORAGE_PREFIX)) continue;
    try {
      const val = JSON.parse(sessionStorage.getItem(k));
      entries.push({ key: k, at: val.at || 0 });
    } catch {
      sessionStorage.removeItem(k);
    }
  }
  entries.sort((a, b) => a.at - b.at);
  const toRemove = Math.max(1, Math.floor(entries.length / 2));
  for (let i = 0; i < toRemove; i++) {
    sessionStorage.removeItem(entries[i].key);
  }
}

export async function withCache(path, params, loader, { ttlMs = DEFAULT_TTL_MS, signal } = {}) {
  const key = stableKey(path, params);

  const cached = getEntry(key);
  if (cached !== undefined) return cached;

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    try {
      const data = await loader({ signal });
      setEntry(key, data, ttlMs);
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function invalidateCache(prefix) {
  if (!prefix) {
    memStore.clear();
  } else {
    for (const key of memStore.keys()) {
      if (key.startsWith(prefix)) memStore.delete(key);
    }
  }
  const keysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (!k?.startsWith(STORAGE_PREFIX)) continue;
    if (!prefix || k.startsWith(STORAGE_PREFIX + prefix)) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => sessionStorage.removeItem(k));
}
