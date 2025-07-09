// popup.js - Handle popup functionality for Job Tracker extension
import config from "../config.js";

class JobTrackerPopup {
  constructor() {
    this.backendUrl = config.backendUrl; // Get from config
    this.currentJobData = null;
    this.spreadsheetId = null;
    this.sheetName = null;

    // Store listener functions as class properties for cleanup
    this.messageListener = this.handleMessage.bind(this);
    this.beforeUnloadListener = this.cleanup.bind(this);

    this.initializeElements();
    this.bindEvents();
    this.initializePopup();
  }

  // Initialize DOM element references
  initializeElements() {
    // Sections
    this.loadingEl = document.getElementById("loading");
    this.authSectionEl = document.getElementById("auth-section");
    this.sheetSectionEl = document.getElementById("sheet-section");
    this.noJobSectionEl = document.getElementById("no-job-section");
    this.jobSectionEl = document.getElementById("job-section");

    // Buttons
    this.signinBtn = document.getElementById("signin-btn");
    this.connectBtn = document.getElementById("connect-btn");
    this.saveBtn = document.getElementById("save-btn");
    this.disconnectBtn = document.getElementById("disconnect-btn");
    this.disconnectBtnNoJob = document.getElementById("disconnect-btn-no-job");
    this.logoutBtn = document.getElementById("logout-btn");

    // Form elements
    this.sheetUrlInput = document.getElementById("sheet-url");
    this.stageSelect = document.getElementById("stage");
    this.prioritySelect = document.getElementById("priority");
    this.notesTextarea = document.getElementById("notes");
    this.jobForm = document.getElementById("job-form");

    // Display elements
    this.companyDisplay = document.getElementById("company-display");
    this.roleDisplay = document.getElementById("role-display");
    this.linkDisplay = document.getElementById("link-display");
    this.sheetNameEl = document.getElementById("sheet-name");
    this.sheetInfoEl = document.getElementById("sheet-info");
    this.sheetNameNoJobEl = document.getElementById("sheet-name-no-job");
    this.sheetInfoNoJobEl = document.getElementById("sheet-info-no-job");

    // Status
    this.statusEl = document.getElementById("status");
  }

  // Bind event listeners
  bindEvents() {
    this.signinBtn.addEventListener("click", () => this.handleSignIn());
    this.connectBtn.addEventListener("click", () => this.handleConnectSheet());
    this.jobForm.addEventListener("submit", (e) => this.handleSaveJob(e));
    this.disconnectBtn.addEventListener("click", () =>
      this.handleDisconnectSheet()
    );
    this.disconnectBtnNoJob.addEventListener("click", () =>
      this.handleDisconnectSheet()
    );
    this.logoutBtn.addEventListener("click", () => this.handleLogout());

    // Listen for messages from content script using stored listener
    chrome.runtime.onMessage.addListener(this.messageListener);

    // Register beforeunload event for cleanup
    window.addEventListener("beforeunload", this.beforeUnloadListener);
  }

  // Handle incoming messages from content script
  handleMessage(message, sender, sendResponse) {
    if (message.action === "jobData") {
      this.handleJobData(message.data);
    }
  }

  // Cleanup method to remove listeners
  cleanup() {
    // Remove chrome runtime message listener
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.removeListener(this.messageListener);
    }

    // Remove beforeunload listener
    window.removeEventListener("beforeunload", this.beforeUnloadListener);

