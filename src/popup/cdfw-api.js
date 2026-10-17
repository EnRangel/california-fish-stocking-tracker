// -----------------------------------------------------------------------------
// CDFW API configuration
// -----------------------------------------------------------------------------

// This is the public ArcGIS query endpoint for CDFW planting locations.
const CDFW_QUERY_URL =
  "https://services2.arcgis.com/" +
  "Uq9r85Potqm3MfRV/ArcGIS/rest/services/" +
  "biosds2897_fmu/FeatureServer/0/query";

// The MVP defines "recent" as the previous 60 days.
const RECENT_DAY_COUNT = 60;

// Request a manageable number of records from CDFW at one time.
const CDFW_PAGE_SIZE = 500;

// Convert a Date object into the YYYY-MM-DD format expected by ArcGIS.
function formatDateForArcGis(date) {
  const year = date.getFullYear();

  // padStart() turns a value such as "9" into "09".
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Build a CDFW URL that requests records from the previous 60 days forward.
// export makes this function available to files that import it.
export function createCdfwQueryUrl(resultOffset = 0) {
  const cutoffDate = new Date();

  // Remove the current time so the comparison is based on calendar dates.
  cutoffDate.setHours(0, 0, 0, 0);

  // Move the date backward by our chosen recent-day count.
  cutoffDate.setDate(
    cutoffDate.getDate() - RECENT_DAY_COUNT
  );

  const cutoffDateString =
    formatDateForArcGis(cutoffDate);

  const queryUrl = new URL(CDFW_QUERY_URL);

  // ArcGIS supports SQL-like conditions through its "where" parameter.
  queryUrl.searchParams.set(
    "where",
    `WeekOfPlantStart >= DATE '${cutoffDateString}'`
  );

  // Ask only for fields that the extension needs.
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

  // Lat and Lon are already fields, so ArcGIS geometry is unnecessary.
  queryUrl.searchParams.set("returnGeometry", "false");

  // Request newest planting weeks first.
  queryUrl.searchParams.set(
    "orderByFields",
    "WeekOfPlantStart DESC"
  );

  // Tell ArcGIS which page of records we want.
  queryUrl.searchParams.set(
    "resultOffset",
    String(resultOffset)
  );

  // Limit each response to our chosen page size.
  queryUrl.searchParams.set(
    "resultRecordCount",
    String(CDFW_PAGE_SIZE)
  );

  // Request JSON rather than the ArcGIS HTML query page.
  queryUrl.searchParams.set("f", "json");

  return queryUrl.toString();
}

// Download every page of raw CDFW features and combine them into one array.
export async function fetchCdfwFeatures() {
  // const prevents reassignment, but items can still be added to the array.
  const allFeatures = [];

  // The first page begins before any records have been skipped.
  let resultOffset = 0;

  // Start as true because we always need to request the first page.
  let hasMorePages = true;

  // Repeat this block until CDFW says there are no additional records.
  while (hasMorePages) {
    const queryUrl =
      createCdfwQueryUrl(resultOffset);

    // await pauses this function until the current request finishes.
    const response = await fetch(queryUrl);

    // fetch() does not automatically throw for HTTP errors.
    if (!response.ok) {
      throw new Error(
        `CDFW request failed with status ${response.status}`
      );
    }

    // Convert the JSON response text into a JavaScript object.
    const responseData = await response.json();

    // ArcGIS may include an error inside a successful HTTP response.
    if (responseData.error) {
      throw new Error(
        responseData.error.message ||
        "CDFW returned an error"
      );
    }

    // Verify that this page contains the expected feature array.
    if (!Array.isArray(responseData.features)) {
      throw new Error(
        "CDFW response did not contain a features array"
      );
    }

    const pageFeatures = responseData.features;

    // Add every feature from this page to the complete results array.
    for (const feature of pageFeatures) {
      allFeatures.push(feature);
    }

    console.log(
      `Downloaded ${pageFeatures.length} records ` +
      `starting at offset ${resultOffset}.`
    );

    // Prevent an endless loop if the server says another page exists
    // but does not provide any records.
    if (
      responseData.exceededTransferLimit === true &&
      pageFeatures.length === 0
    ) {
      throw new Error(
        "CDFW pagination stopped making progress"
      );
    }

    // ArcGIS sets this to true when another page is available.
    hasMorePages =
      responseData.exceededTransferLimit === true;

    // Move the next request past every record we just received.
    resultOffset += pageFeatures.length;
  }

  return allFeatures;
}
