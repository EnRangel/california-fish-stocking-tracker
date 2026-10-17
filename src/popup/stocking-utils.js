// -----------------------------------------------------------------------------
// Stocking data utilities
// -----------------------------------------------------------------------------
//
// These functions do not access the DOM, network, or Firefox storage.
// Keeping them independent makes them easier to understand and test.

// Convert CDFW's announcement period into one of our status values.
export function normalizeAnnouncementStatus(announcePeriod) {
  if (announcePeriod === "current") {
    return "current";
  }

  if (announcePeriod === "future") {
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
