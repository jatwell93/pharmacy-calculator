// AI Integration Functions
// This file contains all AI-related functionality for generating action plans

import { collectCurrentAnalysisData, generatePayload } from "./calculations.js";
import { displayPlan, showLoading, hideLoading } from "./ui.js";

/**
 * Check if environment variables are properly loaded
 */
function checkEnvironmentVariables() {
  const envVars = {
    FIREBASE_API_KEY: window.FIREBASE_API_KEY || window.ENV_CONFIG?.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: window.FIREBASE_AUTH_DOMAIN || window.ENV_CONFIG?.FIREBASE_AUTH_DOMAIN,
    FIREBASE_DATABASE_URL: window.FIREBASE_DATABASE_URL || window.ENV_CONFIG?.FIREBASE_DATABASE_URL,
    FIREBASE_PROJECT_ID: window.FIREBASE_PROJECT_ID || window.ENV_CONFIG?.FIREBASE_PROJECT_ID,
    OPENROUTER_API_KEY: window.ENV_CONFIG?.OPENROUTER_API_KEY
  };
  
  console.log('🔍 Environment Variable Check:', envVars);
  
  const missingVars = [];
  const hasFirebaseConfig = Object.entries(envVars)
    .filter(([key]) => key.startsWith('FIREBASE'))
    .every(([_, value]) => !!value);
    
  const hasOpenRouterKey = !!envVars.OPENROUTER_API_KEY;
  
  if (!hasFirebaseConfig) {
    missingVars.push('Firebase Configuration');
  }
  if (!hasOpenRouterKey) {
    missingVars.push('OpenRouter API Key');
  }
  
  return {
    hasFirebaseConfig,
    hasOpenRouterKey,
    missingVars,
    envVars
  };
}

/**
 * Test AI with sample data
 */
