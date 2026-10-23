// -----------------------------------------------------------------------------
// Safer network requests
// -----------------------------------------------------------------------------
//
// The extension downloads public information from CDFW and ArcGIS. These
// helpers prevent a slow server from leaving the popup waiting forever.

// Stop a request after 15 seconds. The caller can supply a shorter value in a
// test, but ordinary extension code uses this default.
const DEFAULT_REQUEST_TIMEOUT_MS = 15 * 1000;

// Download a URL and let the caller decide how to read its response.
export async function fetchWithTimeout(
  requestUrl,
  processResponse,
  timeoutMilliseconds = DEFAULT_REQUEST_TIMEOUT_MS
) {
  // AbortController creates a signal that fetch() listens to. Calling abort()
  // cancels the request associated with that signal.
  const requestController = new AbortController();

  // setTimeout() schedules abort() to run if the request takes too long.
  const timeoutId = setTimeout(() => {
    requestController.abort();
  }, timeoutMilliseconds);

  try {
    const response = await fetch(requestUrl, {
      signal: requestController.signal,

      // These requests only retrieve public data. Explicitly omit credentials
      // so browser cookies or HTTP login information are never included.
      credentials: "omit",

      // Do not tell the remote server which extension page made the request.
      referrerPolicy: "no-referrer"
    });

    // processResponse is a callback supplied by the caller. Keeping the timer
    // active while this callback reads JSON or text also protects body reads.
    return await processResponse(response);
  } catch (error) {
    // fetch() uses an AbortError when AbortController ends the request.
    if (error && error.name === "AbortError") {
      throw new Error("CDFW request timed out");
    }

    throw error;
  } finally {
    // finally always runs, whether the request succeeded or failed. Clearing
    // the timer prevents it from firing after the request has finished.
    clearTimeout(timeoutId);
  }
}

// Read an HTML response while rejecting unexpectedly large documents.
export async function readTextWithLimit(
  response,
  maximumCharacterCount
) {
  // Content-Length is measured in bytes and may be absent. It still provides
  // a useful early rejection before response.text() allocates a large string.
  const contentLengthHeader =
    response.headers && typeof response.headers.get === "function"
      ? response.headers.get("content-length")
      : null;

  const declaredResponseSize =
    Number(contentLengthHeader);

  if (
    contentLengthHeader !== null &&
    Number.isFinite(declaredResponseSize) &&
    declaredResponseSize > maximumCharacterCount
  ) {
    throw new Error("CDFW response exceeded the size limit");
  }

  const responseText = await response.text();

  // Servers do not have to send Content-Length, so verify the actual string
  // after it has been read as a second layer of protection.
  if (responseText.length > maximumCharacterCount) {
    throw new Error("CDFW response exceeded the size limit");
  }

  return responseText;
}
