// node:test provides Node's built-in test() function.
import test from "node:test";

// Strict assertions fail when actual and expected values differ.
import assert from "node:assert/strict";

import {
  isStockingCacheFresh
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