    console.log("JobTrackerPopup cleanup completed");
  }

  // Initialize popup state
  async initializePopup() {
    try {
      // Check for stored job data from background script
      await this.checkForStoredJobData();

      // Check authentication status
      const isAuthenticated = await this.checkAuthStatus();

      if (!isAuthenticated) {
        this.showAuthSection();
        return;
      }

      // Check if we have a saved sheet ID
      const savedSheetId = await this.getSavedSheetId();
      if (savedSheetId) {
        this.spreadsheetId = savedSheetId;
        await this.loadSheetName();

        // Try to get job data from current tab
        await this.getCurrentTabJobData();

        // Show appropriate section based on job data availability
        if (this.currentJobData) {
          this.showJobSection();
        } else {
          this.showNoJobSection();
        }
      } else {
        this.showSheetSection();
      }
    } catch (error) {
      console.error("Popup initialization failed:", error);
      this.showError("Failed to initialize popup");
    }
  }

  // Check for stored job data from background script
  async checkForStoredJobData() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "getStoredJobData" }, resolve);
      });

      if (response && response.success && response.data) {
        this.handleJobData(response.data);
      }
    } catch (error) {
      console.error("Failed to get stored job data:", error);
    }
  }

  // Check authentication status
  async checkAuthStatus() {
    try {
      const response = await fetch(`${this.backendUrl}/api/auth/status`, {
        credentials: "include",
      });
      const data = await response.json();
      return data.authenticated;
    } catch (error) {
      console.error("Auth check failed:", error);
      return false;
    }
  }

  // Handle sign in
  async handleSignIn() {
    try {
      this.signinBtn.disabled = true;
      this.signinBtn.textContent = "Signing in...";

      // Open OAuth popup
      const popup = window.open(
        `${this.backendUrl}/api/auth/login`,
        "oauth_popup",
        "width=500,height=600,scrollbars=yes,resizable=yes"
      );

      // Wait for OAuth completion
      await this.waitForOAuthCompletion(popup);

      // Re-check auth and show appropriate section
      const isAuthenticated = await this.checkAuthStatus();
      if (isAuthenticated) {
        this.showSheetSection();
      } else {
        this.showError("Authentication failed");
      }
    } catch (error) {
      console.error("Sign in failed:", error);
      this.showError("Sign in failed. Please try again.");
    } finally {
      this.signinBtn.disabled = false;
      this.signinBtn.textContent = "Sign in with Google";
    }
  }

  // Wait for OAuth popup to complete
  waitForOAuthCompletion(popup) {
    return new Promise((resolve, reject) => {
      // Listen for messages from the OAuth popup
      const messageListener = (event) => {
        if (event.origin !== this.backendUrl) return;

        if (event.data.type === "OAUTH_SUCCESS") {
          window.removeEventListener("message", messageListener);
          clearInterval(checkClosed);
          resolve();
        } else if (event.data.type === "OAUTH_ERROR") {
          window.removeEventListener("message", messageListener);
          clearInterval(checkClosed);
          reject(new Error(event.data.message || "Authentication failed"));
        }
      };

      window.addEventListener("message", messageListener);

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener("message", messageListener);
          resolve();
        }
      }, 1000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkClosed);
        window.removeEventListener("message", messageListener);
        popup.close();
        reject(new Error("OAuth timeout"));
      }, 300000);
    });
  }

  // Handle sheet connection
  async handleConnectSheet() {
    try {
      const sheetUrl = this.sheetUrlInput.value.trim();
      if (!sheetUrl) {
        this.showError("Please enter a Google Sheet URL");
        return;
      }

      const spreadsheetId = this.extractSpreadsheetId(sheetUrl);
      if (!spreadsheetId) {
        this.showError("Please enter a valid Google Sheet URL");
        return;
      }

      this.connectBtn.disabled = true;
      this.connectBtn.textContent = "Connecting...";

      // Call backend to verify sheet access
      const response = await fetch(`${this.backendUrl}/api/sheets/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to connect to sheet");
      }

      // Save sheet ID and name
      this.spreadsheetId = spreadsheetId;
      this.sheetName = data.sheetName;
      await this.saveSheetId(spreadsheetId);

      this.showSuccess("Successfully connected to Google Sheet");
      this.showJobSection();
    } catch (error) {
      console.error("Sheet connection failed:", error);
      this.showError(error.message || "Failed to connect to sheet");
    } finally {
      this.connectBtn.disabled = false;
      this.connectBtn.textContent = "Connect Sheet";
    }
  }

  // Handle sheet disconnection
  async handleDisconnectSheet() {
    try {
      this.disconnectBtn.disabled = true;
      this.disconnectBtn.textContent = "Disconnecting...";

      // Clear stored sheet ID
      await this.clearSheetId();

      // Reset state
      this.spreadsheetId = null;
      this.sheetName = null;

      // Hide sheet info
      this.sheetInfoEl.classList.add("hidden");

      // Show success message
      this.showSuccess("Successfully disconnected from Google Sheet");

      // Switch to sheet connection section
      this.showSheetSection();
    } catch (error) {
      console.error("Sheet disconnection failed:", error);
      this.showError("Failed to disconnect from sheet");
    } finally {
      this.disconnectBtn.disabled = false;
      this.disconnectBtn.textContent = "Disconnect";
    }
  }

  // Extract spreadsheet ID from URL
  extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  // Get job data from current tab
  async getCurrentTabJobData() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (tab.url && tab.url.includes("linkedin.com/jobs/view/")) {
        // Send message to content script to get job data
        chrome.tabs.sendMessage(
          tab.id,
          { action: "getJobData" },
          (response) => {
            if (response && response.success) {
              this.handleJobData(response.data);
            } else {
              this.showNoJobSection();
            }
          }
        );
      } else {
        // Not a LinkedIn job page
        this.showNoJobSection();
      }
    } catch (error) {
      console.error("Failed to get job data:", error);
      this.showNoJobSection();
    }
  }

  // Handle job data from content script
  handleJobData(jobData) {
    this.currentJobData = jobData;

    // Update display
    this.companyDisplay.textContent = jobData.company || "Not found";
    this.roleDisplay.textContent = jobData.role || "Not found";
    this.linkDisplay.textContent = jobData.applicationLink || "Not found";

    // Show job section if we have a sheet connected
    if (this.spreadsheetId) {
      this.showJobSection();
    }
  }

  // Handle job form submission
  async handleSaveJob(event) {
    event.preventDefault();

    if (!this.currentJobData) {
      this.showError("No job data available");
      return;
    }

    if (!this.spreadsheetId) {
      this.showError("No Google Sheet connected");
      return;
    }

    const stage = this.stageSelect.value;
    const priority = this.prioritySelect.value;
    const notes = this.notesTextarea.value.trim();

    if (!stage || !priority) {
      this.showError("Please select both stage and priority");
      return;
    }

    try {
      this.saveBtn.disabled = true;
      this.saveBtn.textContent = "Saving...";

      const jobData = {
        spreadsheetId: this.spreadsheetId,
        company: this.currentJobData.company,
        role: this.currentJobData.role,
        applicationLink: this.currentJobData.applicationLink,
        stage: stage,
        priority: priority,
        notes: notes,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(`${this.backendUrl}/api/sheets/append`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save job");
      }

      this.showSuccess(`Job saved successfully! (Sno: ${data.sno})`);

      // Reset form
      this.jobForm.reset();
      this.currentJobData = null;
    } catch (error) {
      console.error("Save job failed:", error);
      this.showError(error.message || "Failed to save job");
    } finally {
      this.saveBtn.disabled = false;
      this.saveBtn.textContent = "Save to Google Sheet";
    }
  }

  // Load sheet name from backend
  async loadSheetName() {
    try {
      const response = await fetch(`${this.backendUrl}/api/sheets/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId: this.spreadsheetId }),
        credentials: "include",
      });

      const data = await response.json();
      if (response.ok) {
        this.sheetName = data.sheetName;
        this.sheetNameEl.textContent = this.sheetName;
        this.sheetNameNoJobEl.textContent = this.sheetName;
        this.sheetInfoEl.classList.remove("hidden");
        this.sheetInfoNoJobEl.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Failed to load sheet name:", error);
    }
  }

  // Handle logout
  async handleLogout() {
    try {
      this.logoutBtn.disabled = true;
      this.logoutBtn.textContent = "Logging out...";

      // Call backend logout endpoint
      const response = await fetch(`${this.backendUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        this.showSuccess("Successfully logged out");
        this.showAuthSection();
      } else {
        throw new Error("Logout failed");
      }
    } catch (error) {
      console.error("Logout failed:", error);
      this.showError("Failed to logout. Please try again.");
    } finally {
      this.logoutBtn.disabled = false;
      this.logoutBtn.textContent = "Logout";
    }
  }

  // Chrome storage helpers
  async saveSheetId(sheetId) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ sheetId }, resolve);
    });
  }

  async getSavedSheetId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["sheetId"], (result) => {
        resolve(result.sheetId || null);
      });
    });
  }

  async clearSheetId() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(["sheetId"], resolve);
    });
  }

  // UI state management
  showLoading() {
    this.hideAllSections();
    this.loadingEl.classList.remove("hidden");
  }

  showAuthSection() {
    this.hideAllSections();
    this.authSectionEl.classList.remove("hidden");
  }

  showSheetSection() {
    this.hideAllSections();
    this.sheetSectionEl.classList.remove("hidden");
  }

  showNoJobSection() {
    this.hideAllSections();
    this.noJobSectionEl.classList.remove("hidden");
  }

  showJobSection() {
    this.hideAllSections();
    this.jobSectionEl.classList.remove("hidden");
  }

  hideAllSections() {
    this.loadingEl.classList.add("hidden");
    this.authSectionEl.classList.add("hidden");
    this.sheetSectionEl.classList.add("hidden");
    this.noJobSectionEl.classList.add("hidden");
    this.jobSectionEl.classList.add("hidden");
  }

  // Status message helpers
  showSuccess(message) {
    this.showStatus(message, "success");
  }

  showError(message) {
    this.showStatus(message, "error");
  }

  showInfo(message) {
    this.showStatus(message, "info");
  }

  showStatus(message, type) {
    this.statusEl.textContent = message;
    this.statusEl.className = `status ${type}`;
    this.statusEl.classList.remove("hidden");

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.statusEl.classList.add("hidden");
    }, 5000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new JobTrackerPopup();
});
