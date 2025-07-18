// content.js
// Content script for Job Tracker extension
// This script injects a 'Save Job' button on LinkedIn job pages.

console.log("Job Tracker content script loaded on LinkedIn job page.");

// Global variable to track if we've already set up the observer
let observerSetUp = false;

// Helper function to determine the site based on URL
function getSite() {
  const url = window.location.href;
  if (url.includes("linkedin.com/jobs/view/")) return "linkedin";
  if (url.includes("seek.com.au/job/")) return "seek";
  return null;
}

// Function to extract job data from the job page
function extractJobData() {
  const site = getSite();

  if (site === "linkedin") {
    // 1. Extract the company name
    // Try the most robust selector for company name based on provided HTML
    let company = "";
    const companyEl = document.querySelector(
      ".job-details-jobs-unified-top-card__company-name a"
    );
    if (companyEl) {
      company = companyEl.textContent.trim();
    } else {
      // Fallback: try another possible selector
      const fallbackCompanyEl = document.querySelector(
        ".artdeco-entity-lockup__title a"
      );
      if (fallbackCompanyEl) {
        company = fallbackCompanyEl.textContent.trim();
      }
    }

    // 2. Extract the role/title
    let role = "";
    // Main job title in the job details card
    const roleEl = document.querySelector(
      ".job-details-jobs-unified-top-card__job-title h1"
    );
    if (roleEl) {
      role = roleEl.textContent.trim();
    } else {
      // Fallback: try another possible selector (sticky header or other h2)
      const fallbackRoleEl = document.querySelector(
        ".job-details-jobs-unified-top-card__title-container h2, .text-heading-large"
      );
      if (fallbackRoleEl) {
        role = fallbackRoleEl.textContent.trim();
      }
    }

    // 3. Application link (current page URL)
    const applicationLink = window.location.href;

    // 4. Timestamp
    const timestamp = new Date().toISOString();

    // Log the extracted data
    console.log("Extracted Job Data (LinkedIn):", {
      company,
      role,
      applicationLink,
      timestamp,
    });

    // Return the data
    return { company, role, applicationLink, timestamp };
  } else if (site === "seek") {
    // Extract from Seek page
    let company = "";
    const companyEl = document.querySelector(
      '[data-automation="advertiser-name"]'
    );
    if (companyEl) {
      company = companyEl.textContent.trim();
    }

    let role = "";
    const roleEl = document.querySelector(
      '[data-automation="job-detail-title"]'
    );
    if (roleEl) {
      role = roleEl.textContent.trim();
    }

    const applicationLink = window.location.href;
    const timestamp = new Date().toISOString();

    // Log the extracted data
    console.log("Extracted Job Data (Seek):", {
      company,
      role,
      applicationLink,
      timestamp,
    });

    return { company, role, applicationLink, timestamp };
  }

  // If not a supported site, return empty
  return {};
}

// Helper function to check if the button already exists
function isButtonPresent() {
  return document.getElementById("job-tracker-save-btn") !== null;
}

// Helper function to create the Save Job button
function createSaveJobButton() {
  const button = document.createElement("button");
  button.id = "job-tracker-save-btn";
  button.textContent = "Save Job";
  console.log("Save Job button created.");
  // Styles are now in content/content.css
  button.addEventListener("click", () => {
    // Extract job data when the button is clicked
    const jobData = extractJobData();

    // Send message to popup with job data
    chrome.runtime.sendMessage({
      action: "openPopup",
      jobData: jobData,
    });
  });
  return button;
}

// Function to inject the button after the job title
function injectButton() {
  if (isButtonPresent()) return; // Prevent duplicate buttons

  const site = getSite();

  if (site === "linkedin") {
    // Try to find the job title element using the correct selector
    const titleEl = document.querySelector(
      ".job-details-jobs-unified-top-card__job-title h1"
    );
    if (titleEl) {
      // Create the button
      const button = createSaveJobButton();

      // Apply styling to the title element
      titleEl.style.display = "inline-block";
      titleEl.style.marginRight = "10px";

      // Apply styling to the button
      button.style.display = "inline-block";
      button.style.verticalAlign = "baseline";

      // Insert the button inside the title element
      titleEl.appendChild(button);
      console.log("Save Job button injected inside LinkedIn job title.");
    } else {
      // If not found, try again after a short delay (DOM may not be ready)
      setTimeout(injectButton, 1000);
    }
  } else if (site === "seek") {
    const titleEl = document.querySelector(
      '[data-automation="job-detail-title"]'
    );
    if (titleEl) {
      // Create the button
      const button = createSaveJobButton();

      // Apply styling to the title element
      titleEl.style.display = "inline-block";
      titleEl.style.marginRight = "10px";

      // Apply styling to the button
      button.style.display = "inline-block";
      button.style.verticalAlign = "baseline";

      // Insert the button inside the title element
      titleEl.appendChild(button);
      console.log("Save Job button injected inside Seek job title.");
    } else {
      setTimeout(injectButton, 1000);
    }
  }
}

// Function to set up MutationObserver to watch for DOM changes
function setupObserver() {
  if (observerSetUp) return; // Prevent multiple observers

  observerSetUp = true;

  // Create a MutationObserver to watch for DOM changes
  const observer = new MutationObserver((mutations) => {
    let shouldReinject = false;

    mutations.forEach((mutation) => {
      // Check if our button was removed
      if (mutation.type === "childList") {
        mutation.removedNodes.forEach((node) => {
          if (node.id === "job-tracker-save-btn") {
            shouldReinject = true;
          }
        });

        // Check if new job title elements were added
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const site = getSite();
            if (site === "linkedin") {
              if (
                node.querySelector &&
                node.querySelector(
                  ".job-details-jobs-unified-top-card__job-title h1"
                )
              ) {
                shouldReinject = true;
              }
            } else if (site === "seek") {
              if (
                node.querySelector &&
                node.querySelector('[data-automation="job-detail-title"]')
              ) {
                shouldReinject = true;
              }
            }
          }
        });
      }
    });

    // Reinject button if needed
    if (shouldReinject) {
      setTimeout(() => {
        if (!isButtonPresent()) {
          injectButton();
        }
      }, 100);
    }
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("MutationObserver set up to watch for DOM changes");
}

// Enhanced initialization function
function initializeJobTracker() {
  console.log("Job Tracker content script loaded on job page.");

  // Set up the observer first
  setupObserver();

  // Initial injection attempt
  injectButton();

  // Additional injection attempts with delays to handle dynamic loading
  setTimeout(injectButton, 500);
  setTimeout(injectButton, 1500);
  setTimeout(injectButton, 3000);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeJobTracker);
} else {
  initializeJobTracker();
}

// Also initialize on page load (for SPA navigation)
window.addEventListener("load", initializeJobTracker);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getJobData") {
    try {
      const jobData = extractJobData();
      sendResponse({
        success: true,
        data: jobData,
      });
    } catch (error) {
      console.error("Failed to extract job data:", error);
      sendResponse({
        success: false,
        error: error.message,
      });
    }
    return true; // Keep the message channel open for async response
  }
});
