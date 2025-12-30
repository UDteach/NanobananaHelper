let directoryHandle;
let fileEntries = [];
let processingQueue = [];
let isAutoProcessing = false;
let currentFileIndex = -1;

// DOM Elements
const selectFolderBtn = document.getElementById('select-folder');
const selectAllBtn = document.getElementById('select-all');
const deselectAllBtn = document.getElementById('deselect-all');
const startAutoBtn = document.getElementById('start-auto');
const stopAutoBtn = document.getElementById('stop-auto');
const fileListElement = document.getElementById('file-list');
const selectionControls = document.getElementById('selection-controls');
const actionButtons = document.getElementById('action-buttons');
const progressSection = document.getElementById('progress-section');
const progressLabel = document.getElementById('progress-label');
const progressCount = document.getElementById('progress-count');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const statusEl = document.getElementById('status');

// Folder selection
selectFolderBtn.addEventListener('click', async () => {
    try {
        directoryHandle = await window.showDirectoryPicker();
        await updateFileList();
        statusEl.textContent = 'Folder selected.';
        statusEl.style.color = '#666';
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error(err);
            statusEl.textContent = 'Error selecting folder.';
            statusEl.style.color = 'red';
        }
    }
});

// Select/Deselect all
selectAllBtn.addEventListener('click', () => {
    document.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = true);
});

deselectAllBtn.addEventListener('click', () => {
    document.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = false);
});

// Start auto-processing
startAutoBtn.addEventListener('click', startAutoProcess);

// Stop auto-processing
// Stop auto-processing
stopAutoBtn.addEventListener('click', stopAutoProcess);

async function updateFileList() {
    fileListElement.innerHTML = '';
    fileEntries = [];

    for await (const entry of directoryHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            fileEntries.push(entry);
        }
    }

    // Sort by name
    fileEntries.sort((a, b) => a.name.localeCompare(b.name));

    fileEntries.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.dataset.index = index;
        li.innerHTML = `
            <input type="checkbox" class="file-checkbox" data-index="${index}" checked>
            <span class="icon">M↓</span>
            <span class="filename">${entry.name}</span>
            <span class="status-icon"></span>
        `;
        li.querySelector('.filename').addEventListener('click', () => handleFileSelect(entry));
        fileListElement.appendChild(li);
    });

    if (fileEntries.length === 0) {
        statusEl.textContent = 'No Markdown files found in this folder.';
        selectionControls.style.display = 'none';
        actionButtons.style.display = 'none';
    } else {
        statusEl.textContent = `${fileEntries.length} Markdown file(s) found.`;
        selectionControls.style.display = 'flex';
        actionButtons.style.display = 'flex';
    }
}

async function handleFileSelect(fileEntry) {
    if (isAutoProcessing) {
        statusEl.textContent = 'Auto-processing in progress. Please wait or stop.';
        return;
    }
    try {
        const file = await fileEntry.getFile();
        const content = await readFileAsUTF8(file);
        await sendMarkdownToChat(content, fileEntry.name);
    } catch (err) {
        console.error(err);
        statusEl.textContent = 'Error reading file.';
    }
}

async function sendMarkdownToChat(content, fileName) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) {
        statusEl.textContent = 'No active tab found.';
        return false;
    }

    statusEl.textContent = `Pasting ${fileName}...`;

    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, {
            action: 'PASTE_MARKDOWN',
            content: content,
            autoMode: isAutoProcessing
        }, (response) => {
            if (chrome.runtime.lastError) {
                // Try injecting content script
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                }, () => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'PASTE_MARKDOWN',
                        content: content,
                        autoMode: isAutoProcessing
                    }, (res) => {
                        handlePasteResponse(res, fileName);
                        resolve(res && res.status === 'done');
                    });
                });
            } else {
                handlePasteResponse(response, fileName);
                resolve(response && response.status === 'done');
            }
        });
    });
}

function handlePasteResponse(response, fileName) {
    if (response && response.status === 'busy') {
        statusEl.textContent = `Busy: Could not paste ${fileName}. Wait for Gemini...`;
        statusEl.style.color = 'red';
    } else if (response && response.status === 'done') {
        statusEl.textContent = `Sent: ${fileName}`;
        statusEl.style.color = '#666';
    }
}

