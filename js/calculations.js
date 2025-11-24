// Calculation Functions
// This file contains all calculation logic for the pharmacy calculator

/* global process */

import { servicesData } from "./serviceData.js";

/**
 * Format a number as Australian currency
 * @param {number} value - The numeric value to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value);

/**
 * Calculate all service values and update the UI
 */
export function calculateAll() {
  let totalCurrent = 0;
  let totalAdditional = 0;

  Object.values(servicesData)
    .flat()
    .forEach((service) => {
      let currentVal = 0;
      let additionalVal = 0;

      if (service.isCombined) {
        // Handle combined services (e.g., MedsChecks)
        const vols = {};
        service.fields.forEach((field) => {
          vols[field.id] = {
            c:
              parseFloat(
                document.getElementById(`current-${service.id}-${field.id}`)
                  .value,
              ) || 0,
            p:
              parseFloat(
                document.getElementById(`potential-${service.id}-${field.id}`)
                  .value,
              ) || 0,
            fr: field.fundedRate,
          };
        });
        [currentVal, additionalVal] = service.calc(vols, service.timeFactor);
      } else if (service.customLayout) {
        // Handle custom layout services (e.g., staged-supply, hmr)
        if (service.id === "staged-supply") {
          const patientPickups = [];
          for (let i = 1; i <= 15; i++) {
            const letter = String.fromCharCode(64 + i).toLowerCase();
            const pickup = document.getElementById(
              `staged-supply-patient-${letter}`,
            ).value;
            patientPickups.push(pickup);
          }
          [currentVal, additionalVal] = service.calc(patientPickups);
        } else if (service.id === "hmr") {
          const volume =
            parseFloat(document.getElementById("hmr-current").value) || 0;
          const thirdPartyPercent =
            parseFloat(document.getElementById("hmr-3rd-party-pct").value) || 0;
          [currentVal, additionalVal] = service.calc(volume, thirdPartyPercent);
        } else if (service.id === "adalimumab" || service.id === "etanercept") {
          [currentVal, additionalVal] = service.calc();
        }
      } else {
        // Handle regular services
        const c =
          parseFloat(document.getElementById(`current-${service.id}`).value) ||
          0;
        const p =
          parseFloat(
            document.getElementById(`potential-${service.id}`).value,
          ) || 0;
        const pfc =
          parseFloat(document.getElementById(`pfc-${service.id}`).value) || 0;
        const pfp =
          parseFloat(document.getElementById(`pfp-${service.id}`).value) || 0;
        [currentVal, additionalVal] = service.calc(
          c,
          p,
          pfc,
          pfp,
          service.fundedRate,
          service.timeFactor,
        );
      }

      // Ensure additional value is not negative
      additionalVal = Math.max(0, additionalVal);

      // Update the UI with calculated values
      document.getElementById(`current-val-${service.id}`).textContent =
        formatCurrency(currentVal);
      document.getElementById(`additional-val-${service.id}`).textContent =
        formatCurrency(additionalVal);

      totalCurrent += currentVal;
      totalAdditional += additionalVal;
    });

  // Update total values in the UI
  document.getElementById("total-current-value").textContent =
    formatCurrency(totalCurrent);
  document.getElementById("total-additional-value").textContent =
    formatCurrency(totalAdditional);
  document.getElementById("total-potential-value").textContent = formatCurrency(
    totalCurrent + totalAdditional,
  );
}

/**
 * Collect current analysis data for AI processing
 * @returns {Array} Array of service analysis data objects
 */
