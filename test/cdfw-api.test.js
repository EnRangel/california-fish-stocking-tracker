// node:test provides Node's built-in test() function.
import test from "node:test";

// Strict assertions compare values without automatic type conversion.
import assert from "node:assert/strict";

import {
  createCdfwQueryUrl,
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