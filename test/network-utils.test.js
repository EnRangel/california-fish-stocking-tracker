// node:test provides Node's built-in test() function.
import test from "node:test";

// Strict assertions compare values without automatic type conversion.
import assert from "node:assert/strict";

import {
  fetchWithTimeout,
  readTextWithLimit
} from "../src/popup/network-utils.js";

// Verify that public-data requests explicitly omit credentials and referrers.
test("uses private network request options", async () => {
  const originalFetch = globalThis.fetch;
  let receivedOptions;

  // The second fetch argument contains options such as credentials and signal.
  globalThis.fetch = async (requestUrl, requestOptions) => {
    receivedOptions = requestOptions;

    return {
      ok: true,
      status: 200
    };
  };

  try {
    const status = await fetchWithTimeout(
      "https://example.test/data",
      async (response) => {
        return response.status;
      }
    );

    assert.equal(status, 200);
    assert.equal(receivedOptions.credentials, "omit");
    assert.equal(receivedOptions.referrerPolicy, "no-referrer");
    assert.equal(receivedOptions.signal.aborted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Verify that AbortController ends a request that never finishes on its own.
test("stops a network request after its timeout", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (requestUrl, requestOptions) => {
    // This Promise deliberately has no success path. It rejects only after
    // fetchWithTimeout() aborts the signal supplied in requestOptions.
    return new Promise((resolve, reject) => {
      requestOptions.signal.addEventListener("abort", () => {
        const abortError = new Error("Request aborted");
        abortError.name = "AbortError";
        reject(abortError);
      });
    });
  };

  try {
    await assert.rejects(
      async () => {
        await fetchWithTimeout(
          "https://example.test/slow",
          async (response) => {
            return response;
          },
          5
        );
      },
      {
        message: "CDFW request timed out"
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Verify that schedule text cannot exceed the caller's safety limit.
test("rejects a text response that is too large", async () => {
  const fakeResponse = {
    headers: {
      get: () => {
        return null;
      }
    },
    text: async () => {
      return "123456";
    }
  };

  await assert.rejects(
    async () => {
      await readTextWithLimit(fakeResponse, 5);
    },
    {
      message: "CDFW response exceeded the size limit"
    }
  );
});