export function collectCurrentAnalysisData() {
  const analysisData = [];

  Object.values(servicesData)
    .flat()
    .forEach((service) => {
      if (service.isCombined) {
        // Handle combined services like MedsChecks
        service.fields.forEach((field) => {
          const currentElement = document.getElementById(
            `current-${service.id}-${field.id}`,
          );
          const currentVol = currentElement
            ? parseFloat(currentElement.value) || 0
            : 0;
          const potentialElement = document.getElementById(
            `potential-${service.id}-${field.id}`,
          );
          const potentialVol = potentialElement
            ? parseFloat(potentialElement.value) || 0
            : 0;

          // Only include services with actual growth potential
          if (
            potentialVol > currentVol &&
            currentVol >= 0 &&
            potentialVol >= 0
          ) {
            const currentVal =
              field.fundedRate * currentVol * service.timeFactor;
            const potentialVal =
              field.fundedRate * potentialVol * service.timeFactor;
            const additionalVal = potentialVal - currentVal;

            analysisData.push({
              id: `${service.id}-${field.id}`,
              name: field.name,
              currentValue: Math.round(currentVal),
              potentialValue: Math.round(potentialVal),
              additionalValue: Math.round(additionalVal),
              growthPercentage:
                currentVol > 0
                  ? Math.round(((potentialVol - currentVol) / currentVol) * 100)
                  : 100,
            });
          }
        });
      } else {
        // Handle regular services
        const currentElement = document.getElementById(`current-${service.id}`);
        const currentVol = currentElement
          ? parseFloat(currentElement.value) || 0
          : 0;
        const potentialElement = document.getElementById(
          `potential-${service.id}`,
        );
        const potentialVol = potentialElement
          ? parseFloat(potentialElement.value) || 0
          : 0;
        const currentValElement = document.getElementById(
          `current-val-${service.id}`,
        );
        const additionalValElement = document.getElementById(
          `additional-val-${service.id}`,
        );

        if (
          currentValElement &&
          additionalValElement &&
          potentialVol > currentVol &&
          currentVol >= 0 &&
          potentialVol >= 0
        ) {
          const currentValText = currentValElement.textContent.replace(
            /[^0-9.-]+/g,
            "",
          );
          const additionalValText = additionalValElement.textContent.replace(
            /[^0-9.-]+/g,
            "",
          );

          const currentVal = parseFloat(currentValText) || 0;
          const additionalVal = parseFloat(additionalValText) || 0;
          const potentialVal = currentVal + additionalVal;

          // Validate we have reasonable numbers
          if (
            !isNaN(currentVal) &&
            !isNaN(potentialVal) &&
            currentVal >= 0 &&
            potentialVal >= 0
          ) {
            analysisData.push({
              id: service.id,
              name: service.name,
              currentValue: Math.round(currentVal),
              potentialValue: Math.round(potentialVal),
              additionalValue: Math.round(additionalVal),
              growthPercentage:
                currentVol > 0
                  ? Math.round(((potentialVol - currentVol) / currentVol) * 100)
                  : 100,
            });
          }
        }
      }
    });

  console.log("🔍 DEBUG: Cleaned analysis data:", analysisData);
  return analysisData;
}

/**
 * Generate compressed structured payload for AI processing
 * @returns {Object} Structured JSON payload with precomputed metrics and top drivers
 */
