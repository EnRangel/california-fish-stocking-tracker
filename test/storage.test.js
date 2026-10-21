// node:test provides Node's built-in test() function.
import test from "node:test";

// Strict assertions fail when actual and expected values differ.
import assert from "node:assert/strict";

import {
  isStockingCacheFresh,
  loadStockingCache
} from "../src/popup/storage.js";

// Verify that data downloaded recently is still considered fresh.
test("considers a recent stocking cache fresh", () => {
  // Arrange: calculate a timestamp from five minutes ago.
  const currentTime = Date.now();

  const fiveMinutesInMilliseconds =
    5 * 60 * 1000;

  const fiveMinutesAgo =
    currentTime - fiveMinutesInMilliseconds;

  const recentCache = {
    records: [],
    fetchedAt: fiveMinutesAgo
  };

  // Act: ask the storage function whether this cache is fresh.
  const actualResult = isStockingCacheFresh(recentCache);

  const expectedResult = true;

  // Assert: fail if the function did not return the expected value.
  assert.equal(
    actualResult,
    expectedResult
  );
});

// Verify that data older than six hours is considered expired.
test("considers an old stocking cache expired", () => {
  // Arrange: calculate a timestamp from seven hours ago.
  const currentTime = Date.now();

  const sevenHoursInMilliseconds =
    7 * 60 * 60 * 1000;

  const sevenHoursAgo =
    currentTime - sevenHoursInMilliseconds;

  const oldCache = {
    records: [],
    fetchedAt: sevenHoursAgo
  };

  // Act: ask the storage function whether this cache is fresh.
  const actualResult = isStockingCacheFresh(oldCache);

  const expectedResult = false;

  // Assert: an expired cache should produce false.
  assert.equal(
    actualResult,
    expectedResult
  );
});
////////////////////////
// mocking a dependency -> Firefox storage is the dependency, and our fake object is the mock
// Verify that a valid cache can be loaded from Firefox storage.
test("loads a valid stocking cache", async () => {
  // Arrange: create the data we want fake Firefox storage to contain.
  const savedRecords = [
    {
      waterId: 123,
      waterName: "June Lake"
    }
  ];

  const savedCache = {
    records: savedRecords,
    fetchedAt: 123456789
  };

  // Save the original global value so it can be restored after the test.
  const originalBrowser = globalThis.browser;

  // Create a fake version of browser.storage.local.get().
  // It is async because the real Firefox method returns a Promise.
  const fakeGet = async (requestedKey) => {
    const expectedStorageKey = "stockingCache";

    // Confirm that our application requests the correct storage key.
    assert.equal(
      requestedKey,
      expectedStorageKey
    );

    // Firefox returns an object whose property matches the requested key.
    const fakeStoredData = {
      stockingCache: savedCache
    };

    return fakeStoredData;
  };

  // Build the nested object structure used by the Firefox API.
  const fakeLocalStorage = {
    get: fakeGet
  };

  const fakeStorage = {
    local: fakeLocalStorage
  };

  const fakeBrowser = {
    storage: fakeStorage
  };

  // Temporarily make the fake browser API globally available.
  globalThis.browser = fakeBrowser;

  try {
    // Act: run the real application function against fake storage.
    const actualCache =
      await loadStockingCache();

    const expectedCache = savedCache;

    // Assert: compare the returned object and its nested values.
    assert.deepEqual(
      actualCache,
      expectedCache
    );
  } finally {
    // Restore the original value so other tests are not affected.
    globalThis.browser = originalBrowser;
  }
});