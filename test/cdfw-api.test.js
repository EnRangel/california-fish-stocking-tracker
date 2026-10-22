// node:test provides Node's built-in test() function.
import test from "node:test";

// Strict assertions compare values without automatic type conversion.
import assert from "node:assert/strict";

import {
  createCdfwQueryUrl,
  createWaterLocationsQueryUrl,
  fetchCdfwFeatures
} from "../src/popup/cdfw-api.js";

// Verify that the generated ArcGIS URL contains our required parameters.
test("creates a paginated CDFW query URL", () => {
  const queryUrl = new URL(
    createCdfwQueryUrl(500)
  );

  assert.equal(
    queryUrl.searchParams.get("resultOffset"),
    "500"
  );

  assert.equal(
    queryUrl.searchParams.get("resultRecordCount"),
    "500"
  );

  assert.equal(
    queryUrl.searchParams.get("returnGeometry"),
    "false"
  );

    // Verifies that the server is asked to return JSON.
    // f stands for the output format:
    // f=json
  assert.equal(
    queryUrl.searchParams.get("f"),
    "json"
  );

  // Confirm that the query requests a field needed by the popup.
  const requestedFields =
    queryUrl.searchParams.get("outFields");

  assert.equal(
    requestedFields.includes("WaterName"),
    true
  );
});

// Verify that live schedule IDs become a distinct ArcGIS location query.
test("creates a water-location query URL", () => {
  // Include one repeated ID to verify that duplicates are removed.
  const waterIds = [27445, 27445, 12343];

  const queryUrl = new URL(
    createWaterLocationsQueryUrl(waterIds, 500)
  );

  assert.equal(
    queryUrl.searchParams.get("where"),
    "StockingWaterID IN (27445,12343)"
  );

  assert.equal(
    queryUrl.searchParams.get("outFields"),
    "StockingWaterID,WaterName,Lat,Lon"
  );

  assert.equal(
    queryUrl.searchParams.get("returnDistinctValues"),
    "true"
  );

  assert.equal(
    queryUrl.searchParams.get("resultOffset"),
    "500"
  );
});

// Verify that pagination combines multiple responses into one array.
test("downloads and combines multiple CDFW pages", async () => {
  // These objects represent records returned by the fake server.
  const firstFeature = {
    attributes: {
      StockingWaterID: 1
    }
  };

  const secondFeature = {
    attributes: {
      StockingWaterID: 2
    }
  };

  const thirdFeature = {
    attributes: {
      StockingWaterID: 3
    }
  };

  // The first fake page says that another page is available.
  const fakePages = [
    {
      features: [
        firstFeature,
        secondFeature
      ],
      exceededTransferLimit: true
    },
    {
      features: [
        thirdFeature
      ],
      exceededTransferLimit: false
    }
  ];

  // Save the real fetch so the test can restore it afterward.
  const originalFetch = globalThis.fetch;

  const requestedOffsets = [];
  let pageNumber = 0;

  // Replace fetch with a controlled fake implementation.
  globalThis.fetch = async (url) => {
    const requestedUrl = new URL(url);

    requestedOffsets.push(
      requestedUrl.searchParams.get("resultOffset")
    );

    const currentPage = fakePages[pageNumber];
    pageNumber += 1;

    // This object imitates the parts of a real fetch response we use.
    return {
      ok: true,
      status: 200,

      // response.json() is asynchronous in the real Fetch API.
      json: async () => {
        return currentPage;
      }
    };
  };

  try {
    const downloadedFeatures =
      await fetchCdfwFeatures();

    // deepEqual compares arrays and the objects inside them.
    assert.deepEqual(
      downloadedFeatures,
      [
        firstFeature,
        secondFeature,
        thirdFeature
      ]
    );

    // The second request skips the two records already downloaded.
    assert.deepEqual(
      requestedOffsets,
      ["0", "2"]
    );
  } finally {
    // Always restore fetch, even when an assertion fails.
    globalThis.fetch = originalFetch;
  }
});

// Verify that an unsuccessful HTTP status becomes an application error.
test("throws when CDFW returns an HTTP error", async () => {
  // Save the real fetch function so it can be restored after the test.
  const originalFetch = globalThis.fetch;

  // Replace fetch with a response that represents an unavailable server.
  globalThis.fetch = async () => {
    return {
      ok: false,
      status: 503
    };
  };

  try {
    // assert.rejects() passes only when the Promise rejects as expected.
    await assert.rejects(
      async () => {
        await fetchCdfwFeatures();
      },
      {
        message: "CDFW request failed with status 503"
      }
    );
  } finally {
    // Always restore fetch so this fake does not affect another test.
    globalThis.fetch = originalFetch;
  }
});

// Verify that an ArcGIS error inside a successful HTTP response is detected.
test("throws when ArcGIS returns an API error", async () => {
  // Save the real fetch function before installing this test's fake.
  const originalFetch = globalThis.fetch;

  // ArcGIS can return HTTP success while placing error details in the JSON.
  globalThis.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => {
        return {
          error: {
            message: "ArcGIS service unavailable"
          }
        };
      }
    };
  };

  try {
    // Confirm that the API's message is passed through to our thrown Error.
    await assert.rejects(
      async () => {
        await fetchCdfwFeatures();
      },
      {
        message: "ArcGIS service unavailable"
      }
    );
  } finally {
    // Restore the original global function even when the assertion fails.
    globalThis.fetch = originalFetch;
  }
});
