// Tab switching, favorites, and live stocking data will be added next.
const sampleStocking = {
  waterId: 1,
  waterName: "Lone Pine Creek",
  fishType: "Trout",
  counties: "Inyo",
  plantingWeekStart: "2026-09-20",
  latitude: 36.59597397,
  longitude: -118.0977478,
  status: "future"
};

function createGoogleMapsUrl(Latitude, longitude) {
    const googleMpasUrl = new URL(
        "https://www.google.com/maps/search/"
    );

    googleMpasUrl.searchParams.set("api", "1");
    googleMpasUrl.searchParams.set(
        "query",
        `${latitude},${longitude}`
    );

    return googleMpasUrl.toString();
}

function formatPlantingWeek(dateString) {
    const [year, month, day] = dateString
        .split("-")
        .map(Number);

    const plantingDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function createStockingCard(stocking) {
  const card = document.createElement("article");
  card.classList.add("stocking-card");

  const cardHeading = document.createElement("div");
  cardHeading.classList.add("card-heading");

  const waterName = document.createElement("h2");
  waterName.textContent = stocking.waterName;

  const favoriteButton = document.createElement("button");
  favoriteButton.classList.add("favorite-button");
  favoriteButton.type = "button";
  favoriteButton.textContent = "☆";
  favoriteButton.setAttribute(
    "aria-label",
    `Add ${stocking.waterName} to favorites`
  );
  favoriteButton.setAttribute("aria-pressed", "false");

  cardHeading.append(waterName, favoriteButton);

  const stockingDetails = document.createElement("p");
  stockingDetails.classList.add("stocking-details");
  stockingDetails.textContent =
    `${stocking.fishType} · ${stocking.counties} County`;

  const stockingWeek = document.createElement("p");
  stockingWeek.classList.add("stocking-week");
  stockingWeek.textContent =
    `Week of ${formatPlantingWeek(stocking.plantingWeekStart)}`;

  const mapLink = document.createElement("a");
  mapLink.classList.add("map-link");
  mapLink.href = createGoogleMapsUrl(
    stocking.latitude,
    stocking.longitude
  );
  mapLink.target = "_blank";
  mapLink.rel = "noopener noreferrer";
  mapLink.textContent = "Open in Google Maps";

  card.append(
    cardHeading,
    stockingDetails,
    stockingWeek,
    mapLink
  );

  return card;
}

const stockingList = document.querySelector("#stocking-list");
const sampleCard = createStockingCard(sampleStocking);

stockingList.append(sampleCard);