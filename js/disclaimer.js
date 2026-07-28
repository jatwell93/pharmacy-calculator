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
    <div class="disclaimer p-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-sm leading-relaxed">
      <div class="flex items-start gap-3 mb-4">
        <span class="text-brand-amber font-bold text-lg">⚠️</span>
        <p>
          <strong class="text-brand-navy font-bold">Professional Assurance Disclaimer:</strong> This calculator provides mathematical estimates only and does not constitute financial, professional, or regulatory advice. All projections are based on assumed revenue rates from 8CPA guidelines and may not reflect your specific pharmacy performance.
        </p>
      </div>
      <p class="mb-4">
        Actual results vary based on local market conditions, patient demand, and clinical implementation quality. We strongly recommend consulting official 8CPA documentation and your professional business advisors before executing operational changes.
      </p>
      <div class="pt-4 border-t border-slate-200">
        <p class="font-medium text-slate-600 italic">
          <span class="text-brand-teal not-italic font-bold">Data Privacy:</span> No pharmacy data is stored or retained. Your inputs are processed in-memory to generate analysis and are never saved to a database.
        </p>
      </div>
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
