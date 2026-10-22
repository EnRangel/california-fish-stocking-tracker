// -----------------------------------------------------------------------------
// Module imports
// -----------------------------------------------------------------------------
//
// import lists the functions this file receives from other modules.
// Each relative path begins with "./" because the files share this folder.

import {
  fetchCdfwFeatures,
  fetchCdfwWaterLocations
} from "./cdfw-api.js";

import {
  fetchCdfwScheduleRecords
} from "./cdfw-schedule.js";

import {
  isStockingCacheFresh,
  loadFavoriteWaterIds,
  loadStockingCache,
  saveFavoriteWaterIds,
  saveStockingCache
} from "./storage.js";

import {
  combineCdfwStockingRecords,
  createGoogleMapsUrl,
  doesStockingMatchSearch,
  formatCounties,
  formatLastUpdatedTime,
  formatPlantingWeek,
  getStatusLabel,
  normalizeCdfwFeatures,
  normalizeCdfwScheduleRecords
} from "./stocking-utils.js";

// -----------------------------------------------------------------------------
// HTML element references
// -----------------------------------------------------------------------------
//
// These variables hold references to elements that exist in index.html.

const stockingList = document.querySelector("#stocking-list");
const tabButtons = document.querySelectorAll(".tab-button");
const searchInput = document.querySelector("#stocking-search");

// This span displays when the current stocking data was downloaded.
const lastUpdatedValue =
  document.querySelector("#last-updated-value");

// This button lets the user bypass the cache and request fresh data.
const refreshButton =
  document.querySelector("#refresh-button");

// -----------------------------------------------------------------------------
// Popup state
// -----------------------------------------------------------------------------
//
// State is information that can change while the popup is running.

// Hold the normalized records downloaded from CDFW.
let stockingRecords = [];

// Hold the IDs of waters the user has favorited.
let favoriteWaterIds = [];

// Remember which tab is currently selected.
let activeTabName = "recent";

// Store what the user has typed so it can be used across every tab.
let searchText = "";

// Store the time associated with the currently displayed records.
let lastUpdatedTime = null;

// -----------------------------------------------------------------------------
// Stocking-data loading
// -----------------------------------------------------------------------------

// Load cached records or download new records from CDFW.
// forceRefresh can bypass a valid cache when the user requests fresh data.
async function loadStockingRecords(forceRefresh = false) {
  const cache = await loadStockingCache();

  // Use a fresh cache unless the user specifically requested new data.
  if (
    !forceRefresh &&
    cache &&
    isStockingCacheFresh(cache)
  ) {
    console.log("Using fresh cached CDFW records.");

    // Remember when these cached records were originally downloaded.
    lastUpdatedTime = cache.fetchedAt;

    return cache.records;
  }

  try {
    // ArcGIS supplies recent history and the coordinate lookup data.
    const rawFeatures = await fetchCdfwFeatures();

    const recentRecords =
      normalizeCdfwFeatures(rawFeatures);

    // The public schedule contains newer current and future announcements.
    const liveScheduleRecords =
      await fetchCdfwScheduleRecords();

    // Collect the water IDs whose coordinates must be found in ArcGIS.
    const scheduledWaterIds = [];

    for (const scheduleRecord of liveScheduleRecords) {
      scheduledWaterIds.push(scheduleRecord.waterId);
    }

    const locationFeatures =
      await fetchCdfwWaterLocations(scheduledWaterIds);

    const upcomingRecords =
      normalizeCdfwScheduleRecords(
        liveScheduleRecords,
        locationFeatures
      );

    // Prefer the live schedule if both sources describe the same event.
    const normalizedRecords =
      combineCdfwStockingRecords(
        recentRecords,
        upcomingRecords
      );

    // Save the successful response for later popup openings.
    const savedCache =
      await saveStockingCache(normalizedRecords);

    // Remember the timestamp created for the new cache.
    lastUpdatedTime = savedCache.fetchedAt;

    console.log(
      `Combined ${recentRecords.length} recent records ` +
      `with ${upcomingRecords.length} live schedule records.`
    );

    return normalizedRecords;
  } catch (error) {
    // Automatic loading can fall back to old data during a network failure.
    // A manual refresh should report its failure instead of hiding it.
    if (cache && !forceRefresh) {
      console.warn(
        "CDFW request failed. Using expired cached records.",
        error
      );

      // Keep the original timestamp because this is older cached data.
      lastUpdatedTime = cache.fetchedAt;

      return cache.records;
    }

    // No usable fallback exists, so pass the error to the caller.
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Favorite behavior
// -----------------------------------------------------------------------------

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
  await saveFavoriteWaterIds(favoriteWaterIds);

  selectTab(activeTabName);
}

// -----------------------------------------------------------------------------
// Display updates
// -----------------------------------------------------------------------------

// Update the timestamp text shown near the refresh button.
function updateLastUpdatedDisplay() {
  if (!Number.isFinite(lastUpdatedTime)) {
    lastUpdatedValue.textContent = "Unavailable";
    return;
  }

  lastUpdatedValue.textContent =
    formatLastUpdatedTime(lastUpdatedTime);
}

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

  // Create a badge that identifies when this stocking occurs.
  const statusBadge = document.createElement("span");

  statusBadge.classList.add(
    "stocking-status",
    `stocking-status--${stocking.status}`
  );

  statusBadge.textContent =
    getStatusLabel(stocking.status);

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
    statusBadge,
    stockingDetails,
    stockingWeek,
    mapLink
  );

  return card;
}

