// background.js
// Background service worker for Job Tracker extension
console.log("Job Tracker background service worker loaded.");

// Store job data temporarily for popup access
let currentJobData = null;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openPopup") {
    // Store the job data
    currentJobData = message.jobData;

    // Open the popup
    chrome.action.openPopup();

    sendResponse({ success: true });
  }

  if (message.action === "getStoredJobData") {
    // Return stored job data to popup
    sendResponse({
      success: true,
      data: currentJobData,
    });

    // Clear the stored data after sending
    currentJobData = null;
  }
});

// Handle popup opening
chrome.action.onClicked.addListener((tab) => {
  // This will be called when the extension icon is clicked
  // The popup will open automatically due to the manifest configuration
  console.log("Extension icon clicked");
});
