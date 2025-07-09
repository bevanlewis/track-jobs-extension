// Configuration for the Job Tracker Chrome Extension

const config = {
  // Backend URL - change this when deploying to production
  // For development: http://localhost:3000
  // For production: https://your-domain.com
  backendUrl: "http://localhost:3000",

  // API endpoints (relative to backendUrl)
  api: {
    auth: {
      login: "/api/auth/login",
      status: "/api/auth/status",
    },
    sheets: {
      append: "/api/sheets/append",
      metadata: "/api/sheets/metadata",
    },
  },

  // Auth pages (relative to backendUrl)
  pages: {
    authSuccess: "/auth-success",
    authError: "/auth-error",
  },
};

export default config;
