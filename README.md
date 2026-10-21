# California Fish Stocking

A Firefox extension for browsing recent and upcoming fish stocking information
published by the California Department of Fish and Wildlife (CDFW).

The extension opens as a toolbar popup. It shows stocking information in a
searchable list and provides a Google Maps link for each water body's published
coordinates.

## Features

- Shows recently stocked waters from the previous 60 days.
- Shows current and future stocking announcements when CDFW publishes them.
- Separates records into Recent, Upcoming, and Favorites tabs.
- Searches by water name, fish species, or county.
- Saves favorite waters between popup sessions.
- Opens a selected water's coordinates in Google Maps.
- Displays different color badges for recent, current, and future records.
- Downloads every available page of matching CDFW records.
- Caches successful downloads for six hours.
- Falls back to an older cache when automatic loading encounters a temporary
  network problem.
- Lets the user manually request fresh data.

## Important date information

CDFW publishes a **planting week**, not an exact stocking day. The extension
preserves that wording and displays dates as “Week of ...”.

Upcoming stocking plans can change because of weather, water conditions, road
conditions, or operational needs. The Upcoming tab only displays announcements
that are present in the CDFW data; the extension does not predict future
stockings.

## Data source

The extension queries the public CDFW ArcGIS feature layer:

<https://services2.arcgis.com/Uq9r85Potqm3MfRV/ArcGIS/rest/services/biosds2897_fmu/FeatureServer/0>

The public CDFW fish planting schedule is also available at:

<https://www.nrm.dfg.ca.gov/FishPlants/PublicPlantSearch>

The extension currently uses these source fields:

| CDFW field | Use in the extension |
| --- | --- |
| `StockingWaterID` | Identifies a water when saving favorites |
| `WaterName` | Displays the body of water's name |
| `WeekOfPlantStart` | Displays the published planting week |
| `FishType` | Displays and searches the fish species or category |
| `Counties` | Displays and searches the county or counties |
| `Lat` | Supplies the latitude for the Google Maps link |
| `Lon` | Supplies the longitude for the Google Maps link |
| `AnnouncePeriod` | Classifies a record as recent, current, or future |

## How the data flows

```text
User opens the Firefox popup
              |
              v
Read the saved favorites and stocking cache
              |
              v
Use a fresh cache, or request paginated records from CDFW
              |
              v
Normalize and validate the CDFW records
              |
              v
Filter by the selected tab and search text
              |
              v
Render stocking cards with Google Maps links
```

The extension does not require a custom backend, user account, or Google Maps
API key.

## Project structure

```text
fishingExtension/
|-- manifest.json
|-- package.json
|-- src/
|   |-- background.js
|   `-- popup/
|       |-- index.html
|       |-- popup.css
|       |-- popup.js
|       |-- cdfw-api.js
|       |-- stocking-utils.js
|       `-- storage.js
`-- test/
    |-- cdfw-api.test.js
    |-- stocking-utils.test.js
    `-- storage.test.js
```

The main responsibilities are separated as follows:

- `popup.js` coordinates state, events, and rendering.
- `cdfw-api.js` builds ArcGIS URLs and downloads paginated data.
- `stocking-utils.js` normalizes, validates, searches, and formats records.
- `storage.js` reads and writes the cache and favorites through Firefox storage.
- `background.js` is currently a placeholder and is not registered in the
  manifest.

## Run the extension locally

1. Clone or download this repository.
2. Open Firefox and enter `about:debugging` in the address bar.
3. Select **This Firefox**.
4. Select **Load Temporary Add-on**.
5. Choose this project's `manifest.json` file.
6. Select the extension's toolbar button to open the popup.

A temporary extension remains installed only for the current Firefox session.
After restarting Firefox, load `manifest.json` again.

## Run the tests

The tests use Node's built-in test runner, so no testing framework is required.

```powershell
npm test
```

The current tests cover:

- ArcGIS query parameters and pagination;
- announcement-status normalization;
- case-insensitive stocking search;
- cache expiration rules;
- loading a valid cache through a mocked Firefox storage API.

## Extension permissions

The manifest requests only the permissions needed by the current features:

- `storage` saves the cache and favorite water IDs in Firefox.
- `https://services2.arcgis.com/*` allows requests to the CDFW ArcGIS service.

The extension does not require a user account and does not request the user's
current location.

## Current limitations

- Stocking data and coordinates are limited to what CDFW publishes.
- The Upcoming tab can be empty when CDFW has no current or future
  announcements in the queried data.
- Favorites are stored only in the current Firefox extension installation.
- The extension is currently designed and tested for Firefox.

## Planned finishing work

- Add extension icons and screenshots.
- Complete a manual Firefox test checklist.
- Add more validation and error-path unit tests.
- Package the extension for a portfolio release or Firefox Add-ons submission.
