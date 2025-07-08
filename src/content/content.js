// content.js
// Content script for Job Tracker extension
// This script injects a 'Save Job' button on LinkedIn job pages.

console.log("Job Tracker content script loaded on LinkedIn job page.");

// Function to extract job data from the LinkedIn job page
function extractJobData() {
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
  console.log("Extracted Job Data:", {
    company,
    role,
    applicationLink,
    timestamp,
  });

  // Return the data in case you want to use it elsewhere
  return { company, role, applicationLink, timestamp };
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
    // Extract and log job data when the button is clicked
    extractJobData();
  });
  return button;
}

// Function to inject the button after the job title
function injectButton() {
  if (isButtonPresent()) return; // Prevent duplicate buttons

  // Try to find the job title element using the correct selector
  const titleEl = document.querySelector(
    ".job-details-jobs-unified-top-card__job-title h1"
  );
  if (titleEl) {
    // Insert the button after the job title
    const button = createSaveJobButton();
    titleEl.parentNode.insertBefore(button, titleEl.nextSibling);
    console.log("Save Job button injected after job title.");
  } else {
    // If not found, try again after a short delay (DOM may not be ready)
    setTimeout(injectButton, 1000);
  }
}

// Run the injection when the script loads
injectButton();