export async function testWithSampleData() {
  console.log("Testing AI with sample data...");

  // Check environment variables first
  const envCheck = checkEnvironmentVariables();
  if (envCheck.missingVars.length > 0) {
    console.warn("⚠️ Missing environment variables:", envCheck.missingVars);
    alert(`❌ Missing Configuration: ${envCheck.missingVars.join(' and ')} are not properly configured.\n\nPlease check that environment variables are set correctly in your Netlify dashboard.`);
    return;
  }

  try {
    // Create sample structured payload matching the new format
    const samplePayload = {
      metadata: {
        calculatorVersion: "1.2.3",
        generatedAt: new Date().toISOString(),
        currency: "AUD",
        timeUnit: "month",
        // Indicate revenue-only financial mode for clarity to the AI
        financial_mode: "revenue_only",
      },
      // Summary metrics: Aggregated figures for the selected top drivers only. Monthly values are computed as (annual delta / 12); estimatedAnnualDelta = monthlyRevenueDelta * 12. In revenue_only mode, ignore any cost fields.
      summaryMetrics: {
        currentMonthlyRevenue: 8000,
        projectedMonthlyRevenue: 15000,
        selectedMonthlyRevenueDelta: 7000, // Monthly revenue lift from top-6 selected drivers only; annual = this * 12
        estimatedAnnualDelta: 84000, // Not used in revenue_only mode; included for completeness
        // In revenue_only mode, include the total investment rather than per-service cost aggregates
        totalInvestment: 100000,
      },
      topDrivers: [
        {
          id: "daa-eligible",
          name: "DAA - eligible",
          currentValue: 25487,
          targetValue: 64911,
          unit: "patients/month",
          monthlyRevenueImpact: 3287, // Monthly gross revenue lift from this service (annual = this * 12)
          assumptions: "avg revenue per pack $40",
        },
        {
          id: "vaccinations",
          name: "COVID-19 Vaccinations",
          currentValue: 3809,
          targetValue: 5012,
          unit: "vaccines/month",
          monthlyRevenueImpact: 101, // Monthly gross revenue lift from this service (annual = this * 12)
          assumptions: "avg revenue per vaccine $35",
        },
      ],
      otherItemsSummary: {
        count: 48,
        combinedMonthlyImpact: 2900,
        combinedOneTimeCost: null,
        combinedRecurringAnnualCost: null,
        note: "See downloadable CSV for full list",
      },
      userPreferences: {
        maxInvestment: 100000,
        timeHorizonMonths: 6,
        preferredDepth: "high-level",
      },
    };

    let response;
    // Try the non-background endpoint first so deployed environments that support immediate responses
    // can return the plan directly. If that fails (404 or empty body), fall back to the background endpoint.
    try {
      response = await fetch("/.netlify/functions/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          structuredPayload: samplePayload,
        }),
      });

      // If the endpoint isn't present (404) or returns an empty body, fall back
      const contentLength = response.headers.get("content-length");
      if (
        response.status === 404 ||
        (response.status === 200 && contentLength === "0")
      ) {
        response = await fetch("/.netlify/functions/generate-plan-background", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            structuredPayload: samplePayload,
          }),
        });
      }
    } catch (err) {
      // Network error or other failure — try background endpoint as a fallback
      response = await fetch("/.netlify/functions/generate-plan-background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          structuredPayload: samplePayload,
        }),
      });
    }

    // Handle background function response (202 Accepted) or immediate 200 with jobId/plan
    if (response.status === 202 || response.status === 200) {
      // Try to parse JSON body if present
      let result = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          result = await response.json();
        } catch (e) {
          throw new Error(
            "Failed to parse JSON from background function response",
          );
        }
      } else {
        // Fallback: try to read text and parse JSON (some dev setups strip headers/content-type)
        const text = await response.text();
        if (text && text.trim()) {
          try {
            result = JSON.parse(text);
          } catch (e) {
            // ignore - will be handled below
          }
        }
      }

      if (result && result.success && result.jobId) {
        console.log("Job started with ID:", result.jobId);
        await pollForPlan(result.jobId);
        return;
      }

      // If the function returned the full plan immediately (200), display it
      if (response.status === 200 && result && result.success && result.plan) {
        console.log("Background function returned full plan:", result.plan);
        displayPlan(result.plan);
        return;
      }

      throw new Error(
        "Invalid response from background function: missing jobId or plan",
      );
    }

    const result = await response.json();
    console.log("AI Response with sample data:", result);

    if (result.success) {
      alert("🎉 AI is working with sample data! Check console for full plan.");
      displayPlan(result.plan);
    } else {
      alert("❌ AI Error: " + result.error);
      if (result.fallbackPlan) {
        alert("But we have a fallback plan! Check console.");
        console.log("Fallback plan:", result.fallbackPlan);
      }
    }
  } catch (error) {
    console.error("Sample data test failed:", error);
    alert("❌ Connection failed: " + error.message);
  }
}

/**
 * Test AI with real calculator data
 */
