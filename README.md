# California Fish Stocking Tracker

A Firefox extension for browsing recent and upcoming fish stocking information
published by the California Department of Fish and Wildlife (CDFW).

The extension opens as a toolbar popup. It shows stocking information in a
searchable list and provides a Google Maps link for each water body's published
coordinates.

This is an independent project and is not affiliated with or endorsed by the
California Department of Fish and Wildlife or the State of California.

## Features

- Shows recently stocked waters from the previous 60 days.
- Shows current and future stocking announcements when CDFW publishes them.
- Separates records into Recent, Upcoming, and Favorites tabs.
- Searches by water name, fish species, or county.
- Saves favorite waters between popup sessions.
- Opens a selected water's coordinates in Google Maps.
- Displays different color badges for recent, current, and future records.
- Combines recent ArcGIS records with CDFW's live current/future schedule.
- Looks up coordinates for live schedule rows by their CDFW water IDs.
- Downloads every available page of matching ArcGIS records.
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

## Data sources

The extension combines two official CDFW sources because they serve different
purposes.

The public ArcGIS feature layer supplies recent stocking history and water
coordinates:

<https://services2.arcgis.com/Uq9r85Potqm3MfRV/ArcGIS/rest/services/biosds2897_fmu/FeatureServer/0>

The live fish planting schedule supplies the current week and future week:

<https://www.nrm.dfg.ca.gov/FishPlants/PublicPlantSearch>

The official catalog identifies **Planting Location - CDFW [ds2897]** as a
public CC BY dataset. Attribution and transformation details are recorded in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The two sources are joined through the numeric `StockingWaterID` embedded in
the schedule's water-body links.

The ArcGIS source provides these fields:

| CDFW field | Use in the extension |
| --- | --- |
| `StockingWaterID` | Identifies a water when saving favorites |
| `WaterName` | Displays the body of water's name |
| `WeekOfPlantStart` | Displays the published planting week |
| `FishType` | Displays and searches the fish species or category |
| `Counties` | Displays and searches the county or counties |
| `Lat` | Supplies the latitude for the Google Maps link |
| `Lon` | Supplies the longitude for the Google Maps link |
| `AnnouncePeriod` | Describes historical ArcGIS announcement periods |

The live schedule provides the planting-week range, water ID, water name,
county, and fish species. The extension compares the planting week's start date
with the current date to label the row as current or future.

## How the data flows

```text
User opens the Firefox popup
              |
              v
Read the saved favorites and stocking cache
              |
              v
Use a fresh version-2 cache, or request both CDFW sources
              |
              v
Parse the live schedule and normalize recent ArcGIS records
              |
              v
Look up live-schedule coordinates by StockingWaterID
              |
              v
Combine, validate, and remove duplicate events
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
california-fish-stocking-tracker/
|-- manifest.json
|-- package.json
|-- src/
|   |-- icons/
|   |   `-- ripple-beacon.svg
|   `-- popup/
|       |-- index.html
|       |-- popup.css
|       |-- popup.js
|       |-- cdfw-api.js
|       |-- cdfw-schedule.js
|       |-- network-utils.js
|       |-- privacy.html
|       |-- privacy.css
|       |-- stocking-utils.js
|       `-- storage.js
`-- test/
    |-- cdfw-api.test.js
    |-- cdfw-schedule.test.js
    |-- network-utils.test.js
    |-- stocking-utils.test.js
    `-- storage.test.js
```

The main responsibilities are separated as follows:

- `popup.js` coordinates state, events, and rendering.
- `cdfw-api.js` downloads recent ArcGIS records and water coordinates.
- `cdfw-schedule.js` downloads and parses the live current/future schedule.
- `network-utils.js` applies shared privacy, timeout, and response-size rules to
  network requests.
- `privacy.html` and `privacy.css` provide the privacy policy available from the
  popup.
- `stocking-utils.js` normalizes, joins, validates, searches, and formats
  records.
- `storage.js` reads and writes the cache and favorites through Firefox storage.
- `ripple-beacon.svg` supplies the scalable extension and toolbar icon.

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

Install the development tools after cloning the repository:

```powershell
npm install
```

The unit tests use Node's built-in test runner:

```powershell
npm test
```

The current tests cover:

- ArcGIS query parameters and pagination;
- live schedule URL creation, HTML parsing, and error handling;
- coordinate joining and duplicate-event removal;
- announcement-status normalization;
- case-insensitive stocking search;
- network request privacy settings, timeouts, and response-size limits;
- cache expiration rules;
- loading a valid cache through a mocked Firefox storage API.

## Check and package the extension

Mozilla's `web-ext` tool is installed as a development dependency. It is used
only while developing and packaging the project; it is not included in the
extension installed by Firefox users.

Check the manifest and extension source for Mozilla-specific problems:

```powershell
npm run lint:extension
```

Create the uploadable ZIP archive:

```powershell
npm run build:extension
```

The build command places the ZIP inside `web-ext-artifacts/`. That generated
folder is ignored by Git. The package excludes tests, personal documentation,
Node development files, and repository files. It includes `manifest.json`, the
runtime files under `src/`, and the public license, privacy, and attribution
notices.

## Extension permissions

The manifest requests only the permissions needed by the current features:

- `storage` saves the cache and favorite water IDs in Firefox.
- `https://services2.arcgis.com/*` allows requests to the CDFW ArcGIS service.
- `https://www.nrm.dfg.ca.gov/*` allows requests to the live CDFW schedule.

The extension does not require a user account and does not request the user's
current location.

Network requests use HTTPS, omit browser credentials, and do not include the
user's search text or favorites. Requests time out after 15 seconds. ArcGIS
pagination, record counts, schedule response size, and stored data are also
bounded so a malformed response cannot make the popup download indefinitely.

## Privacy

The extension does not create or read cookies and contains no advertising,
analytics, tracking pixels, or user accounts. Favorite water IDs and cached
public stocking records stay in Firefox's local extension storage.

The complete policy is available in [PRIVACY.md](PRIVACY.md) and from the
Privacy link in the popup.

Opening the popup contacts CDFW and ArcGIS to retrieve public data. Google Maps
is contacted only after the user selects a map link. The extension developer
does not receive the user's network requests, searches, or favorites.

## Firefox release metadata

The extension currently uses version `0.1.0`. The same version appears in both
`manifest.json` and `package.json` so development metadata agrees with the
version Firefox displays.

The manifest defines `california-fish-stocking@enrangel` as the permanent
Firefox extension ID. This is an internal identifier, not an email address.

The Firefox-specific data-collection declaration uses `none` because the
extension does not collect or transmit personal user data for storage or
processing. Network requests only retrieve public stocking information, and
favorites remain in Firefox's local extension storage.

## Current limitations

- Stocking data and coordinates are limited to what CDFW publishes.
- The Upcoming tab can be empty when CDFW publishes no current or future rows.
- The live schedule is an HTML page rather than a documented JSON API. Tests
  detect important table-structure changes, but a major CDFW redesign could
  require a parser update.
- Favorites are stored only in the current Firefox extension installation.
- The extension is currently designed and tested for Firefox.

## Release status

Version `0.1.0` was submitted to Mozilla Add-ons on October 26, 2026 and is
awaiting review. The public installation link will be added here after Mozilla
publishes the listing.

The source code remains available for local installation and testing by using
the steps in [Run the extension locally](#run-the-extension-locally).
