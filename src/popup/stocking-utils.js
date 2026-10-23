// -----------------------------------------------------------------------------
// Stocking data utilities
// -----------------------------------------------------------------------------
//
// These functions do not access the DOM, network, or Firefox storage.
// Keeping them independent makes them easier to understand and test.

// Remote text does not need to be unlimited to describe a stocking record.
// Length limits reduce memory usage if an upstream response is malformed.
const MAX_WATER_NAME_LENGTH = 200;
const MAX_FISH_TYPE_LENGTH = 100;
const MAX_COUNTIES_LENGTH = 200;

// A Set is useful when we only need to ask whether a value is allowed.
const ALLOWED_STOCKING_STATUSES = new Set([
  "recent",
  "current",
  "future"
]);

// Check a required text field without accepting whitespace-only or huge text.
function isUsableText(value, maximumLength) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximumLength
  );
}

// Confirm that a value is a real YYYY-MM-DD calendar date.
function isValidIsoDate(dateText) {
  if (
    typeof dateText !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateText)
  ) {
    return false;
  }

  const dateParts = dateText.split("-").map(Number);
  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];

  // Date.UTC() avoids local time-zone changes while validating the pieces.
  const dateForValidation = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    dateForValidation.getUTCFullYear() === year &&
    dateForValidation.getUTCMonth() === month - 1 &&
    dateForValidation.getUTCDate() === day
  );
}

// Convert CDFW's announcement period into one of our status values.
export function normalizeAnnouncementStatus(announcePeriod) {
  const normalizedAnnouncementPeriod =
    typeof announcePeriod === "string"
      ? announcePeriod.trim().toLowerCase()
      : "";

  if (normalizedAnnouncementPeriod === "current") {
    return "current";
  }

  if (normalizedAnnouncementPeriod === "future") {
    return "future";
  }

  // The API date query already limits past records to the previous 60 days.
  return "recent";
}

// Convert one raw ArcGIS feature into our application's stocking format.
export function normalizeCdfwFeature(feature) {
  // A malformed server record may omit attributes. Using an empty object lets
  // the normal validation step reject that record instead of crashing.
  const hasAttributes =
    feature &&
    typeof feature.attributes === "object" &&
    feature.attributes !== null;

  const attributes = hasAttributes
    ? feature.attributes
    : {};

  return {
    waterId: attributes.StockingWaterID,
    waterName: attributes.WaterName,
    fishType: attributes.FishType,
    counties: attributes.Counties,
    plantingWeekStart: attributes.WeekOfPlantStart,

    // Number() ensures the coordinates are JavaScript numbers.
    latitude: Number(attributes.Lat),
    longitude: Number(attributes.Lon),

    status: normalizeAnnouncementStatus(
      attributes.AnnouncePeriod
    )
  };
}

// Check whether a normalized record has every value needed by the UI.
export function isUsableStocking(stocking) {
  if (
    typeof stocking !== "object" ||
    stocking === null
  ) {
    return false;
  }

  const hasWaterId =
    Number.isSafeInteger(stocking.waterId) &&
    stocking.waterId > 0;

  const hasWaterName =
    isUsableText(
      stocking.waterName,
      MAX_WATER_NAME_LENGTH
    );

  const hasFishType =
    isUsableText(
      stocking.fishType,
      MAX_FISH_TYPE_LENGTH
    );

  const hasCounties =
    isUsableText(
      stocking.counties,
      MAX_COUNTIES_LENGTH
    );

  const hasPlantingWeek =
    isValidIsoDate(stocking.plantingWeekStart);

  const hasCoordinates =
    Number.isFinite(stocking.latitude) &&
    stocking.latitude >= -90 &&
    stocking.latitude <= 90 &&
    Number.isFinite(stocking.longitude) &&
    stocking.longitude >= -180 &&
    stocking.longitude <= 180;

  const hasAllowedStatus =
    ALLOWED_STOCKING_STATUSES.has(stocking.status);

  return (
    hasWaterId &&
    hasWaterName &&
    hasFishType &&
    hasCounties &&
    hasPlantingWeek &&
    hasCoordinates &&
    hasAllowedStatus
  );
}

// Normalize all raw features and remove records the UI cannot display safely.
export function normalizeCdfwFeatures(rawFeatures) {
  // map() converts every raw feature into our preferred object format.
  const normalizedStockings = rawFeatures.map(
    (feature) => {
      return normalizeCdfwFeature(feature);
    }
  );

  // filter() creates a new array containing only usable records.
  const usableStockings = normalizedStockings.filter(
    (stocking) => {
      return isUsableStocking(stocking);
    }
  );

  const skippedRecordCount =
    normalizedStockings.length - usableStockings.length;

  if (skippedRecordCount > 0) {
    console.warn(
      `Skipped ${skippedRecordCount} incomplete CDFW records.`
    );
  }

  return usableStockings;
}

