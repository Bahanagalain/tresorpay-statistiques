// ─────────────────────────────────────────────────────────────────────
// TresorPay Statistiques — Service de cache en mémoire avec TTL
// ─────────────────────────────────────────────────────────────────────

const store = new Map();

/**
 * Récupère une valeur du cache.
 * @param {string} key
 * @returns {*|null} La valeur ou null si expirée/absente
 */
export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Stocke une valeur dans le cache avec un TTL en secondes.
 * @param {string} key
 * @param {*} value
 * @param {number} ttlSeconds - Durée de vie en secondes (défaut 300 = 5 min)
 */
export function cacheSet(key, value, ttlSeconds = 300) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Invalide une clé ou toutes les clés correspondant à un préfixe.
 * @param {string} keyOrPrefix
 */
export function cacheInvalidate(keyOrPrefix) {
  if (store.has(keyOrPrefix)) {
    store.delete(keyOrPrefix);
    return;
  }
  // Invalider par préfixe
  for (const key of store.keys()) {
    if (key.startsWith(keyOrPrefix)) {
      store.delete(key);
    }
  }
}

/**
 * Vide tout le cache.
 */
export function cacheClear() {
  store.clear();
}

/**
 * Wrapper : récupère du cache ou exécute la fonction et met en cache.
 * @param {string} key
 * @param {Function} fn - Fonction async qui retourne la valeur
 * @param {number} ttlSeconds
 * @returns {Promise<*>}
 */
export async function cacheGetOrSet(key, fn, ttlSeconds = 300) {
  const cached = cacheGet(key);
  if (cached !== null) return cached;
  const value = await fn();
  cacheSet(key, value, ttlSeconds);
  return value;
}
