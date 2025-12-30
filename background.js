chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    console.log("Markdown to Gemini Extension installed.");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'DOWNLOAD_IMAGE') {
        chrome.downloads.download({
            url: request.url,
            filename: `gemini-images/${request.filename || 'image.png'}`
        });
    }
});