export async function testWithRealData() {
  console.log("Testing AI with real calculator data...");

  // Check environment variables first
  const envCheck = checkEnvironmentVariables();
  if (envCheck.missingVars.length > 0) {
    console.warn("⚠️ Missing environment variables:", envCheck.missingVars);
    alert(`❌ Missing Configuration: ${envCheck.missingVars.join(' and ')} are not properly configured.\n\nPlease check that environment variables are set correctly in your Netlify dashboard.`);
    return;
  }

  showLoading();

  try {
    const structuredPayload = generatePayload({
      maxInvestment: 150000,
      timeHorizonMonths: 12,
      preferredDepth: "detailed",
    });

    if (!structuredPayload) {
      alert(
        'No growth opportunities found. Please increase some "Potential Volume" numbers in the calculator first!',
      );
      hideLoading();
      return;
    }

    console.log("Sending structured payload to AI:", structuredPayload);

    let response;
    // Prefer the non-background endpoint where available; fall back to the background endpoint for Netlify Dev or proxies.
    try {
      response = await fetch("/.netlify/functions/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          structuredPayload,
        }),
      });

      // Fall back if not found or body missing
      const contentLength = response.headers.get("content-length");
      if (
        response.status === 404 ||
        (response.status === 200 && contentLength === "0")
      ) {
        response = await fetch("/.netlify/functions/generate-plan-background", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            structuredPayload,
          }),
        });
      }
    } catch (err) {
      // If the first call fails (network/proxy issues), attempt the background endpoint
      response = await fetch("/.netlify/functions/generate-plan-background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysisData: realData,
          userPreferences: {
            timelineMonths: 6,
            focusAreas: ["High ROI services"],
            riskTolerance: "medium",
          },
        }),
      });
    }

    console.log("Response status:", response.status);
    console.log("Response headers:", response.headers);

    // Handle background function response (202 Accepted) or immediate 200 with jobId/plan
    if (response.status === 202 || response.status === 200) {
      // Try to parse JSON body if present
      let result = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          result = await response.json();
        } catch (e) {
          throw new Error(
            "Failed to parse JSON from background function response",
          );
        }
      } else {
        // Fallback: try to read text and parse JSON (some dev setups strip headers/content-type)
        const text = await response.text();
        if (text && text.trim()) {
          try {
            result = JSON.parse(text);
          } catch (e) {
            // ignore - will be handled below
          }
        }
      }

      if (result && result.success && result.jobId) {
        console.log("Job started with ID:", result.jobId);
        await pollForPlan(result.jobId);
        return;
      }

      // If the function returned the full plan immediately (200), display it
      if (response.status === 200 && result && result.success && result.plan) {
        console.log("Background function returned full plan:", result.plan);
        displayPlan(result.plan);
        return;
      }

      throw new Error(
        "Invalid response from background function: missing jobId or plan",
      );
    }

    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      console.error("Response not OK. Status:", response.status);
      console.error("Content-Type:", contentType);

      // Try to get the response as text first to see what we're dealing with
      const responseText = await response.text();
      console.error("Response text:", responseText);

      // Check if it's HTML (common when endpoint not found)
      if (contentType && contentType.includes("text/html")) {
        throw new Error(
          `Server returned HTML instead of JSON. This usually means the API endpoint is not found. Are you running with Netlify Dev? Status: ${response.status}`,
        );
      }

      // Try to parse as JSON if possible
      try {
        const errorData = JSON.parse(responseText);
        throw new Error(
          `API Error (${response.status}): ${errorData.error || "Unknown error"}`,
        );
      } catch (parseError) {
        // If not JSON, throw the raw text
        throw new Error(
          `API Error (${response.status}): ${responseText.substring(0, 200)}`,
        );
      }
    }

    // Check content type before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const responseText = await response.text();
      console.error("Unexpected content type:", contentType);
      console.error("Response text:", responseText);
      throw new Error(
        `Expected JSON but got ${contentType}. Response: ${responseText.substring(0, 200)}`,
      );
    }

    // Now try to parse JSON
    let result;
    const responseText = await response.text();
    console.log("Raw response text:", responseText);

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError);
      console.error("Response that failed to parse:", responseText);
      throw new Error(
        `Invalid JSON received from server: ${parseError.message}. Check console for details.`,
      );
    }

    console.log("Parsed AI Response:", result);

    if (result.success) {
      displayPlan(result.plan);
    } else {
      // Check if this is a temporary service issue
      if (result.isTemporary && result.fallbackPlan) {
        console.log(
          "AI service temporarily unavailable, using fallback plan:",
          result.fallbackPlan,
        );

        // Show a more user-friendly message for temporary issues
        const fallbackMessage = document.createElement("div");
        fallbackMessage.className = "alert alert-warning mb-3";
        fallbackMessage.innerHTML = `
          <strong>⚠️ AI Service Temporarily Unavailable</strong><br>
          The AI service is experiencing temporary issues. We're showing you a standard growth plan instead.<br>
          <small>You can try again in a few minutes for a customized plan based on your specific data.</small>
        `;

        // Insert the message before the plan display
        const planContainer = document.getElementById("plan-result");
        if (planContainer) {
          planContainer.insertBefore(fallbackMessage, planContainer.firstChild);
        }

        displayPlan(result.fallbackPlan);
      } else {
        // For other errors, show the error and still try to display fallback if available
        alert("❌ AI Error: " + result.error);
        if (result.fallbackPlan) {
          console.log("Using fallback plan due to error:", result.fallbackPlan);
          displayPlan(result.fallbackPlan);
        }
      }
    }
  } catch (error) {
    console.error("Real AI test failed:", error);
    // Don't show duplicate alerts for API errors that are already handled above
    if (!error.message.includes("API Error")) {
      alert(
        "❌ Error: " +
          error.message +
          "\n\nPlease check the console for more details.",
      );
    }
  } finally {
    hideLoading();
  }
}

