// Latitude comes first and longitude comes second in Leaflet.
const californiaCenter = [37.2, -119.7];
const initialZoomLevel = 6;

// Create the interactive map inside the HTML element with id="map".
const map = L.map("map").setView(californiaCenter, initialZoomLevel);

// A tile layer provides the actual map images.
// Leaflet handles the interaction, while OpenStreetMap provides the map tiles.
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);