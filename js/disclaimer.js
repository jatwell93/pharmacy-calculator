/**
 * Disclaimer Module for Pharmacy Calculator
 * Provides a standardized disclaimer component for UI rendering.
 */

/**
 * Renders the disclaimer text as an HTML string for injection into the DOM.
 * Suitable for display in footers, modals, or sidebars.
 * @returns {string} HTML string containing the disclaimer.
 */
function renderDisclaimer() {
  const disclaimerHTML = `
    <div class="disclaimer" style="padding: 10px; border: 1px solid #ccc; background-color: #f9f9f9; font-size: 0.9em; line-height: 1.4;">
      <p>
        <strong>Important Disclaimer:</strong> This calculator provides estimates only and is not financial or professional advice. All projections are based on assumed revenue rates from CPA guidelines and may not reflect actual pharmacy performance. Actual results can vary due to market conditions, competition, patient demand, and implementation quality. Consult CPA guidelines, your business advisor, and legal professionals before implementing any changes. This tool is for informational purposes only and does not guarantee outcomes.
      </p>
      <br>
      <p>
        <u>No pharmacy data is stored or retained by this calculator.</u> Your inputs are converted to a JSON format and sent to a large language model (LLM) via OpenRouter to generate analysis, which is immediately returned and displayed to you. Neither your data nor prompts are saved or recorded by this tool or by OpenRouter.
      </p>
    </div>
  `;
  return disclaimerHTML;
}

/**
 * Appends the disclaimer to a specified DOM element.
 * @param {string} selector - CSS selector for the target element (e.g., '#footer').
 */
function appendDisclaimerTo(selector) {
  const targetElement = document.querySelector(selector);
  if (targetElement) {
    targetElement.insertAdjacentHTML("beforeend", renderDisclaimer());
  } else {
    console.warn(`Disclaimer: Target element '${selector}' not found.`);
  }
}

/**
 * React Component version (if using React).
 * Uncomment and adapt if your project uses React.
 */
/*
import React from 'react';

export const Disclaimer = () => (
  <div className="disclaimer" style={{ padding: '10px', border: '1px solid #ccc', backgroundColor: '#f9f9f9', fontSize: '0.9em', lineHeight: '1.4' }}>
    <strong>Important Disclaimer:</strong> This calculator provides estimates only and is not financial or professional advice. All projections are based on assumed revenue rates from CPA guidelines and may not reflect actual pharmacy performance. Actual results can vary due to market conditions, competition, patient demand, and implementation quality. Consult CPA guidelines, your business advisor, and legal professionals before implementing any changes. This tool is for informational purposes only and does not guarantee outcomes.
  </div>
);
*/

// Export for ES modules
export { renderDisclaimer, appendDisclaimerTo };
