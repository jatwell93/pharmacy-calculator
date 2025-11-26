// Debug log to confirm main.js execution
console.log("DEBUG: main.js loaded successfully");

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
 * Initialize accordion functionality for parts
 */
function initializePartsAccordion() {
  const buttons = document.querySelectorAll('[data-accordion-target]');
  
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetSelector = this.getAttribute('data-accordion-target');
      const targetElement = document.querySelector(targetSelector);
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      
      if (targetElement) {
        // Toggle the target element
        if (isExpanded) {
          targetElement.classList.add('hidden');
          this.setAttribute('aria-expanded', 'false');
        } else {
          targetElement.classList.remove('hidden');
          this.setAttribute('aria-expanded', 'true');
        }
        
        // Rotate the icon
        const icon = this.querySelector('[data-accordion-icon]');
        if (icon) {
          if (isExpanded) {
            icon.style.transform = 'rotate(0deg)';
          } else {
            icon.style.transform = 'rotate(180deg)';
          }
        }
      }
    });
  });
}

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

  // Initialize accordion functionality
  initializePartsAccordion();

  // Initialize Flowbite components (accordions)
  if (typeof window.Flowbite !== "undefined" && window.Flowbite.init) {
    window.Flowbite.init();
  }

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