export function generatePayload(userPreferences = {}, rawDataOverride = null) {
  // Allow an override for rawData (useful for tests); otherwise collect from DOM
  const rawData = rawDataOverride || collectCurrentAnalysisData();

  // If no data, return null
  if (!rawData.length) {
    return null;
  }

  // Calculate total metrics
  let totalCurrentMonthly = 0;
  let totalProjectedMonthly = 0;
  let totalMonthlyDelta = 0;

  // Process raw data to add impact and ranking
  const processedData = rawData.map((service) => {
    const annualDelta = service.additionalValue;
    const monthlyDelta = annualDelta / 12;

    totalCurrentMonthly += service.currentValue / 12;
    totalProjectedMonthly += service.potentialValue / 12;
    totalMonthlyDelta += monthlyDelta;

    return {
      id: service.id,
      name: service.name,
      currentValue: service.currentValue,
      potentialValue: service.potentialValue,
      monthlyRevenueImpact: monthlyDelta,
      annualRevenueImpact: Math.round(monthlyDelta * 12),
      growthPercentage: service.growthPercentage,
      // Placeholder assumptions - should be customized per service
      assumptions: `Based on standard pharmacy implementation for ${service.name}`,
    };
  });

  // Rank by absolute revenue impact (descending)
  const rankedByImpact = [...processedData].sort(
    (a, b) => b.monthlyRevenueImpact - a.monthlyRevenueImpact,
  );

  // Determine included initiatives: top 6 by impact.
  const top6Ids = rankedByImpact.slice(0, 6).map((d) => d.id);
  processedData.forEach((item) => {
    item.included = top6Ids.includes(item.id);
  });

  // Take top 8 drivers, or all if fewer than 8
  const topDrivers = rankedByImpact.slice(
    0,
    Math.min(8, rankedByImpact.length),
  );

  // Calculate other items summary
  const otherItemsCount = processedData.length - topDrivers.length;
  const otherMonthlyImpact =
    totalMonthlyDelta -
    topDrivers.reduce((sum, d) => sum + d.monthlyRevenueImpact, 0);

  // Calculate monthly delta for included initiatives only (excludes other items to match top drivers only)
  const includedMonthlyDelta = topDrivers
    .filter((d) => d.included)
    .reduce((sum, d) => sum + d.monthlyRevenueImpact, 0);

  // Validate revenue sums
  const computedRevenueSum = includedMonthlyDelta;
  const originalRevenueSum = processedData.reduce(
    (sum, item) => sum + item.monthlyRevenueImpact,
    0,
  );
  const excludedSum = topDrivers
    .filter((d) => !d.included)
    .reduce((sum, d) => sum + d.monthlyRevenueImpact, 0);
  const expectedRevenueSum = originalRevenueSum - excludedSum;
  // Allow for floating-point precision errors (up to 0.1% or 10 units)
  const tolerancePercent = 0.001; // 0.1%
  const toleranceAbsolute = 10;
  const allowedTolerance = Math.max(
    Math.abs(expectedRevenueSum) * tolerancePercent,
    toleranceAbsolute,
  );
  if (Math.abs(computedRevenueSum - expectedRevenueSum) > allowedTolerance) {
    console.warn(
      "⚠️ Revenue sum mismatch in generatePayload:",
      computedRevenueSum,
      "vs expected",
      expectedRevenueSum,
    );
  }

  // Build payload
  const payload = {
    metadata: {
      calculatorVersion: "1.3.0",
      generatedAt: new Date().toISOString(),
      currency: "AUD",
      timeUnit: "month",
      data_provenance:
        "Derived directly from servicesData in original_calc.html (no cost fields)",
      financial_mode: "revenue_only",
    },
    summaryMetrics: {
      scope: "selected_initiatives",
      currentMonthlyRevenue: Math.round(totalCurrentMonthly),
      projectedMonthlyRevenue: Math.round(totalProjectedMonthly),
      monthlyRevenueDelta: Math.round(includedMonthlyDelta),
      estimatedAnnualDelta: Math.round(includedMonthlyDelta * 12),
      itemCount: processedData.length,
      totalInvestment: userPreferences.maxInvestment || 0,
      computedFrom: topDrivers.filter((d) => d.included).map((d) => d.id),
    },
    topDrivers: topDrivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      currentValue: driver.currentValue,
      targetValue: driver.potentialValue,
      unit: "patients/month", // Placeholder, should be service-specific
      monthlyRevenueImpact: Math.round(driver.monthlyRevenueImpact),
      annualRevenueImpact: Math.round(driver.annualRevenueImpact),
      included: driver.included,
      assumptions: driver.assumptions,
    })),
    overallFinancials: (() => {
      // Provide explicit arithmetic strings and robust edge-case handling
      const investment = userPreferences.maxInvestment || 0;
      const monthlyLift = includedMonthlyDelta || 0;
      const annualLift = Math.round(monthlyLift * 12);

      // Compute numeric ROI where possible. If total investment is 0 we surface null/insufficient-data rather than Infinity.
      let roiNumeric = null;
      if (investment > 0 && monthlyLift > 0) {
        roiNumeric = (annualLift / investment) * 100;
      } else if (investment > 0 && monthlyLift === 0) {
        roiNumeric = 0;
      } else {
        roiNumeric = null; // insufficient data (investment === 0)
      }

      // Human-readable arithmetic strings for transparency
      const roiString =
        investment > 0 && monthlyLift > 0
          ? `${annualLift} / ${investment} * 100 = ${roiNumeric.toFixed(1)}%`
          : investment === 0
            ? "Insufficient data: totalInvestment = 0"
            : `${annualLift} / ${investment} * 100 = 0%`;

      // Payback in months, plus readable string. If monthlyLift is 0 or investment is 0, mark accordingly.
      let paybackMonths =
        investment > 0 && monthlyLift > 0 ? investment / monthlyLift : Infinity;
      const paybackString =
        investment > 0 && monthlyLift > 0
          ? `${investment} / ${monthlyLift} = ${paybackMonths.toFixed(1)} months`
          : investment === 0
            ? "Insufficient data: totalInvestment = 0"
            : "Infinite (monthly lift = 0)";

      // Warnings based on thresholds and edge cases
      const warnings = [];
      if (roiNumeric !== null && roiNumeric < 0) {
        warnings.push("Negative ROI: revenue deltas do not cover investment");
      }
      if (paybackMonths === Infinity) {
        warnings.push(
          "Payback period undefined: monthly revenue lift is 0 or totalInvestment is 0",
        );
      } else if (paybackMonths > 24) {
        warnings.push("Payback period exceeds 24 months");
      }

      return {
        // numeric values for programmatic use
        roi: roiNumeric === null ? null : Number(roiNumeric.toFixed(1)),
        paybackMonths: Number(
          paybackMonths === Infinity
            ? Infinity
            : Number(paybackMonths.toFixed(1)),
        ),
        // readable arithmetic for humans / LLM verification
        roiArithmetic: roiString,
        paybackArithmetic: paybackString,
        // provenance and quick reference numbers
        monthlyRevenueLift: Math.round(monthlyLift),
        annualRevenueLift: annualLift,
        totalInvestment: investment,
        warnings,
      };
    })(),
    otherItemsSummary: {
      count: otherItemsCount,
      combinedMonthlyImpact: Math.round(otherMonthlyImpact),
      combinedOneTimeCost: null,
      combinedRecurringAnnualCost: null,
      totalInvestment: userPreferences.maxInvestment || 0,
      note: "No per-service costs; use total user-entered investment for ROI/payback. See downloadable CSV for full list",
    },
    userInputs: {
      totalInvestment: userPreferences.maxInvestment || 0,
      totalInvestmentPurpose: "used_for_overall_roi_and_payback_only",
    },
    userPreferences: {
      maxInvestment: userPreferences.maxInvestment || 150000,
      timeHorizonMonths: userPreferences.timeHorizonMonths || 12,
      preferredDepth: userPreferences.preferredDepth || "detailed",
    },
  };

  // Validation for forbidden cost keys
  // Add financial_breakdown for AI processing
  payload.financial_breakdown = {
    overall: {
      one_time_total: payload.summaryMetrics.totalInvestment,
      monthly_revenue_lift_total: payload.summaryMetrics.monthlyRevenueDelta,
      annual_revenue_lift_total: payload.summaryMetrics.estimatedAnnualDelta,
    },
    payback: `${payload.summaryMetrics.totalInvestment} / ${payload.summaryMetrics.monthlyRevenueDelta} months`,
    details: payload.topDrivers.map((d) => ({
      id: d.id,
      name: d.name,
      monthly_revenue_lift: d.monthlyRevenueImpact,
      annual_revenue_lift: d.annualRevenueImpact,
    })),
    overall_roi: `(${payload.summaryMetrics.estimatedAnnualDelta} - 0) / ${payload.summaryMetrics.totalInvestment} * 100`,
    missing_data_warnings: [
      "No per-service costs; using total user investment for overall ROI/payback calculations.",
    ],
  };

  const forbiddenCostKeys = [
    "oneTimeCost",
    "recurringCostAnnual",
    "serviceCost",
    "operationalCost",
  ];
  const found = Object.keys(payload).filter((k) =>
    forbiddenCostKeys.includes(k),
  );
  if (found.length) console.warn("⚠️ Forbidden cost fields present:", found);

  // Compute a payload checksum. Prefer a robust SHA-256 when available (Node.js), but
  // fall back to FNV-1a 32-bit for synchronous browser-friendly operation.
  function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      // Multiply by FNV prime (mod 2^32)
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("00000000" + (h >>> 0).toString(16)).slice(-8);
  }

  try {
    const checksumSource = JSON.stringify({
      topDrivers: payload.topDrivers.map((d) => [d.id, d.monthlyRevenueImpact]),
      summaryMetrics: payload.summaryMetrics,
      generatedAt: payload.metadata.generatedAt,
    });

    // Try Node.js crypto (synchronous) when running in Node.
    // Use eval("require") to avoid bundlers throwing on require in browser contexts.
    let checksum = null;
    try {
      if (
        typeof process !== "undefined" &&
        process.versions &&
        process.versions.node
      ) {
        try {
          const nodeCrypto = eval("require")("crypto");
          checksum = nodeCrypto
            .createHash("sha256")
            .update(checksumSource)
            .digest("hex")
            .slice(0, 8); // shorten to 8 hex chars like the FNV fallback for compactness
        } catch {
          // If Node crypto usage fails for any reason, we'll fallback below.
          checksum = null;
        }
      }
    } catch {
      // ignore and fall through to fallback
      checksum = null;
    }

    // Note: Web Crypto's subtle.digest is asynchronous and cannot be used here synchronously.
    // For browser environments we fall back to the fast FNV-1a implementation above.
    if (!checksum) {
      checksum = fnv1a32(checksumSource);
    }

    payload.metadata.checksum = checksum;
  } catch {
    // If checksum calculation fails for any reason, set to null but do not block payload generation.
    payload.metadata.checksum = null;
  }

  return payload;
}