// Add ArcGIS coordinates to records parsed from the live CDFW schedule.
export function normalizeCdfwScheduleRecords(
  scheduleRecords,
  locationFeatures
) {
  // Map stores one coordinate object under each water ID.
  const locationsByWaterId = new Map();

  for (const locationFeature of locationFeatures) {
    const hasAttributes =
      locationFeature &&
      typeof locationFeature.attributes === "object" &&
      locationFeature.attributes !== null;

    // Ignore a malformed location instead of interrupting every record.
    if (!hasAttributes) {
      continue;
    }

    const attributes = locationFeature.attributes;
    const waterId = Number(attributes.StockingWaterID);
    const latitude = Number(attributes.Lat);
    const longitude = Number(attributes.Lon);

    const hasValidLocation =
      Number.isSafeInteger(waterId) &&
      waterId > 0 &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180;

    if (
      hasValidLocation &&
      !locationsByWaterId.has(waterId)
    ) {
      locationsByWaterId.set(waterId, {
        latitude: latitude,
        longitude: longitude
      });
    }
  }

  const normalizedScheduleRecords = [];
  let skippedRecordCount = 0;

  for (const scheduleRecord of scheduleRecords) {
    const location =
      locationsByWaterId.get(scheduleRecord.waterId);

    // Begin with missing coordinates. If a matching location exists, replace
    // them with the ArcGIS numbers before validation.
    let latitude;
    let longitude;

    if (location) {
      latitude = location.latitude;
      longitude = location.longitude;
    }

    const normalizedStocking = {
      waterId: scheduleRecord.waterId,
      waterName: scheduleRecord.waterName,
      fishType: scheduleRecord.fishType,
      counties: scheduleRecord.counties,
      plantingWeekStart:
        scheduleRecord.plantingWeekStart,
      latitude: latitude,
      longitude: longitude,
      status: scheduleRecord.status
    };

    if (isUsableStocking(normalizedStocking)) {
      normalizedScheduleRecords.push(
        normalizedStocking
      );
    } else {
      skippedRecordCount += 1;
    }
  }

  if (skippedRecordCount > 0) {
    console.warn(
      `Skipped ${skippedRecordCount} live schedule records ` +
      "without usable ArcGIS coordinates."
    );
  }

  return normalizedScheduleRecords;
}

// Create a key that identifies one water, week, and fish combination.
function createStockingRecordKey(stocking) {
  return (
    `${stocking.waterId}|` +
    `${stocking.plantingWeekStart}|` +
    stocking.fishType.toLowerCase()
  );
}

// Combine both official sources without displaying duplicate stocking events.
export function combineCdfwStockingRecords(
  recentRecords,
  liveScheduleRecords
) {
  const combinedRecords = [];
  const includedRecordKeys = new Set();

  // Add the live schedule first because it has the newest status information.
  for (const scheduleRecord of liveScheduleRecords) {
    const recordKey =
      createStockingRecordKey(scheduleRecord);

    if (!includedRecordKeys.has(recordKey)) {
      combinedRecords.push(scheduleRecord);
      includedRecordKeys.add(recordKey);
    }
  }

  // Add recent ArcGIS records that were not already supplied by the schedule.
  for (const recentRecord of recentRecords) {
    const recordKey =
      createStockingRecordKey(recentRecord);

    if (!includedRecordKeys.has(recordKey)) {
      combinedRecords.push(recentRecord);
      includedRecordKeys.add(recordKey);
    }
  }

  return combinedRecords;
}

// Create a Google Maps search URL using a stocking's coordinates.
export function createGoogleMapsUrl(latitude, longitude) {
  const googleMapsUrl = new URL(
    "https://www.google.com/maps/search/"
  );

  googleMapsUrl.searchParams.set("api", "1");
  googleMapsUrl.searchParams.set(
    "query",
    `${latitude},${longitude}`
  );

  return googleMapsUrl.toString();
}

// Convert a millisecond timestamp into a short date and time.
export function formatLastUpdatedTime(timestamp) {
  const updatedDate = new Date(timestamp);

  return updatedDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

// Convert a date such as "2026-09-20" into "September 20, 2026".
export function formatPlantingWeek(dateString) {
  const dateParts = dateString
    .split("-")
    .map(Number);

  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];

  // JavaScript counts months from zero, so subtract one from the month.
  const plantingDate = new Date(year, month - 1, day);

  return plantingDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

// Add the appropriate singular or plural county label.
export function formatCounties(counties) {
  const hasMultipleCounties = counties.includes(",");

  const countyLabel = hasMultipleCounties
    ? "Counties"
    : "County";

  return `${counties} ${countyLabel}`;
}

// Convert an internal status value into text shown to the user.
export function getStatusLabel(status) {
  if (status === "current") {
    return "Current schedule";
  }

  if (status === "future") {
    return "Future schedule";
  }

  return "Recently stocked";
}

// Check whether a stocking contains the user's search text.
export function doesStockingMatchSearch(stocking, query) {
  // Lowercase both sides so searches are not case-sensitive.
  const normalizedQuery = query.trim().toLowerCase();

  // An empty search should show every stocking in the selected tab.
  if (normalizedQuery === "") {
    return true;
  }

  const normalizedWaterName =
    stocking.waterName.toLowerCase();

  const normalizedFishType =
    stocking.fishType.toLowerCase();

  const normalizedCounties =
    stocking.counties.toLowerCase();

  // includes() checks whether one string contains another string.
  const waterNameMatches =
    normalizedWaterName.includes(normalizedQuery);

  const fishTypeMatches =
    normalizedFishType.includes(normalizedQuery);

  const countyMatches =
    normalizedCounties.includes(normalizedQuery);

  // A record is included when any searchable field matches.
  return (
    waterNameMatches ||
    fishTypeMatches ||
    countyMatches
  );
}
