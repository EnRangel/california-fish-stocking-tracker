// -----------------------------------------------------------------------------
// Live CDFW schedule configuration
// -----------------------------------------------------------------------------

// CDFW's public schedule is newer than the ArcGIS planting-history layer.
// It is the source of truth for the current week and the next future week.
const CDFW_SCHEDULE_URL =
  "https://www.nrm.dfg.ca.gov/FishPlants/PublicPlantSearch";

// Convert text such as "10/25/2026" into "2026-10-25".
function convertUsDateToIso(dateText) {
  const dateParts = dateText.split("/");

  if (dateParts.length !== 3) {
    throw new Error(
      `CDFW schedule contained an invalid date: ${dateText}`
    );
  }

  const month = Number(dateParts[0]);
  const day = Number(dateParts[1]);
  const year = Number(dateParts[2]);

  // Constructing a Date lets us reject impossible values such as month 15.
  const dateForValidation = new Date(
    year,
    month - 1,
    day
  );

  const hasValidYear =
    dateForValidation.getFullYear() === year;

  const hasValidMonth =
    dateForValidation.getMonth() === month - 1;

  const hasValidDay =
    dateForValidation.getDate() === day;

  if (
    !hasValidYear ||
    !hasValidMonth ||
    !hasValidDay
  ) {
    throw new Error(
      `CDFW schedule contained an invalid date: ${dateText}`
    );
  }

  const paddedMonth =
    String(month).padStart(2, "0");

  const paddedDay =
    String(day).padStart(2, "0");

  return `${year}-${paddedMonth}-${paddedDay}`;
}

// Convert the small set of HTML entities that can appear in table text.
function decodeHtmlEntities(encodedText) {
  let decodedText = encodedText;

  // Decode hexadecimal numeric entities such as &#x20;.
  decodedText = decodedText.replace(
    /&#x([0-9a-f]+);/gi,
    (completeMatch, hexadecimalValue) => {
      const characterCode =
        Number.parseInt(hexadecimalValue, 16);

      return String.fromCodePoint(characterCode);
    }
  );

  // Decode decimal numeric entities such as &#39;.
  decodedText = decodedText.replace(
    /&#(\d+);/g,
    (completeMatch, decimalValue) => {
      const characterCode =
        Number.parseInt(decimalValue, 10);

      return String.fromCodePoint(characterCode);
    }
  );

  // Decode common named entities used in ordinary text.
  decodedText = decodedText.replace(/&nbsp;/gi, " ");
  decodedText = decodedText.replace(/&amp;/gi, "&");
  decodedText = decodedText.replace(/&quot;/gi, '"');
  decodedText = decodedText.replace(/&apos;/gi, "'");
  decodedText = decodedText.replace(/&lt;/gi, "<");
  decodedText = decodedText.replace(/&gt;/gi, ">");

  return decodedText;
}

// Remove HTML tags and extra whitespace from one table cell.
function extractTextFromHtml(cellHtml) {
  const textWithoutTags =
    cellHtml.replace(/<[^>]*>/g, " ");

  const decodedText =
    decodeHtmlEntities(textWithoutTags);

  // Replace repeated spaces, tabs, and line breaks with one normal space.
  return decodedText.replace(/\s+/g, " ").trim();
}

// Convert an ISO date string into a Date at the beginning of that local day.
function createLocalDateFromIso(dateString) {
  const dateParts = dateString
    .split("-")
    .map(Number);

  const year = dateParts[0];
  const month = dateParts[1];
  const day = dateParts[2];

  return new Date(year, month - 1, day);
}

// Build the public-schedule URL with CDFW's current/future filter selected.
export function createCdfwScheduleUrl() {
  const scheduleUrl = new URL(CDFW_SCHEDULE_URL);

  // PlantTimeFrame=2 is the value used by the site's Current-Future option.
  scheduleUrl.searchParams.set(
    "Params.PlantTimeFrame",
    "2"
  );

  // The public form includes this value when its Search button is used.
  scheduleUrl.searchParams.set("submit", "Search");

  return scheduleUrl.toString();
}

