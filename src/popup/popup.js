// Sample stocking data
// These records let us develop the interface before connecting the live API.
// Their status values are fixed sample values, not today's live CDFW status.

const sampleStockings = [
  {
    waterId: 501414,
    waterName: "Taboose Creek",
    fishType: "Trout",
    counties: "Inyo",
    plantingWeekStart: "2026-09-13",
    latitude: 36.99842834,
    longitude: -118.25787354,
    status: "recent"
  },
  {
    waterId: 500860,
    waterName: "Lone Pine Creek",
    fishType: "Trout",
    counties: "Inyo",
    plantingWeekStart: "2026-09-20",
    latitude: 36.59597397,
    longitude: -118.0977478,
    status: "current"
  }
];

// HTML element references
// These variables hold references to elements that already exist in index.html.

const stockingList = document.querySelector("#stocking-list");
const tabButtons = document.querySelectorAll(".tab-button");

// Popup state
// State is information that can change while the popup is running.

let favoriteWaterIds = [];
let activeTabName = "recent";

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
    return sampleStockings.filter((stocking) => {
      return stocking.status === "recent";
    });
  }

  if (tabName === "upcoming") {
    const upcomingStatuses = ["current", "future"];

    return sampleStockings.filter((stocking) => {
      return upcomingStatuses.includes(stocking.status);
    });
  }

  if (tabName === "favorites") {
    return sampleStockings.filter((stocking) => {
      return isFavoriteWater(stocking.waterId);
    });
  }

  // Unknown tab names receive an empty array.
  return [];
}

// List rendering
// Clear the current list and render the supplied stocking records.
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

// Popup initialization
// Load saved state before rendering the popup for the first time.
async function initializePopup() {
  try {
    favoriteWaterIds = await loadFavoriteWaterIds();
  } catch (error) {
    // Keep the popup usable even if reading storage fails.
    console.error("Could not load favorites:", error);
    favoriteWaterIds = [];
  }

  selectTab("recent");
}

// Start the popup after all functions and event listeners have been defined.
initializePopup();