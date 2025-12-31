// Auto-process mode state
let isAutoMode = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PASTE_MARKDOWN') {
        isAutoMode = request.autoMode || false;

        // First ensure the "Create Image" tool is active, then paste
        ensureCreateImageMode().then(() => {
            // After ensuring Create Image mode, wait a moment then paste
            setTimeout(() => {
                pasteToChat(request.content);
                sendResponse({ status: 'done' });

                // If auto mode, start watching for response completion
                if (isAutoMode) {
                    startResponseWatcher();
                }
            }, 500);
        }).catch(err => {
            console.error('Failed to activate Create Image mode:', err);
            // Still try to paste anyway as a fallback
            pasteToChat(request.content);
            sendResponse({ status: 'done' });

            if (isAutoMode) {
                startResponseWatcher();
            }
        });
    } else if (request.action === 'DOWNLOAD_ALL_IMAGES') {
        const result = downloadAllImages();
        sendResponse({ status: 'done', imageCount: result.count });
    } else if (request.action === 'STOP_AUTO_PROCESS') {
        isAutoMode = false;
        sendResponse({ status: 'stopped' });
    }
    return true; // Keep message channel open for async response
});

async function ensureCreateImageMode() {
    console.log('Checking Create Image mode...');

    // 1. Check if the "Image Creation" chip is already present
    const deselectButton = document.querySelector('button[aria-label*="選択を解除"], button[aria-label*="Deselect"]');
    if (deselectButton) {
        console.log('Create Image mode is already active.');
        return;
    }

    console.log('Activating Create Image mode...');

    // 2. Find and click the "Tools" (toolbox) button
    let toolboxButton = null;
    // Retry looking for the button (it might be loading)
    for (let k = 0; k < 10; k++) {
        toolboxButton = findToolboxButton();
        if (toolboxButton) break;
        console.log(`Toolbox button not found, retrying... (${k + 1}/10)`);
        await sleep(500);
    }

    if (!toolboxButton) {
        console.warn('Toolbox button not found after retries.');
        // Don't return here, try one last check in case the UI is different
        // return; 
    } else {
        toolboxButton.click();
        console.log('Clicked toolbox button.');
    }

    // 3. Wait for the menu to appear and find "Create Image" option
    for (let i = 0; i < 20; i++) {
        await sleep(200);
        const createImageBtn = getCreateImageButton();
        if (createImageBtn) {
            console.log('Found Create Image button, clicking...');
            createImageBtn.click();

            // 4. Wait for the chip to appear
            for (let j = 0; j < 15; j++) {
                await sleep(200);
                if (document.querySelector('button[aria-label*="選択を解除"], button[aria-label*="Deselect"]')) {
                    console.log('Create Image mode activated successfully.');
                    await sleep(300); // Extra wait for UI to stabilize
                    return;
                }
            }
            console.log('Chip did not appear, but continuing...');
            return;
        }
    }
    console.warn('Create Image button not found in menu.');
}

function findToolboxButton() {
    // Primary selector - the toolbox drawer button
    const drawerButton = document.querySelector('button.toolbox-drawer-button');
    if (drawerButton) {
        console.log('Found toolbox-drawer-button');
        return drawerButton;
    }

    // Try aria-label selectors
    const selectors = [
        'button[aria-label="ツール"]',
        'button[aria-label="Tools"]',
        'button[aria-label*="ツール"]',
        'button[aria-label*="Tools"]'
    ];

    for (const selector of selectors) {
        const btn = document.querySelector(selector);
        if (btn) {
            console.log(`Found button with selector: ${selector}`);
            return btn;
        }
    }

    // Fallback: search all buttons by text content
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
        const text = btn.innerText || btn.textContent || '';
        const label = btn.getAttribute('aria-label') || '';
        if (text.includes('ツール') || text.includes('Tools') ||
            label.includes('ツール') || label.includes('Tools')) {
            console.log('Found button by text/label fallback');
            return btn;
        }
    }

    console.warn('No toolbox button found with any selector');
    return null;
}