// Classify a live schedule week relative to the user's current calendar date.
export function getLiveScheduleStatus(
  plantingWeekStart,
  currentDate = new Date()
) {
  const plantingDate =
    createLocalDateFromIso(plantingWeekStart);

  const beginningOfToday = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );

  if (plantingDate > beginningOfToday) {
    return "future";
  }

  // This module requests only CDFW's current and future schedule rows.
  // Therefore, a week that has already started is the current schedule.
  return "current";
}

// Parse the official CDFW result table into application-friendly values.
export function parseCdfwScheduleHtml(
  htmlText,
  currentDate = new Date()
) {
  // Target the results table by ID so unrelated layout tables are ignored.
  const scheduleTableMatch = htmlText.match(
    /<table[^>]*id=["']fishPlantsExternal["'][^>]*>([\s\S]*?)<\/table>/i
  );

  if (!scheduleTableMatch) {
    throw new Error(
      "CDFW schedule response did not contain the results table"
    );
  }

  const scheduleTableHtml = scheduleTableMatch[1];

  // Limit row parsing to tbody so the table's header row is not treated as
  // a malformed stocking record.
  const tableBodyMatch = scheduleTableHtml.match(
    /<tbody[^>]*>([\s\S]*?)<\/tbody>/i
  );

  if (!tableBodyMatch) {
    throw new Error(
      "CDFW schedule results table did not contain a table body"
    );
  }

  const tableBodyHtml = tableBodyMatch[1];

  // matchAll() returns every table row instead of only the first match.
  const rowMatches = tableBodyHtml.matchAll(
    /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  );

  const scheduleRecords = [];
  let skippedRowCount = 0;

  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1];

    const cellMatches = Array.from(
      rowHtml.matchAll(
        /<td[^>]*>([\s\S]*?)<\/td>/gi
      )
    );

    // A data row must contain date, water, county, and species cells.
    if (cellMatches.length < 4) {
      skippedRowCount += 1;
      continue;
    }

    const dateRangeText =
      extractTextFromHtml(cellMatches[0][1]);

    const waterCellHtml = cellMatches[1][1];

    const waterIdMatch = waterCellHtml.match(
      /stockid=(\d+)/i
    );

    const dateSeparatorIndex =
      dateRangeText.indexOf("-");

    if (
      !waterIdMatch ||
      dateSeparatorIndex === -1
    ) {
      skippedRowCount += 1;
      continue;
    }

    const plantingWeekStartText =
      dateRangeText.slice(0, dateSeparatorIndex);

    const plantingWeekStart =
      convertUsDateToIso(plantingWeekStartText);

    // Remove the nested map link before extracting the water name.
    const waterCellWithoutMapLink =
      waterCellHtml.replace(
        /<a[^>]*>[\s\S]*?<\/a>/gi,
        ""
      );

    const waterId = Number(waterIdMatch[1]);
    const waterName =
      extractTextFromHtml(waterCellWithoutMapLink);

    const counties =
      extractTextFromHtml(cellMatches[2][1]);

    const fishType =
      extractTextFromHtml(cellMatches[3][1]);

    const status = getLiveScheduleStatus(
      plantingWeekStart,
      currentDate
    );

    scheduleRecords.push({
      waterId: waterId,
      waterName: waterName,
      fishType: fishType,
      counties: counties,
      plantingWeekStart: plantingWeekStart,
      status: status
    });
  }

  if (skippedRowCount > 0) {
    console.warn(
      `Skipped ${skippedRowCount} malformed CDFW schedule rows.`
    );
  }

  // Display current-week records before records from the future week.
  scheduleRecords.sort((firstRecord, secondRecord) => {
    return firstRecord.plantingWeekStart.localeCompare(
      secondRecord.plantingWeekStart
    );
  });

  return scheduleRecords;
}

// Download and parse CDFW's current/future public schedule.
export async function fetchCdfwScheduleRecords() {
  const scheduleUrl = createCdfwScheduleUrl();
  const response = await fetch(scheduleUrl);

  if (!response.ok) {
    throw new Error(
      `CDFW schedule request failed with status ${response.status}`
    );
  }

  const htmlText = await response.text();
  const scheduleRecords =
    parseCdfwScheduleHtml(htmlText);

  console.log(
    `Downloaded ${scheduleRecords.length} live schedule records.`
  );

  return scheduleRecords;
}
