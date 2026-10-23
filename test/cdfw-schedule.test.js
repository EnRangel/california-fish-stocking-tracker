// node:test provides Node's built-in test() function.
import test from "node:test";

// Strict assertions compare values without automatic type conversion.
import assert from "node:assert/strict";

import {
  createCdfwScheduleUrl,
  fetchCdfwScheduleRecords,
  parseCdfwScheduleHtml
} from "../src/popup/cdfw-schedule.js";

// Verify that the URL selects CDFW's Current-Future schedule option.
test("creates the live CDFW schedule URL", () => {
  const scheduleUrl = new URL(
    createCdfwScheduleUrl()
  );

  assert.equal(
    scheduleUrl.searchParams.get("Params.PlantTimeFrame"),
    "2"
  );

  assert.equal(
    scheduleUrl.searchParams.get("submit"),
    "Search"
  );
});

// Verify that official table rows become current and future schedule records.
test("parses current and future CDFW schedule rows", () => {
  // This small fixture copies the important structure of CDFW's HTML table.
  const scheduleHtml = `
    <html>
      <body>
        <table id="fishPlantsExternal">
          <tbody>
            <tr>
              <td>&#x20;10/18/2026-10/24/2026&#x20;</td>
              <td>
                Lake &amp; Pond
                <a href="https://example.test/?stockid=100">
                  View Water Body in Map
                </a>
              </td>
              <td>Mono</td>
              <td>Trout</td>
            </tr>
            <tr>
              <td>10/25/2026-10/31/2026</td>
              <td>
                Doane Pond
                <a href="https://example.test/?stockid=27445">
                  View Water Body in Map
                </a>
              </td>
              <td>San Diego</td>
              <td>Trout</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  // Fix "today" so this test has the same result on every day it is run.
  const currentDate = new Date(2026, 9, 21);

  const actualRecords = parseCdfwScheduleHtml(
    scheduleHtml,
    currentDate
  );

  const expectedRecords = [
    {
      waterId: 100,
      waterName: "Lake & Pond",
      fishType: "Trout",
      counties: "Mono",
      plantingWeekStart: "2026-10-18",
      status: "current"
    },
    {
      waterId: 27445,
      waterName: "Doane Pond",
      fishType: "Trout",
      counties: "San Diego",
      plantingWeekStart: "2026-10-25",
      status: "future"
    }
  ];

  assert.deepEqual(
    actualRecords,
    expectedRecords
  );
});

// Verify that a changed page structure produces a clear parsing error.
test("throws when the CDFW schedule table is missing", () => {
  const htmlWithoutScheduleTable =
    "<html><body>No schedule table</body></html>";

  assert.throws(
    () => {
      parseCdfwScheduleHtml(htmlWithoutScheduleTable);
    },
    {
      message:
        "CDFW schedule response did not contain the results table"
    }
  );
});

// Verify that an unsuccessful schedule response becomes an application error.
test("throws when the live schedule request fails", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    return {
      ok: false,
      status: 503
    };
  };

  try {
    await assert.rejects(
      async () => {
        await fetchCdfwScheduleRecords();
      },
      {
        message:
          "CDFW schedule request failed with status 503"
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Verify that malformed dates are skipped without hiding valid schedule rows.
test("skips a schedule row with an impossible date", () => {
  const scheduleHtml = `
    <table id="fishPlantsExternal">
      <tbody>
        <tr>
          <td>15/40/2026-15/46/2026</td>
          <td>Bad Date Lake <a href="?stockid=1">Map</a></td>
          <td>Mono</td>
          <td>Trout</td>
        </tr>
        <tr>
          <td>10/25/2026-10/31/2026</td>
          <td>Doane Pond <a href="?stockid=27445">Map</a></td>
          <td>San Diego</td>
          <td>Trout</td>
        </tr>
      </tbody>
    </table>
  `;

  const currentDate = new Date(2026, 9, 21);
  const actualRecords = parseCdfwScheduleHtml(
    scheduleHtml,
    currentDate
  );

  assert.equal(actualRecords.length, 1);
  assert.equal(actualRecords[0].waterName, "Doane Pond");
});

// Verify that the parser rejects a document above its two-million-character
// safety limit before attempting regular-expression parsing.
test("rejects an oversized schedule document", () => {
  const oversizedHtml = "x".repeat(2_000_001);

  assert.throws(
    () => {
      parseCdfwScheduleHtml(oversizedHtml);
    },
    {
      message: "CDFW schedule response exceeded the size limit"
    }
  );
});
