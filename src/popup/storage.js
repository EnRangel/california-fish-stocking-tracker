import {
  isUsableStocking
} from "./stocking-utils.js";

// -----------------------------------------------------------------------------
// Firefox local storage
// -----------------------------------------------------------------------------

// Keep downloaded stocking records for six hours.
// 6 hours × 60 minutes × 60 seconds × 1,000 milliseconds
const CACHE_LIFETIME_MS = 6 * 60 * 60 * 1000;

// Version 2 identifies caches that include the live current/future schedule.
const CURRENT_CACHE_VERSION = 2;

// These limits keep corrupted or manually modified extension storage from
// making the popup process an unreasonable number of items.
const MAX_CACHED_RECORD_COUNT = 10_000;
const MAX_FAVORITE_COUNT = 1_000;

// Return a clean array containing each positive integer water ID only once.
function normalizeFavoriteWaterIds(favoriteWaterIds) {
  const normalizedWaterIds = [];

  if (!Array.isArray(favoriteWaterIds)) {
    return normalizedWaterIds;
  }

  for (const waterId of favoriteWaterIds) {
    const isValidWaterId =
      Number.isSafeInteger(waterId) && waterId > 0;

    const isAlreadyIncluded =
      normalizedWaterIds.includes(waterId);

    if (isValidWaterId && !isAlreadyIncluded) {
      normalizedWaterIds.push(waterId);
    }

    if (normalizedWaterIds.length >= MAX_FAVORITE_COUNT) {
      break;
    }
  }

  return normalizedWaterIds;
}

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

  if (cache.records.length > MAX_CACHED_RECORD_COUNT) {
    return null;
  }

  // every() returns true only when each cached record passes validation.
  const containsOnlyUsableRecords =
    cache.records.every((record) => {
      return isUsableStocking(record);
    });

  if (!containsOnlyUsableRecords) {
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
  const isValidRecordArray =
    Array.isArray(records) &&
    records.length <= MAX_CACHED_RECORD_COUNT &&
    records.every((record) => {
      return isUsableStocking(record);
    });

  if (!isValidRecordArray) {
    throw new Error("Cannot save an invalid stocking cache");
  }

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

  // New users receive an empty array. Existing values are validated and
  // deduplicated before the popup is allowed to use them.
  return normalizeFavoriteWaterIds(
    storedData.favoriteWaterIds
  );
}

// Save the supplied favorite-water array into Firefox storage.
export async function saveFavoriteWaterIds(favoriteWaterIds) {
  const normalizedWaterIds =
    normalizeFavoriteWaterIds(favoriteWaterIds);

  await browser.storage.local.set({
    favoriteWaterIds: normalizedWaterIds
  });
}
