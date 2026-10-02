// CDFW API configuration
// This is the public ArcGIS query endpoint for CDFW planting locations.

const CDFW_QUERY_URL =
  "https://services2.arcgis.com/" +
  "Uq9r85Potqm3MfRV/ArcGIS/rest/services/" +
  "biosds2897_fmu/FeatureServer/0/query";

// The MVP defines "recent" as the previous 60 days.
const RECENT_DAY_COUNT = 60;

// HTML element references
// These variables hold references to elements that already exist in index.html.

const stockingList = document.querySelector("#stocking-list");
const tabButtons = document.querySelectorAll(".tab-button");

// Popup state
// State is information that can change while the popup is running.

// Hold the normalized records downloaded from CDFW.
let stockingRecords = [];

// Hold the IDs of waters the user has favorited.
let favoriteWaterIds = [];

// Remember which tab is currently selected.
let activeTabName = "recent";

// CDFW query construction
// Convert a Date object into the YYYY-MM-DD format expected by ArcGIS.
function formatDateForArcGis(date) {
  const year = date.getFullYear();

  // padStart() turns a value such as "9" into "09".
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Build a CDFW URL that requests records from the previous 60 days forward.
function createCdfwQueryUrl() {
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

  // Lat and Lon are already fields, so separate ArcGIS geometry is unnecessary.
  queryUrl.searchParams.set("returnGeometry", "false");

  // Request newest planting weeks first.
  queryUrl.searchParams.set(
    "orderByFields",
    "WeekOfPlantStart DESC"
  );

  // Request JSON rather than the ArcGIS HTML query page.
  queryUrl.searchParams.set("f", "json");

  return queryUrl.toString();
}

// CDFW data fetching
// Download and return the raw feature array from CDFW.
async function fetchCdfwFeatures() {
  const queryUrl = createCdfwQueryUrl();

  // fetch() starts an HTTP request and returns a Promise.
  const response = await fetch(queryUrl);

  // HTTP errors such as 404 or 500 do not automatically throw an error.
  if (!response.ok) {
    throw new Error(
      `CDFW request failed with status ${response.status}`
    );
  }

  // Convert the response body from JSON text into a JavaScript object.
  const responseData = await response.json();

  // ArcGIS can report an error inside an otherwise successful HTTP response.
  if (responseData.error) {
    throw new Error(
      responseData.error.message || "CDFW returned an error"
    );
  }

  // Verify that the response contains the array we expect.
  if (!Array.isArray(responseData.features)) {
    throw new Error(
      "CDFW response did not contain a features array"
    );
  }

  return responseData.features;
}

// -----------------------------------------------------------------------------
// CDFW data normalization
// -----------------------------------------------------------------------------
//
// ArcGIS uses names such as WaterName and Lat.
// Normalization converts them into names controlled by our application.

// Convert CDFW's announcement period into one of our three status values.
function normalizeAnnouncementStatus(announcePeriod) {
  if (announcePeriod === "current") {
    return "current";
  }

  if (announcePeriod === "future") {
    return "future";
  }

  // The date query already limits past records to the previous 60 days.
  return "recent";
}

// Convert one raw ArcGIS feature into our application's stocking format.
function normalizeCdfwFeature(feature) {
  const attributes = feature.attributes;

  return {
    waterId: attributes.StockingWaterID,
    waterName: attributes.WaterName,
    fishType: attributes.FishType,
    counties: attributes.Counties,
    plantingWeekStart: attributes.WeekOfPlantStart,

    // Number() ensures coordinates are JavaScript numbers.
    latitude: Number(attributes.Lat),
    longitude: Number(attributes.Lon),

    status: normalizeAnnouncementStatus(
      attributes.AnnouncePeriod
    )
  };
}

// Check whether a normalized record contains every value needed by the UI.
function isUsableStocking(stocking) {
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

// Normalize all raw features and remove records the UI cannot safely display.
function normalizeCdfwFeatures(rawFeatures) {
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

// Favorite storage
// Read the saved array of favorite water IDs from Firefox storage.
async function loadFavoriteWaterIds() {
  const storedData =
    await browser.storage.local.get("favoriteWaterIds");

  // Validate the stored value before using it as an array.
  if (Array.isArray(storedData.favoriteWaterIds)) {
    return storedData.favoriteWaterIds;
  }

  // New users do not have saved favorites, so return an empty array.
  return [];
}

// Save the current favorite-water array into Firefox storage.
async function saveFavoriteWaterIds() {
  await browser.storage.local.set({
    favoriteWaterIds: favoriteWaterIds
  });
}

// Check whether one water ID is currently in the favorites array.
function isFavoriteWater(waterId) {
  return favoriteWaterIds.includes(waterId);
}

// Add or remove a water ID, save the result, and refresh the current tab.
async function toggleFavorite(waterId) {
  const isAlreadyFavorite = isFavoriteWater(waterId);

  if (isAlreadyFavorite) {
    // filter() creates a new array that excludes the selected water ID.
    favoriteWaterIds = favoriteWaterIds.filter(
      (favoriteWaterId) => {
        return favoriteWaterId !== waterId;
      }
    );
  } else {
    // push() adds the selected water ID to the end of the array.
    favoriteWaterIds.push(waterId);
  }

  // Wait until Firefox finishes saving before refreshing the interface.
  await saveFavoriteWaterIds();

  selectTab(activeTabName);
}

// Google Maps URL creation
// Create a Google Maps search URL using a stocking's coordinates.
function createGoogleMapsUrl(latitude, longitude) {
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

// Display formatting
// Convert a date such as "2026-09-20" into "September 20, 2026".
function formatPlantingWeek(dateString) {
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
function formatCounties(counties) {
  const hasMultipleCounties = counties.includes(",");

  const countyLabel = hasMultipleCounties
    ? "Counties"
    : "County";

  return `${counties} ${countyLabel}`;
}

// Stocking-card creation
// Build and return one stocking card from a stocking object.
function createStockingCard(stocking) {
  // Create the outer card.
  const card = document.createElement("article");
  card.classList.add("stocking-card");

  // Create the heading that contains the water name and favorite button.
  const cardHeading = document.createElement("div");
  cardHeading.classList.add("card-heading");

  const waterName = document.createElement("h2");
  waterName.textContent = stocking.waterName;

  // Determine how the favorite button should currently appear.
  const isFavorite = isFavoriteWater(stocking.waterId);

  const favoriteButton = document.createElement("button");
  favoriteButton.classList.add("favorite-button");
  favoriteButton.type = "button";
  favoriteButton.textContent = isFavorite ? "★" : "☆";

  favoriteButton.setAttribute(
    "aria-pressed",
    String(isFavorite)
  );

  favoriteButton.setAttribute(
    "aria-label",
    isFavorite
      ? `Remove ${stocking.waterName} from favorites`
      : `Add ${stocking.waterName} to favorites`
  );

  // Save the updated favorite when the user selects the star.
  favoriteButton.addEventListener("click", async () => {
    try {
      await toggleFavorite(stocking.waterId);
    } catch (error) {
      console.error("Could not update favorites:", error);
    }
  });

  cardHeading.append(waterName, favoriteButton);

  // Create the species and county description.
  const stockingDetails = document.createElement("p");
  stockingDetails.classList.add("stocking-details");
  stockingDetails.textContent =
    `${stocking.fishType} · ${formatCounties(stocking.counties)}`;

  // Create the planting-week description.
  const stockingWeek = document.createElement("p");
  stockingWeek.classList.add("stocking-week");
  stockingWeek.textContent =
    `Week of ${formatPlantingWeek(stocking.plantingWeekStart)}`;

  // Create the external Google Maps link.
  const mapLink = document.createElement("a");
  mapLink.classList.add("map-link");

  mapLink.href = createGoogleMapsUrl(
    stocking.latitude,
    stocking.longitude
  );

  mapLink.target = "_blank";
  mapLink.rel = "noopener noreferrer";
  mapLink.textContent = "Open in Google Maps";

  // Put all completed sections inside the card.
  card.append(
    cardHeading,
    stockingDetails,
    stockingWeek,
    mapLink
  );

  return card;
}

// Record filtering
// Return only the records that belong in the selected tab.
function getStockingsForTab(tabName) {
  if (tabName === "recent") {
    return stockingRecords.filter((stocking) => {
      return stocking.status === "recent";
    });
  }

  if (tabName === "upcoming") {
    const upcomingStatuses = ["current", "future"];

    return stockingRecords.filter((stocking) => {
      return upcomingStatuses.includes(stocking.status);
    });
  }

  if (tabName === "favorites") {
    return stockingRecords.filter((stocking) => {
      return isFavoriteWater(stocking.waterId);
    });
  }

  // Unknown tab names receive an empty array.
  return [];
}

// List rendering
// Clear the current list and render the supplied stocking records.

// Display a single loading, error, or empty-state message.
function renderStatusMessage(message) {
  stockingList.replaceChildren();

  const statusMessage = document.createElement("p");
  statusMessage.classList.add("empty-message");
  statusMessage.textContent = message;

  stockingList.append(statusMessage);
}

function renderStockings(stockings) {
  stockingList.replaceChildren();

  // Display an empty-state message when no records match.
  if (stockings.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.classList.add("empty-message");
    emptyMessage.textContent =
      "No stocking records were found for this category.";

    stockingList.append(emptyMessage);
    return;
  }

  // Create and append one card for each matching stocking.
  for (const stocking of stockings) {
    const card = createStockingCard(stocking);
    stockingList.append(card);
  }
}

// Tab selection
// Mark one tab as active and display its matching records.
function selectTab(tabName) {
  // Remember the selected tab so favorite updates can return to it.
  activeTabName = tabName;

  // Update each tab's visual and accessibility state.
  for (const tabButton of tabButtons) {
    const isSelected =
      tabButton.dataset.tab === tabName;

    tabButton.classList.toggle("active", isSelected);

    tabButton.setAttribute(
      "aria-selected",
      String(isSelected)
    );
  }

  // Find and render the records belonging to the selected tab.
  const matchingStockings =
    getStockingsForTab(tabName);

  renderStockings(matchingStockings);
}

// Tab event listeners
// Run selectTab() whenever one of the category buttons is clicked.
for (const tabButton of tabButtons) {
  tabButton.addEventListener("click", () => {
    const selectedTabName = tabButton.dataset.tab;
    selectTab(selectedTabName);
  });
}

// Load favorites and live CDFW records before displaying the first tab.
async function initializePopup() {
  renderStatusMessage("Loading CDFW stocking data...");

  // Load favorites separately so data fetching can continue if storage fails.
  try {
    favoriteWaterIds = await loadFavoriteWaterIds();
  } catch (error) {
    console.error("Could not load favorites:", error);
    favoriteWaterIds = [];
  }

  // Download, normalize, and display live stocking records.
  try {
    const rawFeatures = await fetchCdfwFeatures();

    stockingRecords =
      normalizeCdfwFeatures(rawFeatures);

    console.log(
      `Displaying ${stockingRecords.length} CDFW records.`
    );

    selectTab("recent");
  } catch (error) {
    console.error("Could not load CDFW data:", error);

    renderStatusMessage(
      "Could not load stocking data. Please try again."
    );
  }
}

// Start the popup after all functions and event listeners have been defined.
initializePopup();