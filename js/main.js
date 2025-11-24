// Main Application Entry Point
// This file initializes the application and sets up global functions

import {
  generateTables,
  setupEventListeners,
  downloadPlan,
  displayProvenance,
  copyDebugInfo,
} from "./ui.js";
import { calculateAll } from "./calculations.js";
import {
  testWithSampleData,
  testWithRealData,
  previewPlan,
  closePreview,
  proceedWithGeneration,
  copyPayloadForChatGPT,
  generatePlan,
} from "./aiIntegration.js";
import {
  downloadPlanHTML,
  downloadPlanPDF,
  downloadPlanCSV,
} from "./downloadPlan.js";
import { appendDisclaimerTo } from "./disclaimer.js";
import { initializeAnonymousAuth } from "./firebaseInit.js";

/**
 * Initialize the application when DOM is ready
 */
async function initializeApp() {
  console.log("Initializing Pharmacy Calculator...");

  // Initialize Firebase authentication first (non-blocking - errors are caught)
  try {
    await initializeAnonymousAuth();
    console.log("✓ Firebase authentication initialized");
  } catch (error) {
    console.warn(
      "⚠ Firebase authentication failed, some features may not work:",
      error.message
    );
    // Continue with app initialization even if Firebase fails
  }

  // Generate all service tables
  generateTables();

  // Display provenance information
  displayProvenance();

  // Render disclaimer
  appendDisclaimerTo("#disclaimer");

  // Perform initial calculations
  calculateAll();

  // Setup event listeners for input changes
  setupEventListeners();

  console.log("Pharmacy Calculator initialized successfully!");
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeApp);

// Expose functions to global scope for inline event handlers
window.testWithSampleData = testWithSampleData;
window.testWithRealData = testWithRealData;
window.previewPlan = previewPlan;
window.closePreview = closePreview;
window.proceedWithGeneration = proceedWithGeneration;
window.copyPayloadForChatGPT = copyPayloadForChatGPT;
window.generatePlan = generatePlan;
window.downloadPlan = downloadPlan;
window.downloadPlanHTML = downloadPlanHTML;
window.downloadPlanPDF = downloadPlanPDF;
window.downloadPlanCSV = downloadPlanCSV;
window.copyDebugInfo = copyDebugInfo;
