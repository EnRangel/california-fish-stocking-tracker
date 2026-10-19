// node:test provides Node's built-in test() function.
import test from "node:test";

// The strict assertion library compares values without automatic conversion.
import assert from "node:assert/strict";

import {
  doesStockingMatchSearch,
  normalizeAnnouncementStatus
} from "../src/popup/stocking-utils.js";

// Verify that CDFW announcement values become our application statuses.
test("normalizes announcement statuses", () => {
  assert.equal(
    normalizeAnnouncementStatus("current"),
    "current"
  );

  assert.equal(
    normalizeAnnouncementStatus("future"),
    "future"
  );

  // Older records inside our 60-day window appear as recently stocked.
  assert.equal(
    normalizeAnnouncementStatus("past"),
    "recent"
  );
});

// Verify that search ignores capitalization and checks multiple fields.
test("searches water, species, and county fields", () => {
  const stocking = {
    waterName: "June Lake",
    fishType: "Rainbow Trout",
    counties: "Mono"
  };

  assert.equal(
    doesStockingMatchSearch(stocking, "june"),
    true
  );

  assert.equal(
    doesStockingMatchSearch(stocking, "TROUT"),
    true
  );

  assert.equal(
    doesStockingMatchSearch(stocking, "mono"),
    true
  );

  assert.equal(
    doesStockingMatchSearch(stocking, "salmon"),
    false
  );
});

// An empty search should not hide any records.
test("an empty search matches every stocking", () => {
  const stocking = {
    waterName: "June Lake",
    fishType: "Rainbow Trout",
    counties: "Mono"
  };

  assert.equal(
    doesStockingMatchSearch(stocking, ""),
    true
  );

  // trim() removes surrounding spaces before the comparison.
  assert.equal(
    doesStockingMatchSearch(stocking, "   "),
    true
  );
});