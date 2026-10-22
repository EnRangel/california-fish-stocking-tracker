// -----------------------------------------------------------------------------
// Stocking data utilities
// -----------------------------------------------------------------------------
//
// These functions do not access the DOM, network, or Firefox storage.
// Keeping them independent makes them easier to understand and test.

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
  const attributes = feature.attributes;

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
  const hasWaterId =
    Number.isInteger(stocking.waterId);

  const hasWaterName =
    typeof stocking.waterName === "string" &&
    stocking.waterName.length > 0;

  const hasFishType =
    typeof stocking.fishType === "string" &&
    stocking.fishType.length > 0;

  const hasCounties =
    typeof stocking.counties === "string" &&
    stocking.counties.length > 0;

  const hasPlantingWeek =
    typeof stocking.plantingWeekStart === "string" &&
    stocking.plantingWeekStart.length > 0;

  const hasCoordinates =
    Number.isFinite(stocking.latitude) &&
    Number.isFinite(stocking.longitude);

  return (
    hasWaterId &&
    hasWaterName &&
    hasFishType &&
    hasCounties &&
    hasPlantingWeek &&
    hasCoordinates
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
    const attributes = locationFeature.attributes;
    const waterId = Number(attributes.StockingWaterID);
    const latitude = Number(attributes.Lat);
    const longitude = Number(attributes.Lon);

    const hasValidLocation =
      Number.isInteger(waterId) &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude);

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
