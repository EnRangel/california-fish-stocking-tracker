// node:test provides Node's built-in test() function.
import test from "node:test";

// The strict assertion library compares values without automatic conversion.
import assert from "node:assert/strict";

import {
  combineCdfwStockingRecords,
  doesStockingMatchSearch,
  isUsableStocking,
  normalizeAnnouncementStatus,
  normalizeCdfwFeature,
  normalizeCdfwScheduleRecords
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

// Verify that a complete normalized stocking can be displayed safely.
test("accepts a complete stocking record", () => {
  // Arrange: include every field required by isUsableStocking().
  const completeStocking = {
    waterId: 123,
    waterName: "June Lake",
    fishType: "Rainbow Trout",
    counties: "Mono",
    plantingWeekStart: "2026-10-19",
    latitude: 37.779,
    longitude: -119.075,
    status: "future"
  };

  // Act: ask the validation function whether the record is usable.
  const actualResult =
    isUsableStocking(completeStocking);

  const expectedResult = true;

  // Assert: a complete record should pass validation.
  assert.equal(
    actualResult,
    expectedResult
  );
});

// Verify that an invalid coordinate prevents a record from being displayed.
test("rejects a stocking with an invalid coordinate", () => {
  // Arrange: Number.NaN represents a value that could not become a number.
  const stockingWithInvalidCoordinate = {
    waterId: 123,
    waterName: "June Lake",
    fishType: "Rainbow Trout",
    counties: "Mono",
    plantingWeekStart: "2026-10-19",
    latitude: Number.NaN,
    longitude: -119.075,
    status: "future"
  };

  // Act: validate the incomplete record.
  const actualResult =
    isUsableStocking(stockingWithInvalidCoordinate);

  const expectedResult = false;

  // Assert: a bad coordinate should cause validation to fail.
  assert.equal(
    actualResult,
    expectedResult
  );
});

// Verify that live schedule rows receive coordinates from ArcGIS water data.
test("adds ArcGIS coordinates to a live schedule record", () => {
  const scheduleRecords = [
    {
      waterId: 27445,
      waterName: "Doane Pond",
      fishType: "Trout",
      counties: "San Diego",
      plantingWeekStart: "2026-10-25",
      status: "future"
    }
  ];

  const locationFeatures = [
    {
      attributes: {
        StockingWaterID: 27445,
        WaterName: "Doane Pond",
        Lat: "33.340149",
        Lon: "-116.901329"
      }
    }
  ];

  const actualRecords =
    normalizeCdfwScheduleRecords(
      scheduleRecords,
      locationFeatures
    );

  const expectedRecords = [
    {
      waterId: 27445,
      waterName: "Doane Pond",
      fishType: "Trout",
      counties: "San Diego",
      plantingWeekStart: "2026-10-25",
      latitude: 33.340149,
      longitude: -116.901329,
      status: "future"
    }
  ];

  assert.deepEqual(
    actualRecords,
    expectedRecords
  );
});

// Verify that the live schedule wins when both sources describe one event.
test("combines CDFW sources without duplicate events", () => {
  const duplicateRecentRecord = {
    waterId: 27445,
    waterName: "Doane Pond",
    fishType: "Trout",
    counties: "San Diego",
    plantingWeekStart: "2026-10-25",
    latitude: 33.340149,
    longitude: -116.901329,
    status: "recent"
  };

  const differentRecentRecord = {
    waterId: 27445,
    waterName: "Doane Pond",
    fishType: "Trout",
    counties: "San Diego",
    plantingWeekStart: "2026-10-04",
    latitude: 33.340149,
    longitude: -116.901329,
    status: "recent"
  };

  const liveScheduleRecord = {
    waterId: 27445,
    waterName: "Doane Pond",
    fishType: "Trout",
    counties: "San Diego",
    plantingWeekStart: "2026-10-25",
    latitude: 33.340149,
    longitude: -116.901329,
    status: "future"
  };

  const actualRecords = combineCdfwStockingRecords(
    [duplicateRecentRecord, differentRecentRecord],
    [liveScheduleRecord]
  );

  const expectedRecords = [
    liveScheduleRecord,
    differentRecentRecord
  ];

  assert.deepEqual(
    actualRecords,
    expectedRecords
  );
});
