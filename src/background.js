// Run this function whenever the user clicks our extension's toolbar button.
browser.action.onClicked.addListener(() => {
    // // Convert the relative file path into a complete extension URL.
    const mapPageUrl = browser.runtime.getURL("src/map/index.html");
/// Open the map page in a new browser tab.
    browser.tabs.create({
        url: mapPageUrl
    })
})