// Return only the records that belong in the selected tab and match the search.
function getStockingsForTab(tabName) {
  let tabStockings = [];

  if (tabName === "recent") {
    tabStockings = stockingRecords.filter((stocking) => {
      return stocking.status === "recent";
    });
  }

  if (tabName === "upcoming") {
    const upcomingStatuses = ["current", "future"];

    tabStockings = stockingRecords.filter((stocking) => {
      return upcomingStatuses.includes(stocking.status);
    });
  }

  if (tabName === "favorites") {
    tabStockings = stockingRecords.filter((stocking) => {
      return isFavoriteWater(stocking.waterId);
    });
  }

  // Apply the text search after narrowing the records to one tab.
  return tabStockings.filter((stocking) => {
    return doesStockingMatchSearch(stocking, searchText);
  });
}

// Display a single loading, error, or empty-state message.
function renderStatusMessage(message) {
  stockingList.replaceChildren();

  const statusMessage = document.createElement("p");
  statusMessage.classList.add("empty-message");
  statusMessage.textContent = message;

  stockingList.append(statusMessage);
}

// Clear the current list and render the supplied stocking records.
function renderStockings(stockings) {
  stockingList.replaceChildren();

  // Display an empty-state message when no records match.
  if (stockings.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.classList.add("empty-message");

    // Give a more useful message when a search caused the empty result.
    if (searchText.trim() !== "") {
      emptyMessage.textContent =
        `No stockings matched "${searchText.trim()}".`;
    } else {
      emptyMessage.textContent =
        "No stocking records were found for this category.";
    }

    stockingList.append(emptyMessage);
    return;
  }

  // Create and append one card for each matching stocking.
  for (const stocking of stockings) {
    const card = createStockingCard(stocking);
    stockingList.append(card);
  }
}

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

// -----------------------------------------------------------------------------
// Event listeners
// -----------------------------------------------------------------------------

// Run selectTab() whenever one of the category buttons is clicked.
for (const tabButton of tabButtons) {
  tabButton.addEventListener("click", () => {
    const selectedTabName = tabButton.dataset.tab;
    selectTab(selectedTabName);
  });
}

// Re-render the active tab whenever the user changes the search text.
searchInput.addEventListener("input", () => {
  searchText = searchInput.value;
  selectTab(activeTabName);
});

// Download fresh data, update the interface, and preserve the active tab.
async function refreshStockingData() {
  // Prevent repeated clicks while the network request is running.
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing...";
  lastUpdatedValue.textContent = "Updating...";

  try {
    // true tells loadStockingRecords() to ignore a fresh cache.
    stockingRecords =
      await loadStockingRecords(true);

    updateLastUpdatedDisplay();
    selectTab(activeTabName);
  } catch (error) {
    console.error(
      "Could not refresh CDFW data:",
      error
    );

    lastUpdatedValue.textContent = "Refresh failed";
  } finally {
    // finally runs whether the request succeeds or fails.
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh data";
  }
}

// Passing the function without parentheses lets Firefox call it later.
refreshButton.addEventListener(
  "click",
  refreshStockingData
);

// -----------------------------------------------------------------------------
// Application startup
// -----------------------------------------------------------------------------

// Load favorites and stocking records before displaying the first tab.
async function initializePopup() {
  // Prevent refresh while the first data load is still running.
  refreshButton.disabled = true;

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
    stockingRecords = await loadStockingRecords();

    // The loading function also sets lastUpdatedTime.
    updateLastUpdatedDisplay();

    console.log(
      `Displaying ${stockingRecords.length} CDFW records.`
    );

    selectTab("recent");
  } catch (error) {
    console.error("Could not load CDFW data:", error);

    // Replace "Loading..." when no data or timestamp could be loaded.
    updateLastUpdatedDisplay();

    renderStatusMessage(
      "Could not load stocking data. Please try again."
    );
  }

  // Initial loading is finished, so refreshing is now safe.
  refreshButton.disabled = false;
}

// Start the popup after all functions and event listeners have been defined.
initializePopup();
