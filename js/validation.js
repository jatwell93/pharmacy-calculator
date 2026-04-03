// Input Validation Module for Pharmacy Calculator
// Validates and sanitizes all user inputs before processing

/**
 * Validate and sanitize a numeric input value
 * @param {any} value - Raw input value
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum allowed value (default: 0)
 * @param {number} options.max - Maximum allowed value (default: 1000000)
 * @param {boolean} options.allowZero - Allow zero values (default: true)
 * @param {boolean} options.allowNegative - Allow negative values (default: false)
 * @returns {number} Validated and clamped numeric value
 */
export function validateNumericInput(value, options = {}) {
  const {
    min = 0,
    max = 1000000,
    allowZero = true,
    allowNegative = false,
  } = options;

  // Convert to number
  let num = parseFloat(value);

  // Handle NaN
  if (isNaN(num)) {
    return 0;
  }

  // Handle Infinity
  if (!isFinite(num)) {
    return max;
  }

  // Handle negative values
  if (!allowNegative && num < 0) {
    return 0;
  }

  // Handle zero
  if (!allowZero && num === 0) {
    return min > 0 ? min : 0.01;
  }

  // Clamp to valid range
  return Math.max(min, Math.min(max, num));
}

/**
 * Validate a percentage value (0-100)
 * @param {any} value - Raw input value
 * @returns {number} Validated percentage
 */
export function validatePercentage(value) {
  return validateNumericInput(value, {
    min: 0,
    max: 100,
    allowZero: true,
    allowNegative: false,
  });
}

/**
 * Validate a volume/patient count input
 * @param {any} value - Raw input value
 * @returns {number} Validated volume
 */
export function validateVolume(value) {
  return validateNumericInput(value, {
    min: 0,
    max: 100000,
    allowZero: true,
    allowNegative: false,
  });
}

/**
 * Validate a currency amount
 * @param {any} value - Raw input value
 * @returns {number} Validated currency amount
 */
export function validateCurrencyAmount(value) {
  return validateNumericInput(value, {
    min: 0,
    max: 1000000,
    allowZero: true,
    allowNegative: false,
  });
}

/**
 * Sanitize a string to prevent XSS
 * @param {string} str - Raw string input
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
  if (typeof str !== "string") {
    return String(str);
  }
  return str
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validate an investment preference value
 * @param {any} value - Raw input value
 * @returns {number} Validated investment amount
 */
export function validateInvestment(value) {
  return validateNumericInput(value, {
    min: 0,
    max: 10000000,
    allowZero: true,
    allowNegative: false,
  });
}

/**
 * Validate a time horizon value (in months)
 * @param {any} value - Raw input value
 * @returns {number} Validated time horizon
 */
export function validateTimeHorizon(value) {
  return validateNumericInput(value, {
    min: 1,
    max: 60,
    allowZero: false,
    allowNegative: false,
  });
}

/**
 * Check if an input element has valid value
 * @param {HTMLInputElement} input - Input element to validate
 * @returns {boolean} True if valid
 */
export function isInputValid(input) {
  if (!input || !input.value) return true; // Empty is valid (will default to 0)

  const value = parseFloat(input.value);
  return !isNaN(value) && isFinite(value);
}

/**
 * Add validation event listeners to all calc-input elements
 * Prevents invalid values from being entered
 */
export function setupInputValidation() {
  // Use event delegation for better performance
  document.addEventListener("input", (e) => {
    if (!e.target.classList.contains("calc-input")) return;

    const input = e.target;
    const value = input.value;

    // Allow empty string (user is still typing)
    if (value === "" || value === "-") return;

    // Check for obviously invalid patterns
    if (value.includes("e") || value.includes("E")) {
      // Scientific notation could lead to huge numbers
      const num = parseFloat(value);
      if (isFinite(num) && Math.abs(num) <= 1000000) return;
      input.value = Math.min(Math.max(0, num), 1000000);
      return;
    }

    // Check for multiple decimal points
    if ((value.match(/\./g) || []).length > 1) {
      input.value = value.slice(0, -1);
      return;
    }
  });

  // Validate on blur
  document.addEventListener("blur", (e) => {
    if (!e.target.classList.contains("calc-input")) return;

    const input = e.target;
    const value = input.value;

    // Don't validate empty values (they default to 0)
    if (value === "" || value === "-") return;

    const num = parseFloat(value);

    // Reset NaN values to 0
    if (isNaN(num) || !isFinite(num)) {
      input.value = 0;
      input.classList.add("border-red-400");
      setTimeout(() => input.classList.remove("border-red-400"), 2000);
    }
  }, true); // Use capture phase
}