async function startAutoProcess() {
    // Collect checked files
    const checkboxes = document.querySelectorAll('.file-checkbox:checked');
    if (checkboxes.length === 0) {
        statusEl.textContent = 'No files selected.';
        return;
    }

    processingQueue = [];
    checkboxes.forEach(cb => {
        const index = parseInt(cb.dataset.index);
        processingQueue.push({ entry: fileEntries[index], index });
    });

    isAutoProcessing = true;
    currentFileIndex = 0;

    // Update UI
    startAutoBtn.style.display = 'none';
    stopAutoBtn.style.display = 'block';
    selectFolderBtn.disabled = true;
    progressSection.classList.add('visible');

    // Clear previous status
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('processing', 'completed');
        item.querySelector('.status-icon').textContent = '';
    });

    updateProgress();
    processNextFile();
}

function stopAutoProcess() {
    isAutoProcessing = false;
    startAutoBtn.style.display = 'block';
    stopAutoBtn.style.display = 'none';
    selectFolderBtn.disabled = false;
    progressText.textContent = 'Stopped by user.';
    statusEl.textContent = 'Auto-processing stopped.';

    // Notify content script to stop watching
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { action: 'STOP_AUTO_PROCESS' });
        }
    });
}

function updateProgress() {
    const total = processingQueue.length;
    const completed = currentFileIndex;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    progressCount.textContent = `${completed}/${total}`;
    progressFill.style.width = `${percent}%`;

    if (currentFileIndex < total) {
        const currentFile = processingQueue[currentFileIndex];
        progressLabel.textContent = 'Processing...';
        progressText.textContent = currentFile.entry.name;
    } else {
        progressLabel.textContent = 'Complete!';
        progressText.textContent = `All ${total} files processed.`;
    }
}

async function processNextFile() {
    if (!isAutoProcessing) return;

    if (currentFileIndex >= processingQueue.length) {
        // All done
        isAutoProcessing = false;
        startAutoBtn.style.display = 'block';
        stopAutoBtn.style.display = 'none';
        selectFolderBtn.disabled = false;
        statusEl.textContent = 'Auto-processing complete!';
        statusEl.style.color = 'green';
        updateProgress();
        return;
    }

    const current = processingQueue[currentFileIndex];
    const fileItem = document.querySelector(`.file-item[data-index="${current.index}"]`);

    // Mark as processing
    if (fileItem) {
        fileItem.classList.add('processing');
        fileItem.querySelector('.status-icon').textContent = '⏳';
    }

    updateProgress();

    try {
        const file = await current.entry.getFile();
        const content = await readFileAsUTF8(file);
        await sendMarkdownToChat(content, current.entry.name);
        // Wait for completion from content script
    } catch (err) {
        console.error('Error processing file:', err);
        onTaskComplete(false, 0);
    }
}

// Listen for task completion from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TASK_COMPLETE' && isAutoProcessing) {
        onTaskComplete(request.hasImages, request.imageCount);
    }
    sendResponse({ received: true });
});

function onTaskComplete(hasImages, imageCount) {
    if (!isAutoProcessing) return;

    const current = processingQueue[currentFileIndex];
    const fileItem = document.querySelector(`.file-item[data-index="${current.index}"]`);

    // Mark as completed
    if (fileItem) {
        fileItem.classList.remove('processing');
        fileItem.classList.add('completed');
        const icon = hasImages ? `✅ (${imageCount} img)` : '✅';
        fileItem.querySelector('.status-icon').textContent = icon;
    }

    statusEl.textContent = `Completed: ${current.entry.name}` + (hasImages ? ` (${imageCount} images downloaded)` : '');

    currentFileIndex++;
    updateProgress();

    // Small delay before next file
    setTimeout(() => {
        processNextFile();
    }, 1000);
}

// Helper function to read file with encoding detection (UTF-8 or Shift-JIS)
async function readFileAsUTF8(file) {
    // First try UTF-8
    const utf8Content = await readWithEncoding(file, 'UTF-8');

    // Check for mojibake (common pattern: replacement characters or garbled text)
    if (hasMojibake(utf8Content)) {
        console.log('Detected mojibake, trying Shift-JIS...');
        return await readWithEncoding(file, 'Shift_JIS');
    }

    return utf8Content;
}

function readWithEncoding(file, encoding) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file, encoding);
    });
}

function hasMojibake(text) {
    // Check for common mojibake indicators
    // U+FFFD is the replacement character
    if (text.includes('\uFFFD')) return true;

    // Check for suspicious character sequences common in mis-decoded Shift-JIS
    // These patterns appear when Shift-JIS is read as UTF-8
    const mojibakePatterns = /[\x80-\x9F]|[\u0080-\u009F]/;
    if (mojibakePatterns.test(text)) return true;

    return false;
}
