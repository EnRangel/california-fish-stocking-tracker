// -----------------------------------------------------------------------------
// CDFW ArcGIS configuration
// -----------------------------------------------------------------------------

// This ArcGIS endpoint contains historical stocking records and water locations.
const CDFW_QUERY_URL =
  "https://services2.arcgis.com/" +
  "Uq9r85Potqm3MfRV/ArcGIS/rest/services/" +
  "biosds2897_fmu/FeatureServer/0/query";

// The MVP defines "recent" as the previous 60 days.
const RECENT_DAY_COUNT = 60;

// Request a manageable number of records from ArcGIS at one time.
const CDFW_PAGE_SIZE = 500;

// Convert a Date object into the YYYY-MM-DD format expected by ArcGIS.
function formatDateForArcGis(date) {
  const year = date.getFullYear();

  // padStart() turns a value such as "9" into "09".
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Return a new array containing each valid water ID only once.
function getUniqueWaterIds(waterIds) {
  const uniqueWaterIds = [];

  for (const waterId of waterIds) {
    const isValidWaterId = Number.isInteger(waterId);
    const isAlreadyIncluded =
      uniqueWaterIds.includes(waterId);

    if (isValidWaterId && !isAlreadyIncluded) {
      uniqueWaterIds.push(waterId);
    }
  }

  return uniqueWaterIds;
}

// Download every ArcGIS page produced by a URL-building function.
async function fetchAllArcGisPages(createQueryUrl) {
  // const prevents reassignment, but items can still be added to the array.
  const allFeatures = [];

  // The first page begins before any records have been skipped.
  let resultOffset = 0;

  // Start as true because we always need to request the first page.
  let hasMorePages = true;

  while (hasMorePages) {
    // The supplied function builds the correct query for the current offset.
    const queryUrl = createQueryUrl(resultOffset);
    const response = await fetch(queryUrl);

    // fetch() does not automatically throw for HTTP errors.
    if (!response.ok) {
      throw new Error(
        `CDFW request failed with status ${response.status}`
      );
    }

    const responseData = await response.json();

    // ArcGIS may include an error inside a successful HTTP response.
    if (responseData.error) {
      throw new Error(
        responseData.error.message ||
        "CDFW returned an error"
      );
    }

    if (!Array.isArray(responseData.features)) {
      throw new Error(
        "CDFW response did not contain a features array"
      );
    }

    const pageFeatures = responseData.features;

    for (const feature of pageFeatures) {
      allFeatures.push(feature);
    }

    console.log(
      `Downloaded ${pageFeatures.length} records ` +
      `starting at offset ${resultOffset}.`
    );

    // Prevent an endless loop if the server claims more data exists but
    // provides no records that could move the offset forward.
    if (
      responseData.exceededTransferLimit === true &&
      pageFeatures.length === 0
    ) {
      throw new Error(
        "CDFW pagination stopped making progress"
      );
    }

    hasMorePages =
      responseData.exceededTransferLimit === true;

    resultOffset += pageFeatures.length;
  }

  return allFeatures;
}

// Build an ArcGIS URL for records from the previous 60 days forward.
export function createCdfwQueryUrl(resultOffset = 0) {
  const cutoffDate = new Date();

  // Remove the current time so the comparison is based on calendar dates.
  cutoffDate.setHours(0, 0, 0, 0);

  cutoffDate.setDate(
    cutoffDate.getDate() - RECENT_DAY_COUNT
  );

  const cutoffDateString =
    formatDateForArcGis(cutoffDate);

  const queryUrl = new URL(CDFW_QUERY_URL);

  queryUrl.searchParams.set(
    "where",
    `WeekOfPlantStart >= DATE '${cutoffDateString}'`
  );

  queryUrl.searchParams.set(
    "outFields",
    [
      "StockingWaterID",
      "WaterName",
      "WeekOfPlantStart",
      "FishType",
      "Counties",
      "Lat",
      "Lon",
      "AnnouncePeriod"
    ].join(",")
  );

  queryUrl.searchParams.set("returnGeometry", "false");

  queryUrl.searchParams.set(
    "orderByFields",
    "WeekOfPlantStart DESC"
  );

  queryUrl.searchParams.set(
    "resultOffset",
    String(resultOffset)
  );

  queryUrl.searchParams.set(
    "resultRecordCount",
    String(CDFW_PAGE_SIZE)
  );

  queryUrl.searchParams.set("f", "json");

  return queryUrl.toString();
}

// Build a separate ArcGIS URL that finds coordinates for scheduled water IDs.
export function createWaterLocationsQueryUrl(
  waterIds,
  resultOffset = 0
) {
  const uniqueWaterIds =
    getUniqueWaterIds(waterIds);

  if (uniqueWaterIds.length === 0) {
    throw new Error(
      "At least one water ID is required for a location query"
    );
  }

  const waterIdList = uniqueWaterIds.join(",");
  const queryUrl = new URL(CDFW_QUERY_URL);

  // IDs come from CDFW's own schedule links and are validated as integers.
  queryUrl.searchParams.set(
    "where",
    `StockingWaterID IN (${waterIdList})`
  );

  queryUrl.searchParams.set(
    "outFields",
    "StockingWaterID,WaterName,Lat,Lon"
  );

  queryUrl.searchParams.set("returnGeometry", "false");

  // Historical rows repeat a water, so request only distinct locations.
  queryUrl.searchParams.set(
    "returnDistinctValues",
    "true"
  );

  queryUrl.searchParams.set(
    "resultOffset",
    String(resultOffset)
  );

  queryUrl.searchParams.set(
    "resultRecordCount",
    String(CDFW_PAGE_SIZE)
  );

  queryUrl.searchParams.set("f", "json");

  return queryUrl.toString();
}

// Download recent raw stocking features from every ArcGIS page.
export async function fetchCdfwFeatures() {
  return fetchAllArcGisPages((resultOffset) => {
    return createCdfwQueryUrl(resultOffset);
  });
}

// Download coordinate records for the waters in the live schedule.
export async function fetchCdfwWaterLocations(waterIds) {
  const uniqueWaterIds =
    getUniqueWaterIds(waterIds);

  // An empty live schedule needs no coordinate request.
  if (uniqueWaterIds.length === 0) {
    return [];
  }

  return fetchAllArcGisPages((resultOffset) => {
    return createWaterLocationsQueryUrl(
      uniqueWaterIds,
      resultOffset
    );
  });
}
