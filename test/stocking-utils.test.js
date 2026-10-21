// node:test provides Node's built-in test() function.
import test from "node:test";

// The strict assertion library compares values without automatic conversion.
import assert from "node:assert/strict";

import {
  doesStockingMatchSearch,
  normalizeAnnouncementStatus,
  normalizeCdfwFeature
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

// Verify that a raw ArcGIS feature becomes the format used by our application.
test("normalizes a raw CDFW feature", () => {
  // Arrange: create an object shaped like a record returned by ArcGIS.
  const rawFeature = {
    attributes: {
      StockingWaterID: 123,
      WaterName: "June Lake",
      FishType: "Rainbow Trout",
      Counties: "Mono",
      WeekOfPlantStart: "2026-10-19",
      Lat: "37.779",
      Lon: "-119.075",
      AnnouncePeriod: "future"
    }
  };

  // Act: convert the external CDFW format into our application format.
  const actualStocking =
    normalizeCdfwFeature(rawFeature);

  // Arrange the exact object that we expect our function to create.
  const expectedStocking = {
    waterId: 123,
    waterName: "June Lake",
    fishType: "Rainbow Trout",
    counties: "Mono",
    plantingWeekStart: "2026-10-19",
    latitude: 37.779,
    longitude: -119.075,
    status: "future"
  };

  // Assert: compare every property in both objects.
  assert.deepEqual(
    actualStocking,
    expectedStocking
  );
});