function getCreateImageButton() {
    const labels = ['画像を作成', '画像の作成', 'Create Image', 'Create image'];

    // Primary selector - toolbox drawer item buttons
    const drawerItems = document.querySelectorAll('button.toolbox-drawer-item-list-button');
    for (const el of drawerItems) {
        const text = el.innerText || el.textContent || '';
        if (labels.some(l => text.includes(l))) {
            console.log('Found Create Image in drawer items');
            return el;
        }
    }

    // Fallback - search more broadly
    const elements = document.querySelectorAll('button, [role="button"], [role="menuitem"], .mat-mdc-menu-item, .mat-mdc-list-item');
    for (const el of elements) {
        const text = el.innerText || el.textContent || '';
        if (labels.some(l => text.includes(l))) {
            console.log('Found Create Image via fallback');
            return el;
        }
    }

    console.warn('Create Image button not found');
    return null;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function isGeminiBusy() {
    // Check for stop button first (most reliable indicator of generation in progress)
    const stopSelectors = [
        'button[aria-label="Stop response"]',
        'button[aria-label="回答を停止"]',
        'button[aria-label*="Stop"]',
        'button[aria-label*="停止"]'
    ];

    for (const selector of stopSelectors) {
        const stopBtn = document.querySelector(selector);
        if (stopBtn && stopBtn.offsetParent !== null) {
            return true;
        }
    }

    // Check for loading/generating indicators
    const loadingIndicators = document.querySelectorAll('.loading-indicator, .generating, [aria-busy="true"]');
    if (loadingIndicators.length > 0) {
        return true;
    }

    return false;
}

function getSubmitButton() {
    const submitSelectors = [
        'button[aria-label*="Send"]',
        'button[aria-label*="送信"]',
        '.send-button',
        'button.send-button-container'
    ];

    for (const selector of submitSelectors) {
        const el = document.querySelector(selector);
        if (el) {
            return el.closest('button') || el;
        }
    }

    // Fallback: look for send icon
    const sendIcon = document.querySelector('mat-icon[data-mat-icon-name="send"]');
    if (sendIcon) {
        return sendIcon.closest('button');
    }

    return null;
}

// Track already clicked download buttons to prevent duplicates
const clickedDownloadButtons = new Set();

function downloadAllImages() {
    // Find all download buttons for generated images
    const downloadButtons = document.querySelectorAll(
        'button[data-test-id="download-generated-image-button"], ' +
        'button[aria-label*="フルサイズ"], ' +
        'button[aria-label*="Download full size"]'
    );

    if (downloadButtons.length === 0) {
        console.log('No download buttons found.');
        return { count: 0 };
    }

    // Only target the LATEST image (last button in the DOM) to avoid re-downloading old images
    const button = downloadButtons[downloadButtons.length - 1];

    // Create unique identifier for this button based on its position in DOM
    const container = button.closest('.image-container') || button.parentElement;
    const img = container ? container.querySelector('img') : null;
    const buttonId = img ? img.src : `button-${downloadButtons.length - 1}`;
    const normalizedId = normalizeImageUrl(buttonId);

    // Skip if already clicked
    if (clickedDownloadButtons.has(normalizedId)) {
        console.log(`Skipping already downloaded: ${normalizedId.substring(0, 50)}...`);
        return { count: 0 };
    }

    // Mark as clicked
    clickedDownloadButtons.add(normalizedId);

    console.log('Clicking download button for latest image...');
    button.click();

    console.log('Clicked 1 download button (latest image).');
    return { count: 1 };
}

function normalizeImageUrl(url) {
    try {
        const urlObj = new URL(url);
        // Keep only the pathname for googleusercontent URLs
        if (url.includes('googleusercontent.com')) {
            return urlObj.origin + urlObj.pathname;
        }
        return url;
    } catch {
        return url;
    }
}

function pasteToChat(content) {
    const textareaSelectors = [
        'rich-textarea [contenteditable="true"]',
        'div[contenteditable="true"][aria-label*="プロンプト"]',
        'div[contenteditable="true"][aria-label*="prompt"]',
        '#prompt-textarea',
        'textarea',
        '[contenteditable="true"]'
    ];

    let textarea = null;
    for (const selector of textareaSelectors) {
        textarea = document.querySelector(selector);
        if (textarea && textarea.offsetParent !== null) break;
    }

    if (textarea) {
        textarea.focus();
        console.log('Found textarea, pasting content...');

        if (textarea.getAttribute('contenteditable') === 'true' || textarea.tagName === 'DIV') {
            textarea.innerText = '';
            const textNode = document.createTextNode(content);
            textarea.appendChild(textNode);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            textarea.value = content;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Click submit button after a short delay
        setTimeout(() => {
            const submitButton = getSubmitButton();
            if (submitButton && !submitButton.disabled && submitButton.getAttribute('aria-disabled') !== 'true') {
                console.log('Clicking submit button...');
                submitButton.click();
            } else {
                console.log('Submit button not available, trying Enter key...');
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                textarea.dispatchEvent(enterEvent);
            }
        }, 300);
    } else {
        console.error('Gemini Helper: Prompt textarea not found.');
    }
}

// Response watcher for auto-mode
function startResponseWatcher() {
    console.log('Starting response watcher...');

    let checkCount = 0;
    const maxChecks = 300; // Max ~5 minutes
    let generationStarted = false;

    const checkInterval = setInterval(() => {
        if (!isAutoMode) {
            console.log('Auto mode disabled, stopping watcher.');
            clearInterval(checkInterval);
            return;
        }

        checkCount++;

        const isBusy = isGeminiBusy();

        if (isBusy) {
            generationStarted = true;
            console.log('Generation in progress...');
        }

        // If generation started and now not busy, response is complete
        if (generationStarted && !isBusy) {
            console.log('Response complete detected!');
            clearInterval(checkInterval);

            // Wait for images to fully load
            setTimeout(() => {
                handleResponseComplete();
            }, 3000);
        }

        if (checkCount >= maxChecks) {
            console.log('Response watcher timeout.');
            clearInterval(checkInterval);
            notifyTaskComplete(false, 0);
        }
    }, 1000);
}

function handleResponseComplete() {
    console.log('Handling response complete...');

    // Download any images found
    const result = downloadAllImages();
    const hasImages = result.count > 0;

    console.log(`Found ${result.count} images.`);

    // Notify sidepanel
    notifyTaskComplete(hasImages, result.count);
}

function notifyTaskComplete(hasImages, imageCount) {
    chrome.runtime.sendMessage({
        action: 'TASK_COMPLETE',
        hasImages: hasImages,
        imageCount: imageCount
    });
}
