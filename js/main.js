// Main Application Entry Point
// This file initializes the application and sets up global functions

import { generateTables, setupEventListeners, downloadPlan } from "./ui.js";
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

/**
 * Initialize the application when DOM is ready
 */
function initializeApp() {
  console.log("Initializing Pharmacy Calculator...");

  // Generate all service tables
  generateTables();

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
