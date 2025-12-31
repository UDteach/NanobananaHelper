chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    console.log("Markdown to Gemini Extension installed.");
});

let downloadState = {
    expecting: false,
    id: null,
    status: 'idle', // idle, pending, complete, error
    startTime: 0
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'DOWNLOAD_IMAGE') {
        chrome.downloads.download({
            url: request.url,
            filename: `gemini-images/${request.filename || 'image.png'}`
        });
        sendResponse({ status: 'started' });
    } else if (request.action === 'EXPECT_DOWNLOAD') {
        downloadState = {
            expecting: true,
            id: null,
            status: 'pending',
            startTime: Date.now()
        };
        console.log('Background: Expecting a download to start...');
        sendResponse({ status: 'ok' });
    } else if (request.action === 'CHECK_DOWNLOAD_STATUS') {
        // Check for timeout (e.g., 30 seconds)
        if (downloadState.status === 'pending' && (Date.now() - downloadState.startTime > 30000)) {
            downloadState.status = 'timeout';
        }
        sendResponse({
            expecting: downloadState.expecting,
            status: downloadState.status,
            id: downloadState.id
        });
    }
    return true; // Keep channel open
});

// Monitor downloads
chrome.downloads.onCreated.addListener((downloadItem) => {
    if (downloadState.expecting && downloadState.status === 'pending') {
        console.log(`Background: Download detected (ID: ${downloadItem.id})`);
        downloadState.id = downloadItem.id;
        // Don't change status to 'complete' yet, wait for onChanged or polling
    }
});

chrome.downloads.onChanged.addListener((delta) => {
    if (downloadState.expecting && downloadState.id === delta.id) {
        if (delta.state && delta.state.current === 'complete') {
            console.log('Background: Download complete!');
            downloadState.status = 'complete';
            downloadState.expecting = false; // Reset expecting flag
        } else if (delta.state && delta.state.current === 'interrupted') {
            console.log('Background: Download interrupted');
            downloadState.status = 'error';
            downloadState.expecting = false;
        }
    }
});
