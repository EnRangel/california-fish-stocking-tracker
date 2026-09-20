# California Fish Stocking Map

A Firefox extension that displays recent and upcoming California fish stocking
locations on an interactive map.

## Problem

California Department of Fish and Wildlife (CDFW) stocking information is
available online, but anglers must search through a schedule and open locations
individually. This extension will make that information easier to explore
geographically.

## User story

As a California angler, I want to open a map of recent and upcoming fish
stockings so that I can quickly identify stocked waters and inspect their
stocking information.

## MVP

The first version will:

- Open an extension-owned map from the Firefox toolbar.
- Use Leaflet with OpenStreetMap tiles.
- Retrieve stocking records from the official CDFW data source.
- Display records from the previous 60 days.
- Display future records made available by CDFW.
- Place a fish marker at each water body's published coordinates.
- Show the water name, planting week, species, county, and stocking status when
  a marker is selected.
- Link users to the official CDFW information.
- Include a legend explaining marker colors.
- Cache fetched data to avoid unnecessary network requests.

## Stocking statuses

CDFW publishes a planting week rather than an exact planting day. The extension
must preserve that distinction and must not imply that an exact date is known.

- **Blue fish:** stocked within the previous 60 days
- **Green fish:** scheduled for the current planting week
- **Orange fish:** scheduled for a future planting week

Scheduled plants may change because of weather, water, road, or operational
conditions.

## Data source

CDFW publishes an ArcGIS feature layer containing fish planting locations and
stocking information:

<https://services2.arcgis.com/Uq9r85Potqm3MfRV/ArcGIS/rest/services/biosds2897_fmu/FeatureServer/0>

Fields expected by the MVP:

| Source field | Meaning |
| --- | --- |
| `WaterName` | Name of the body of water |
| `WeekOfPlantStart` | Beginning of the published planting week |
| `FishType` | Stocked species or fish category |
| `Counties` | California county or counties |
| `Lat` | Published latitude |
| `Lon` | Published longitude |
| `AnnouncePeriod` | CDFW status category |

The public planting schedule is available at
<https://www.nrm.dfg.ca.gov/FishPlants/PublicPlantSearch>.

## Initial architecture

```text
CDFW ArcGIS feature layer
          |
          v
Firefox extension background script
  - fetch
  - validate and normalize
  - classify by date
  - cache
          |
          v
Extension map page
  - Leaflet/OpenStreetMap
  - fish markers
  - detail popups and legend
```

The first version will not require a custom backend or a Google Maps API key.

## Non-goals for the MVP

- Injecting markers directly into Google Maps or another mapping website
- Supporting states other than California
- Predicting unannounced stocking dates
- Showing an exact planting point within a body of water
- User accounts, saved locations, or notifications
- Mobile support

## Milestones

1. Query the CDFW feature layer and inspect a small sample response.
2. Define and test the normalized stocking-record format and date rules.
3. Create the minimal Firefox extension shell.
4. Render a basic California map in an extension page.
5. Add stocking markers, colors, popups, and a legend.
6. Add caching, error handling, loading states, and tests.
7. Package and document the extension for local Firefox installation.

## Possible later features

- Overlay markers on Google Maps or other map websites
- Filter by species, county, date, or distance
- Find stockings near the user's location
- Save favorite waters
- Notify users when a favorite water appears in the schedule
- Support Chromium-based browsers
