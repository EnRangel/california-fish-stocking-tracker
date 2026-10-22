// -----------------------------------------------------------------------------
// Firefox local storage
// -----------------------------------------------------------------------------

// Keep downloaded stocking records for six hours.
// 6 hours × 60 minutes × 60 seconds × 1,000 milliseconds
const CACHE_LIFETIME_MS = 6 * 60 * 60 * 1000;

// Version 2 identifies caches that include the live current/future schedule.
const CURRENT_CACHE_VERSION = 2;

// Read and validate the saved stocking-data cache.
export async function loadStockingCache() {
  const storedData =
    await browser.storage.local.get("stockingCache");

  const cache = storedData.stockingCache;

  // Return null when no cache exists.
  if (!cache) {
    return null;
  }

  // Reject older cache shapes created before live schedule integration.
  if (cache.version !== CURRENT_CACHE_VERSION) {
    return null;
  }

  // Return null if the cached records are not an array.
  if (!Array.isArray(cache.records)) {
    return null;
  }

  // Return null if the cache timestamp is missing or invalid.
  if (!Number.isFinite(cache.fetchedAt)) {
    return null;
  }

  return cache;
}

// Determine whether a cache is still inside its six-hour lifetime.
export function isStockingCacheFresh(cache) {
  const currentTime = Date.now();
  const cacheAge = currentTime - cache.fetchedAt;

  return cacheAge < CACHE_LIFETIME_MS;
}

// Save normalized records and the current time into Firefox storage.
export async function saveStockingCache(records) {
  const cache = {
    version: CURRENT_CACHE_VERSION,
    records: records,
    fetchedAt: Date.now()
  };

  await browser.storage.local.set({
    stockingCache: cache
  });

  // Return the cache so the caller can use its timestamp.
  return cache;
}

// Read the saved array of favorite water IDs from Firefox storage.
export async function loadFavoriteWaterIds() {
  const storedData =
    await browser.storage.local.get("favoriteWaterIds");

  // Validate the stored value before using it as an array.
  if (Array.isArray(storedData.favoriteWaterIds)) {
    return storedData.favoriteWaterIds;
  }

  // New users do not have saved favorites, so return an empty array.
  return [];
}

// Save the supplied favorite-water array into Firefox storage.
export async function saveFavoriteWaterIds(favoriteWaterIds) {
  await browser.storage.local.set({
    favoriteWaterIds: favoriteWaterIds
  });
}