/**
 * Poll for plan status
 * @param {string} jobId
 */
async function pollForPlan(jobId) {
  const maxPolls = 30; // Max 2.5 minutes (5s * 30)
  let pollCount = 0;
  let hasResolved = false;

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      // Prevent multiple resolutions
      if (hasResolved) {
        clearInterval(interval);
        return;
      }

      pollCount++;
      try {
        const statusResponse = await fetch(`/.netlify/functions/check-plan-status/${jobId}`);
        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`);
        }
        const statusData = await statusResponse.json();

        console.log("🔍 POLL DEBUG: Poll #" + pollCount + ", Status:", statusData.status, "Keys:", Object.keys(statusData));

        if (statusData.status === "complete") {
          clearInterval(interval);
          hasResolved = true;

          // Validate and correct the plan
          const validation = validateAndCorrectPlan(
            statusData.plan,
            window.currentPayload,
          );

          // Merge validation results into plan
          statusData.plan.validation =
            validation.issues.length > 0
              ? validation.issues
              : ["No validation issues found"];
          statusData.plan.notes =
            (statusData.plan.notes || "") +
            (validation.issues.length > 0
              ? "\n\nValidation corrections applied."
              : "");

          displayPlan(statusData.plan);
          hideLoading();
          resolve();
        } else if (statusData.status === "error") {
          clearInterval(interval);
          hasResolved = true;
          hideLoading();
          alert("❌ Plan generation failed: " + statusData.error);
          resolve();
        } else if (statusData.status === "pending") {
          console.log("Plan still generating, will check again in 5 seconds...");
          // Continue polling
        } else if (pollCount >= maxPolls) {
          clearInterval(interval);
          hasResolved = true;
          hideLoading();
          alert("❌ Polling timeout - plan took too long");
          resolve();
        }
      } catch (error) {
        console.error("Polling error:", error);
        // Check for 404 specifically - endpoint may not exist in this environment
        if (error.message.includes("404")) {
          clearInterval(interval);
          hasResolved = true;
          hideLoading();
          alert("❌ Status endpoint not found. The plan generation may still be running. Please check back in a moment.");
          resolve();
        } else if (pollCount >= maxPolls) {
          clearInterval(interval);
          hasResolved = true;
          hideLoading();
          alert("❌ Polling failed after " + pollCount + " attempts: " + error.message);
          resolve();
        }
        // For other transient errors, continue polling
      }
    }, 5000); // Poll every 5 seconds
  });
}

/**
 * Validate plan consistency and recalculate values
 * @param {Object} plan - The AI-generated plan object
 * @param {Object} originalPayload - The original structured payload
 * @returns {Object} Validation results with issues and corrections
 */
function validateAndCorrectPlan(plan, originalPayload) {
  const issues = [];
  const corrections = {};

  try {
    // Check if plan has required structure
    if (!plan.plan || !Array.isArray(plan.plan)) {
      issues.push("Plan structure is invalid - missing initiatives array");
      return { issues, corrections };
    }

    // Validate totalInvestment against user input
    const userInputInvestment =
      (originalPayload.userInputs &&
        originalPayload.userInputs.totalInvestment) ||
      (originalPayload.userPreferences &&
        originalPayload.userPreferences.maxInvestment);
    if (userInputInvestment && typeof userInputInvestment === "number") {
      const payloadInvestment =
        originalPayload.summaryMetrics.totalInvestment || 0;
      if (payloadInvestment > 0) {
        const diffPercentage =
          Math.abs(payloadInvestment - userInputInvestment) /
          userInputInvestment;
        if (diffPercentage > 0.01) {
          // 1% threshold
          issues.push(
            `Total investment validation: Payload has ${payloadInvestment.toLocaleString()}, user input ${userInputInvestment.toLocaleString()} (${(diffPercentage * 100).toFixed(2)}% difference). Check for scaling bugs.`,
          );
          corrections.totalInvestment = userInputInvestment; // Suggest correction
        }
      }
    }

    // Verify financial totals
    let totalOneTime = 0;
    let totalRecurring = 0;
    let totalMonthlyLift = 0;

    plan.plan.forEach((initiative) => {
      totalOneTime += initiative.one_time_cost || 0;
      totalRecurring += initiative.recurring_annual_cost || 0;
      totalMonthlyLift += initiative.expected_monthly_revenue_lift || 0;
    });

    // Compare with expected totals from payload
    // Respect financial_mode (e.g., "revenue_only") from the original payload. In revenue_only mode skip per-service cost checks.
    const financialMode =
      originalPayload.metadata && originalPayload.metadata.financial_mode;
    const expectedSelectedMonthlyDelta =
      originalPayload.summaryMetrics.selectedMonthlyRevenueDelta || 0; // Revenue lift from selected top drivers only

    if (financialMode === "revenue_only") {
      // In revenue_only mode, validate revenue totals only (skip one-time / recurring per-service checks)
      if (Math.abs(totalMonthlyLift - expectedSelectedMonthlyDelta) > 500) {
        issues.push(
          `Total monthly revenue lift mismatch: calculated ${totalMonthlyLift.toLocaleString()}, expected ${expectedSelectedMonthlyDelta.toLocaleString()}`,
        );
      }
    } else {
      const expectedOneTime =
        originalPayload.summaryMetrics.totalOneTimeCost || 0;
      const expectedRecurring =
        originalPayload.summaryMetrics.totalRecurringCostAnnual || 0;

      if (Math.abs(totalOneTime - expectedOneTime) > 1000) {
        issues.push(
          `Total one-time cost mismatch: calculated ${totalOneTime.toLocaleString()}, expected ${expectedOneTime.toLocaleString()}`,
        );
      }

      if (Math.abs(totalRecurring - expectedRecurring) > 1000) {
        issues.push(
          `Total recurring cost mismatch: calculated ${totalRecurring.toLocaleString()}, expected ${expectedRecurring.toLocaleString()}`,
        );
      }

      if (Math.abs(totalMonthlyLift - expectedSelectedMonthlyDelta) > 500) {
        issues.push(
          `Total monthly revenue lift mismatch: calculated ${totalMonthlyLift.toLocaleString()}, expected ${expectedSelectedMonthlyDelta.toLocaleString()}`,
        );
      }
    }

    // Check ROI calculations
    // If payload is in revenue-only mode, skip per-initiative cost/ROI checks since per-service costs are not authoritative.
    // Instead, validate revenue lifts and basic non-negativity for costs if present.
    if (financialMode === "revenue_only") {
      // Validate revenue lifts are sensible and non-negative
      plan.plan.forEach((initiative) => {
        if (
          typeof initiative.expected_monthly_revenue_lift !== "number" ||
          initiative.expected_monthly_revenue_lift < 0
        ) {
          issues.push(
            `Invalid expected_monthly_revenue_lift for ${initiative.title}`,
          );
        }
        // If per-initiative cost fields are present unexpectedly, warn but do not treat them as authoritative
        if (
          (typeof initiative.one_time_cost !== "undefined" &&
            initiative.one_time_cost !== null) ||
          (typeof initiative.recurring_annual_cost !== "undefined" &&
            initiative.recurring_annual_cost !== null)
        ) {
          issues.push(
            `Note: Per-initiative cost fields present for ${initiative.title} but payload financial_mode="revenue_only"; using totalInvestment for overall ROI/payback.`,
          );
        }
      });
    } else {
      // Legacy / cost-enabled mode: perform detailed per-initiative ROI and cost validations
      plan.plan.forEach((initiative, index) => {
        if (
          initiative.one_time_cost > 0 &&
          initiative.expected_monthly_revenue_lift > 0
        ) {
          const expectedAnnualLift =
            initiative.expected_monthly_revenue_lift * 12;
          const expectedROI = (
            (expectedAnnualLift / initiative.one_time_cost) *
            100
          ).toFixed(1);

          // Extract numeric ROI from the string (e.g., "52800 / 50000 = 1.056 => 105.6%")
          const roiMatch =
            initiative.ROI &&
            initiative.ROI.match &&
            initiative.ROI.match(/(\d+\.?\d*)%/);
          if (roiMatch) {
            const statedROI = parseFloat(roiMatch[1]);
            if (Math.abs(statedROI - parseFloat(expectedROI)) > 5) {
              issues.push(
                `ROI calculation error for ${initiative.title}: stated ${statedROI}%, calculated ${expectedROI}%`,
              );
            }
          } else {
            issues.push(
              `ROI format invalid for ${initiative.title}: ${initiative.ROI}`,
            );
          }
        }

        // Check for negative costs
        if (
          initiative.one_time_cost < 0 ||
          initiative.recurring_annual_cost < 0
        ) {
          issues.push(`Negative costs found for ${initiative.title}`);
        }

        // Check for unrealistic ROI (>1000%)
        if (initiative.ROI && initiative.ROI.includes("> 1000")) {
          issues.push(
            `Extremely high ROI detected for ${initiative.title} - may indicate error`,
          );
        }
      });
    }

    // Check financial breakdown
    if (plan.financial_breakdown) {
      // financialMode variable already defined above
      if (financialMode === "revenue_only") {
        // In revenue_only mode the plan's financial_breakdown is expected to use totalInvestment and revenue-only fields.
        const fbMonthly =
          plan.financial_breakdown.overall &&
          plan.financial_breakdown.overall.monthly_revenue_lift_total;
        if (typeof fbMonthly === "number") {
          if (Math.abs(fbMonthly - totalMonthlyLift) > 500) {
            issues.push(
              `Financial breakdown monthly lift mismatch: ${fbMonthly} vs calculated ${totalMonthlyLift}`,
            );
          }
        }
        // If a payback string is present, ensure it references the total investment and monthly lift rather than per-initiative costs.
        if (
          plan.financial_breakdown.payback &&
          typeof plan.financial_breakdown.payback === "string"
        ) {
          // basic sanity check: contains the totalInvestment or monthlyRevenueLift numbers
          const investmentStr =
            (originalPayload.userInputs &&
              originalPayload.userInputs.totalInvestment) ||
            (originalPayload.summaryMetrics &&
              originalPayload.summaryMetrics.totalInvestment) ||
            (originalPayload.userPreferences &&
              originalPayload.userPreferences.maxInvestment);
          if (
            investmentStr &&
            !plan.financial_breakdown.payback.includes(String(investmentStr))
          ) {
            issues.push(
              "Payback string does not reference the provided total investment in revenue_only mode",
            );
          }
        }
      } else {
        const totalOneTimeFB =
          plan.financial_breakdown.total_one_time_costs || 0;
        const totalRecurringFB =
          plan.financial_breakdown.total_recurring_costs || 0;

        if (Math.abs(totalOneTimeFB - totalOneTime) > 1000) {
          issues.push(
            `Financial breakdown one-time cost mismatch: ${totalOneTimeFB} vs calculated ${totalOneTime}`,
          );
        }

        if (Math.abs(totalRecurringFB - totalRecurring) > 1000) {
          issues.push(
            `Financial breakdown recurring cost mismatch: ${totalRecurringFB} vs calculated ${totalRecurring}`,
          );
        }

        // Check payback period calculation
        if (plan.financial_breakdown.payback_period_months) {
          const calculatedPayback =
            totalOneTime > 0 ? Math.round(totalOneTime / totalMonthlyLift) : 0;
          const statedPayback = plan.financial_breakdown.payback_period_months;

          if (Math.abs(calculatedPayback - statedPayback) > 1) {
            issues.push(
              `Payback period mismatch: stated ${statedPayback} months, calculated ${calculatedPayback} months`,
            );
          }
        }
      }
    }

    // Check for missing validation section
    if (!plan.validation) {
      corrections.validation =
        issues.length === 0 ? ["No validation issues found"] : issues;
    }
  } catch (error) {
    issues.push(`Validation error: ${error.message}`);
  }

  return { issues, corrections };
}

// UI Integration Functions

/**
 * Show plan preview modal
 */
export function previewPlan() {
  const userPrefs = {
    maxInvestment:
      parseFloat(document.getElementById("max-investment").value) || 150000,
    timeHorizonMonths:
      parseInt(document.getElementById("time-horizon").value) || 12,
    preferredDepth: document.getElementById("detail-level").value || "detailed",
  };

  const payload = generatePayload(userPrefs);
  if (!payload) {
    alert(
      "No growth opportunities found. Please set potential volumes above current values.",
    );
    return;
  }

  // Populate preview
  const driversPreview = document.getElementById("drivers-preview");
  driversPreview.innerHTML = `<pre>${JSON.stringify(payload.topDrivers, null, 2)}</pre>`;

  const preferencesPreview = document.getElementById("preferences-preview");
  preferencesPreview.innerHTML = `
    Max Investment: $${userPrefs.maxInvestment.toLocaleString()}<br>
    Time Horizon: ${userPrefs.timeHorizonMonths} months<br>
    Detail Level: ${userPrefs.preferredDepth}
  `;

  // Store payload for generation
  window.pendingPayload = payload;

  // Show modal
  document.getElementById("plan-preview").classList.remove("hidden");
}

/**
 * Close plan preview modal
 */
export function closePreview() {
  document.getElementById("plan-preview").classList.add("hidden");
  window.pendingPayload = null;
}

/**
 * Proceed with plan generation using previewed data
 */
export function proceedWithGeneration() {
  closePreview();
  if (window.pendingPayload) {
    testWithPayload(window.pendingPayload);
  }
}

/**
 * Copy payload for ChatGPT integration
 */
export function copyPayloadForChatGPT() {
  const userPrefs = {
    maxInvestment:
      parseFloat(document.getElementById("max-investment").value) || 150000,
    timeHorizonMonths:
      parseInt(document.getElementById("time-horizon").value) || 12,
    preferredDepth: document.getElementById("detail-level").value || "detailed",
  };

  const payload = generatePayload(userPrefs);
  if (!payload) {
    alert("No growth opportunities found to copy.");
    return;
  }

  const systemMessage = `You are an operations consultant for small healthcare providers. Use the JSON payload below and produce a complete implementation plan suitable for handing to a store manager and a pharmacist. Be explicit about calculations. Avoid speculative claims. Stick to the data and state assumptions.`;

  const userMessage = `From the JSON payload, output:
- "executive_summary" This is a summary. Don’t overwhelm the reader with a detailed list of everything they’re about to find in the business plan. Use the executive summary to hook the reader and compel them to continue reading to learn more about your plan
- "plan" (array of initiatives; each initiative must include: id, title, priority (1-5), owner_role, start_week, duration_weeks, tasks (array of {task_id, title, owner, est_hours, acceptance_criteria}), one_time_cost, recurring_annual_cost, expected_monthly_revenue_lift, ROI (show arithmetic used to calculate this), risk_score (0-10), top 2 mitigations).
- "mermaid_timeline" - a small mermaid timeline diagram organised by quarters (Q1-Q4) that a front-end can render. 
Example: timeline
    title Opportunity Analysis
    Q1 : Implementation one
    Q2 : Implementation two
         : Implementation three
    Q3 : Implementation four
    Q4 : Implementation five
- "financial_breakdown": verify totals, sum of one_time_costs, recurring, and compute payback_period_months = one_time_cost / monthly_revenue_lift (per initiative and overall). Show the arithmetic for each computed number.
- "validation": run simple checks and list any inconsistencies (e.g., ROI > 1000x, negative costs).

Return valid JSON only (no extra commentary) in a top-level object with keys: executive_summary, plan, mermaid_timeline, financial_breakdown, validation, notes.

JSON:
${JSON.stringify(payload, null, 2)}`;

  const fullPrompt = `${systemMessage}\n\n${userMessage}`;

  navigator.clipboard
    .writeText(fullPrompt)
    .then(() => {
      alert("Prompt copied to clipboard! Paste into ChatGPT and run.");
    })
    .catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = fullPrompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Prompt copied to clipboard!");
    });
}

/**
 * Generate plan with specific type (quick/detailed)
 */
export function generatePlan(type) {
  const userPrefs = {
    maxInvestment:
      parseFloat(document.getElementById("max-investment").value) || 150000,
    timeHorizonMonths:
      parseInt(document.getElementById("time-horizon").value) || 12,
    preferredDepth: document.getElementById("detail-level").value || "detailed",
  };

  let payload = generatePayload(userPrefs);
  if (!payload) {
    alert(
      "No growth opportunities found. Please set potential volumes above current values.",
    );
    return;
  }

  // For quick plan, limit to top 6 drivers
  if (type === "quick") {
    payload = {
      ...payload,
      topDrivers: payload.topDrivers.slice(0, 6),
      summaryMetrics: {
        ...payload.summaryMetrics,
        // Recalculate totals for top 6 (revenue-only). Per-service cost fields are intentionally omitted in revenue_only mode.
        monthlyRevenueDelta: payload.topDrivers
          .slice(0, 6)
          .reduce((sum, d) => sum + d.monthlyRevenueImpact, 0),
        estimatedAnnualDelta:
          payload.topDrivers
            .slice(0, 6)
            .reduce((sum, d) => sum + d.monthlyRevenueImpact, 0) * 12,
      },
      userPreferences: { ...userPrefs, preferredDepth: "high-level" },
    };
  }

  testWithPayload(payload);
}

/**
 * Test AI with custom payload
 */
async function testWithPayload(payload) {
  console.log("Testing AI with custom payload:", payload);

  // Check environment variables first
  const envCheck = checkEnvironmentVariables();
  if (envCheck.missingVars.length > 0) {
    console.warn("⚠️ Missing environment variables:", envCheck.missingVars);
    hideLoading();
    alert(`❌ Missing Configuration: ${envCheck.missingVars.join(' and ')} are not properly configured.\n\nPlease check that environment variables are set correctly in your Netlify dashboard.`);
    return;
  }

  // Store globally for validation access
  window.currentPayload = payload;

  showLoading();

  try {
    let response;
    try {
      response = await fetch("/.netlify/functions/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ structuredPayload: payload }),
      });

      if (response.status === 404) {
        response = await fetch("/.netlify/functions/generate-plan-background", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ structuredPayload: payload }),
        });
      }
    } catch (err) {
      response = await fetch("/.netlify/functions/generate-plan-background", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ structuredPayload: payload }),
      });
    }

    if (response.status === 202 || response.status === 200) {
      let result = null;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          result = await response.json();
        } catch (e) {
          throw new Error("Failed to parse JSON from response");
        }
      } else {
        const text = await response.text();
        if (text && text.trim()) {
          try {
            result = JSON.parse(text);
          } catch (e) {
            // ignore
          }
        }
      }

      if (result && result.success && result.jobId) {
        await pollForPlan(result.jobId);
        return;
      }

      if (response.status === 200 && result && result.success && result.plan) {
        // Validate and correct the plan
        const validation = validateAndCorrectPlan(result.plan, payload);

        // Merge validation results into plan
        result.plan.validation =
          validation.issues.length > 0
            ? validation.issues
            : ["No validation issues found"];
        result.plan.notes =
          (result.plan.notes || "") +
          (validation.issues.length > 0
            ? "\n\nValidation corrections applied."
            : "");

        displayPlan(result.plan);
        return;
      }

      throw new Error("Invalid response from API");
    }

    const result = await response.json();
    if (result.success) {
      // Validate and correct the plan
      const validation = validateAndCorrectPlan(result.plan, payload);

      // Merge validation results into plan
      result.plan.validation =
        validation.issues.length > 0
          ? validation.issues
          : ["No validation issues found"];
      result.plan.notes =
        (result.plan.notes || "") +
        (validation.issues.length > 0
          ? "\n\nValidation corrections applied."
          : "");

      displayPlan(result.plan);
    } else {
      alert("❌ AI Error: " + result.error);
      if (result.fallbackPlan) {
        displayPlan(result.fallbackPlan);
      }
    }
  } catch (error) {
    console.error("AI test failed:", error);
    
    // Provide more specific error messages based on the type of error
    if (error.message.includes("JSON.parse")) {
      alert("❌ Server Error: The AI service returned an invalid response. This might be due to missing API configuration. Please check the console for details.");
    } else if (error.message.includes("API Error")) {
      alert("❌ API Error: " + error.message);
    } else if (error.message.includes("fetch")) {
      alert("❌ Network Error: Unable to connect to the AI service. Please check your internet connection.");
    } else {
      alert("❌ Error: " + error.message + "\n\nPlease check the browser console for more details.");
    }
  } finally {
    hideLoading();
  }
}
