// Network & Connectivity
// Offline detection banner and resilient fetch wrapper with retry logic

const OFFLINE_BANNER_ID = "network-status-banner";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

/**
 * Create the offline/online status banner element
 */
function createBanner(isOnline) {
  const banner = document.createElement("div");
  banner.id = OFFLINE_BANNER_ID;
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");

  if (isOnline) {
    banner.className =
      "fixed top-0 left-0 right-0 z-50 bg-green-600 text-white text-center py-2 text-sm font-medium shadow-md transition-all duration-300";
    banner.innerHTML =
      '<span class="inline-block mr-1">✓</span> Connection restored';
  } else {
    banner.className =
      "fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center py-2 text-sm font-medium shadow-md transition-all duration-300";
    banner.innerHTML =
      '<span class="inline-block mr-1">⚠</span> You are offline — AI features and cloud services are unavailable';
  }

  return banner;
}

/**
 * Show connectivity status banner
 */
function showStatusBanner(isOnline) {
  const existing = document.getElementById(OFFLINE_BANNER_ID);
  if (existing) existing.remove();

  const banner = createBanner(isOnline);
  document.body.prepend(banner);

  // Auto-dismiss after 5 seconds for "online" restoration
  if (isOnline) {
    setTimeout(() => banner.remove(), 5000);
  }
}

/**
 * Check current online status and update UI accordingly
 * @returns {boolean}
 */
export function checkOnlineStatus() {
  const isOnline = navigator.onLine;
  if (!isOnline) {
    showStatusBanner(false);
    // Disable AI-related buttons when offline
    const aiButtons = document.querySelectorAll(
      '[data-ai-button], #generate-plan-btn, #test-ai-btn',
    );
    aiButtons.forEach((btn) => {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.classList.add("opacity-50", "cursor-not-allowed");
    });
  } else {
    const aiButtons = document.querySelectorAll(
      '[data-ai-button], #generate-plan-btn, #test-ai-btn',
    );
    aiButtons.forEach((btn) => {
      btn.disabled = false;
      btn.removeAttribute("aria-disabled");
      btn.classList.remove("opacity-50", "cursor-not-allowed");
    });
  }
  return isOnline;
}

/**
 * Setup online/offline event listeners
 */
export function setupNetworkListeners() {
  window.addEventListener("online", () => {
    showStatusBanner(true);
    checkOnlineStatus();
    console.log("[Network] Connection restored");
  });

  window.addEventListener("offline", () => {
    showStatusBanner(false);
    checkOnlineStatus();
    console.log("[Network] Connection lost");
  });

  // Initial check on load
  checkOnlineStatus();
}

/**
 * Resilient fetch wrapper with automatic retry on network failures
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts (default: 2)
 * @returns {Promise<Response>}
 */
export async function resilientFetch(url, options = {}, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check offline status before attempting
      if (!navigator.onLine) {
        throw new Error(
          "No internet connection. Please check your network and try again.",
        );
      }

      const response = await fetch(url, options);

      // If server error (5xx), retry
      if (response.status >= 500 && attempt < maxRetries) {
        lastError = new Error(
          `Server error (${response.status}), retrying...`,
        );
        console.warn(
          `[Network] ${lastError.message} (attempt ${attempt + 1}/${maxRetries + 1})`,
        );
        await delay(RETRY_DELAY_MS);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx) or abort
      if (error.name === "AbortError") {
        throw error;
      }

      if (attempt < maxRetries) {
        console.warn(
          `[Network] ${error.message} (attempt ${attempt + 1}/${maxRetries + 1})`,
        );
        await delay(RETRY_DELAY_MS);
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error("Network request failed after retries");
}

/**
 * Simple delay helper
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Show inline retry UI for failed network requests
 * @param {HTMLElement} container - Element to append retry UI to
 * @param {string} message - Error message
 * @param {Function} onRetry - Callback when retry button is clicked
 */
export function showRetryUI(container, message, onRetry) {
  if (!container) return;

  const isOnline = navigator.onLine;

  container.innerHTML = `
    <div class="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center">
      <div class="text-amber-600 text-4xl mb-3">${isOnline ? "⚠️" : "📡"}</div>
      <p class="text-amber-800 font-medium mb-1">${isOnline ? message : "You are currently offline"}</p>
      <p class="text-amber-600 text-sm mb-4">${isOnline ? "A temporary network issue occurred." : "Check your connection and try again."}</p>
      <button
        class="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
        data-retry-btn
      >
        ${isOnline ? "Try Again" : "Check Connection"}
      </button>
    </div>
  `;

  const retryBtn = container.querySelector("[data-retry-btn]");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      container.innerHTML = `
        <div class="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center">
          <div class="animate-spin inline-block w-6 h-6 border-2 border-brand-teal border-t-transparent rounded-full"></div>
          <p class="text-slate-600 text-sm mt-2">Retrying...</p>
        </div>
      `;
      onRetry();
    });
  }
}
