// -----------------------------------------------------------------------------
// Sample data
// -----------------------------------------------------------------------------
//
// These are real sample records retrieved from CDFW.
// Later, the extension will fetch records instead of defining them here.

const sampleStockings = [
  {
    waterId: 501414,
    waterName: "Taboose Creek",
    fishType: "Trout",
    counties: "Inyo",
    plantingWeekStart: "2026-09-13",
    latitude: 36.99842834,
    longitude: -118.25787354,
    status: "recent",
    isFavorite: false
  },
  {
    waterId: 500860,
    waterName: "Lone Pine Creek",
    fishType: "Trout",
    counties: "Inyo",
    plantingWeekStart: "2026-09-20",
    latitude: 36.59597397,
    longitude: -118.0977478,
    status: "current",
    isFavorite: true
  }
];

// -----------------------------------------------------------------------------
// References to existing HTML elements
// -----------------------------------------------------------------------------
//
// These variables let JavaScript work with elements already present in the page.

const stockingList = document.querySelector("#stocking-list");
const tabButtons = document.querySelectorAll(".tab-button");

// -----------------------------------------------------------------------------
// Google Maps URL creation
// -----------------------------------------------------------------------------

// Create a Google Maps search URL for one latitude and longitude.
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

// -----------------------------------------------------------------------------
// Display formatting
// -----------------------------------------------------------------------------

// Convert a date such as "2026-09-20" into "September 20, 2026".
function formatPlantingWeek(dateString) {
  const dateParts = dateString
    .split("-")
    .map(Number);

  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];

  // JavaScript counts months from zero, so we subtract one from the month.
  const plantingDate = new Date(year, month - 1, day);

  return plantingDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

// Add the correct label after one or more county names.
function formatCounties(counties) {
  const hasMultipleCounties = counties.includes(",");
  const countyLabel = hasMultipleCounties
    ? "Counties"
    : "County";

  return `${counties} ${countyLabel}`;
}

// -----------------------------------------------------------------------------
// Stocking-card creation
// -----------------------------------------------------------------------------

// Build and return one stocking card from a stocking object.
function createStockingCard(stocking) {
  // Create the outer card.
  const card = document.createElement("article");
  card.classList.add("stocking-card");

  // Create the card heading.
  const cardHeading = document.createElement("div");
  cardHeading.classList.add("card-heading");

  const waterName = document.createElement("h2");
  waterName.textContent = stocking.waterName;

  // Create the favorite star.
  const favoriteButton = document.createElement("button");
  favoriteButton.classList.add("favorite-button");
  favoriteButton.type = "button";

  const favoriteAction = stocking.isFavorite
    ? "Remove"
    : "Add";

  favoriteButton.textContent = stocking.isFavorite
    ? "★"
    : "☆";

  favoriteButton.setAttribute(
    "aria-label",
    `${favoriteAction} ${stocking.waterName} ${
      stocking.isFavorite ? "from" : "to"
    } favorites`
  );

  favoriteButton.setAttribute(
    "aria-pressed",
    String(stocking.isFavorite)
  );

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

  // Create the link to the water's coordinates in Google Maps.
  const mapLink = document.createElement("a");
  mapLink.classList.add("map-link");
  mapLink.href = createGoogleMapsUrl(
    stocking.latitude,
    stocking.longitude
  );
  mapLink.target = "_blank";
  mapLink.rel = "noopener noreferrer";
  mapLink.textContent = "Open in Google Maps";

  // Put all of the completed sections inside the card.
  card.append(
    cardHeading,
    stockingDetails,
    stockingWeek,
    mapLink
  );

  return card;
}

// -----------------------------------------------------------------------------
// Record filtering
// -----------------------------------------------------------------------------

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
      return stocking.isFavorite;
    });
  }

  // Return an empty array if an unknown tab name is provided.
  return [];
}

// -----------------------------------------------------------------------------
// List rendering
// -----------------------------------------------------------------------------

// Clear the current list and render the provided stocking records.
function renderStockings(stockings) {
  stockingList.replaceChildren();

  // Display a message when the selected category has no records.
  if (stockings.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.classList.add("empty-message");
    emptyMessage.textContent =
      "No stocking records were found for this category.";

    stockingList.append(emptyMessage);
    return;
  }

  // Create and append one card for every stocking record.
  for (const stocking of stockings) {
    const card = createStockingCard(stocking);
    stockingList.append(card);
  }
}

// -----------------------------------------------------------------------------
// Tab selection
// -----------------------------------------------------------------------------

// Mark one tab as active and display its matching stocking records.
function selectTab(tabName) {
  // Update the visual and accessibility state of every tab button.
  for (const tabButton of tabButtons) {
    const isSelected =
      tabButton.dataset.tab === tabName;

    tabButton.classList.toggle("active", isSelected);

    tabButton.setAttribute(
      "aria-selected",
      String(isSelected)
    );
  }

  // Filter and display the records for the selected tab.
  const matchingStockings =
    getStockingsForTab(tabName);

  renderStockings(matchingStockings);
}

// -----------------------------------------------------------------------------
// Event listeners
// -----------------------------------------------------------------------------

// Listen for a click on each of the three tab buttons.
for (const tabButton of tabButtons) {
  tabButton.addEventListener("click", () => {
    const selectedTabName = tabButton.dataset.tab;
    selectTab(selectedTabName);
  });
}

// -----------------------------------------------------------------------------
// Initial display
// -----------------------------------------------------------------------------

// Show recent stockings when the popup first opens.
selectTab("recent");