// Calculation Functions
// This file contains all calculation logic for the pharmacy calculator

import { servicesData } from "./serviceData.js";
import { state } from "./state.js";
import { validateNumericInput } from "./validation.js";

/**
 * Format a number as Australian currency
 * @param {number} value - The numeric value to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value) => {
  // Handle edge cases
  if (value === null || value === undefined) {
    return "$0.00";
  }
  
  // Handle NaN and Infinity
  if (typeof value !== "number" || !isFinite(value)) {
    return "$0.00";
  }
  
  // Handle extremely large numbers (prevent overflow display)
  if (Math.abs(value) > 999999999) {
    return "$999,999,999.99+";
  }
  
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value);
};

/**
 * Calculate all service values based on the central state object
 */
export function calculateAll() {
  let totalCurrent = 0;
  let totalAdditional = 0;
  let hasAnyInput = false;

  Object.values(servicesData)
    .flat()
    .forEach((service) => {
      let currentVal = 0;
      let additionalVal = 0;
      const serviceState = state.services[service.id];

      if (!serviceState) return;

      if (service.isCombined) {
        // Handle combined services (e.g., MedsChecks)
        const vols = {};
        service.fields.forEach((field) => {
          const fieldState = serviceState.fields[field.id];
          vols[field.id] = {
            c: fieldState.currentVol || 0,
            p: fieldState.potentialVol || 0,
            fr: field.fundedRate,
          };
          
          // Check if there's any input
          if (vols[field.id].c > 0 || vols[field.id].p > 0) {
            hasAnyInput = true;
          }
        });
        [currentVal, additionalVal] = service.calc(vols, service.timeFactor);
      } else if (service.customLayout) {
        // Handle custom layout services
        if (service.id === "staged-supply") {
          const pickups = serviceState.patientPickups || [];
          if (pickups.some(p => p > 0)) hasAnyInput = true;
          [currentVal, additionalVal] = service.calc(pickups);
        } else if (service.id === "hmr") {
          if (serviceState.currentVol > 0) hasAnyInput = true;
          [currentVal, additionalVal] = service.calc(
            serviceState.currentVol || 0,
            serviceState.thirdPartyPercent || 0
          );
        } else if (service.id === "adalimumab" || service.id === "etanercept") {
          // Pass specific values for biologics
          if (serviceState.originator > 0 || serviceState.biosimilar > 0) hasAnyInput = true;
          [currentVal, additionalVal] = service.calc(
            serviceState.originator || 0,
            serviceState.biosimilar || 0,
            serviceState.program || 0
          );
        } else if (service.id === "rmmr") {
            if (serviceState.currentVol > 0 || serviceState.potentialVol > 0) hasAnyInput = true;
            [currentVal, additionalVal] = service.calc(
                serviceState.currentVol || 0,
                serviceState.potentialVol || 0,
                0, 0, // pfc, pfp
                service.fundedRate,
                service.timeFactor
            );
        } else if (service.id === "qum") {
            if (serviceState.beds > 0) hasAnyInput = true;
            [currentVal, additionalVal] = service.calc(
                serviceState.beds || 0,
                serviceState.beds || 0, // Assume same beds for potential for now unless we add a potential beds field
                0, 0,
                service.fundedRate,
                service.timeFactor
            );
        }
      } else {
        // Handle regular services
        if (serviceState.currentVol > 0 || serviceState.potentialVol > 0) {
          hasAnyInput = true;
        }
        [currentVal, additionalVal] = service.calc(
          serviceState.currentVol || 0,
          serviceState.potentialVol || 0,
          serviceState.patientFeeCurrent || 0,
          serviceState.patientFeePotential || 0,
          service.fundedRate,
          service.timeFactor
        );
      }

      // Ensure additional value is not negative
      additionalVal = Math.max(0, additionalVal);

      // Update the UI with calculated values
      const currentEl = document.getElementById(`current-val-${service.id}`);
      const additionalEl = document.getElementById(`additional-val-${service.id}`);

      if (currentEl) currentEl.textContent = formatCurrency(currentVal);
      if (additionalEl) additionalEl.textContent = formatCurrency(additionalVal);

      totalCurrent += currentVal;
      totalAdditional += additionalVal;
    });

  // Update total values in the UI
  const totalCurrentEl = document.getElementById("total-current-value");
  const totalAdditionalEl = document.getElementById("total-additional-value");
  const totalPotentialEl = document.getElementById("total-potential-value");

  if (totalCurrentEl) totalCurrentEl.textContent = formatCurrency(totalCurrent);
  if (totalAdditionalEl) totalAdditionalEl.textContent = formatCurrency(totalAdditional);
  if (totalPotentialEl) totalPotentialEl.textContent = formatCurrency(totalCurrent + totalAdditional);

  // Show/hide empty state message
  updateEmptyState(hasAnyInput);
}

/**
 * Show or hide empty state message
 * @param {boolean} hasInput - Whether any input has been filled
 */
function updateEmptyState(hasInput) {
  let emptyStateEl = document.getElementById("empty-state-message");
  
  if (!hasInput) {
    if (!emptyStateEl) {
      emptyStateEl = document.createElement("div");
      emptyStateEl.id = "empty-state-message";
      emptyStateEl.className = "p-6 bg-blue-50 border border-blue-200 rounded-2xl text-center mb-6";
      emptyStateEl.innerHTML = `
        <div class="text-blue-600 font-semibold text-lg mb-2">Enter your pharmacy data to see results</div>
        <p class="text-slate-600 text-sm">Fill in patient fees and service volumes in the tables below. Your estimated yearly opportunity will appear here automatically.</p>
      `;
      
      // Insert after the totals section
      const totalsSection = document.getElementById("projected-opportunity");
      if (totalsSection) {
        totalsSection.insertAdjacentElement("afterend", emptyStateEl);
      }
    }
  } else {
    if (emptyStateEl) {
      emptyStateEl.remove();
    }
  }
}

/**
 * Collect current analysis data for AI processing from state
 * @returns {Array} Array of service analysis data objects
 */
export function collectCurrentAnalysisData() {
  const analysisData = [];

  Object.values(servicesData)
    .flat()
    .forEach((service) => {
      const serviceState = state.services[service.id];
      if (!serviceState) return;

      if (service.isCombined) {
        service.fields.forEach((field) => {
          const fieldState = serviceState.fields[field.id];
          const currentVol = fieldState.currentVol || 0;
          const potentialVol = fieldState.potentialVol || 0;

          if (potentialVol > currentVol && currentVol >= 0 && potentialVol >= 0) {
            const currentVal = field.fundedRate * currentVol * service.timeFactor;
            const potentialVal = field.fundedRate * potentialVol * service.timeFactor;
            const additionalVal = potentialVal - currentVal;

            analysisData.push({
              id: `${service.id}-${field.id}`,
              name: field.name,
              currentValue: Math.round(currentVal),
              potentialValue: Math.round(potentialVal),
              additionalValue: Math.round(additionalVal),
              growthPercentage: currentVol > 0 ? Math.round(((potentialVol - currentVol) / currentVol) * 100) : 100,
            });
          }
        });
      } else {
        // For custom layouts like biologics, we might need special handling
        // but for now we follow the same logic as the original implementation
        // but reading from state instead of DOM.
        
        let currentVal = 0;
        let additionalVal = 0;
        
        // Re-calculate values for the payload to ensure accuracy
        if (service.id === "staged-supply") {
          [currentVal, additionalVal] = service.calc(serviceState.patientPickups || []);
        } else if (service.id === "hmr") {
          [currentVal, additionalVal] = service.calc(serviceState.currentVol || 0, serviceState.thirdPartyPercent || 0);
        } else if (service.id === "adalimumab" || service.id === "etanercept") {
          [currentVal, additionalVal] = service.calc(serviceState.originator || 0, serviceState.biosimilar || 0, serviceState.program || 0);
        } else if (service.id === "qum") {
           [currentVal, additionalVal] = service.calc(serviceState.beds || 0, serviceState.beds || 0, 0, 0, service.fundedRate, service.timeFactor);
        } else {
          [currentVal, additionalVal] = service.calc(
            serviceState.currentVol || 0,
            serviceState.potentialVol || 0,
            serviceState.patientFeeCurrent || 0,
            serviceState.patientFeePotential || 0,
            service.fundedRate,
            service.timeFactor
          );
        }

        if (additionalVal > 0) {
          analysisData.push({
            id: service.id,
            name: service.name,
            currentValue: Math.round(currentVal),
            potentialValue: Math.round(currentVal + additionalVal),
            additionalValue: Math.round(additionalVal),
            growthPercentage: (serviceState.currentVol || 0) > 0 ? 
              Math.round(((serviceState.potentialVol - serviceState.currentVol) / serviceState.currentVol) * 100) : 100,
          });
        }
      }
    });

  return analysisData;
}

/**
 * Generate compressed structured payload for AI processing
 */
export function generatePayload(userPreferences = {}, rawDataOverride = null) {
  const rawData = rawDataOverride || collectCurrentAnalysisData();
  if (!rawData.length) return null;

  // ... (rest of the generatePayload logic remains mostly the same but uses state-derived data)
  // Re-using original logic but ensuring it uses state consistently.
  
  let totalCurrentMonthly = 0;
  let totalMonthlyDelta = 0;

  const processedData = rawData.map((service) => {
    const annualDelta = service.additionalValue;
    const monthlyDelta = annualDelta / 12;

    totalCurrentMonthly += service.currentValue / 12;
    totalMonthlyDelta += monthlyDelta;

    return {
      id: service.id,
      name: service.name,
      currentValue: service.currentValue,
      potentialValue: service.potentialValue,
      monthlyRevenueImpact: monthlyDelta,
      annualRevenueImpact: Math.round(monthlyDelta * 12),
      growthPercentage: service.growthPercentage,
      assumptions: `Based on standard pharmacy implementation for ${service.name}`,
    };
  });

  const rankedByImpact = [...processedData].sort((a, b) => b.monthlyRevenueImpact - a.monthlyRevenueImpact);
  const top6Ids = rankedByImpact.slice(0, 6).map((d) => d.id);
  processedData.forEach((item) => { item.included = top6Ids.includes(item.id); });

  const topDrivers = rankedByImpact.slice(0, Math.min(8, rankedByImpact.length));
  const includedMonthlyDelta = topDrivers.filter((d) => d.included).reduce((sum, d) => sum + d.monthlyRevenueImpact, 0);

  const payload = {
    metadata: {
      calculatorVersion: "1.3.1",
      generatedAt: new Date().toISOString(),
      currency: "AUD",
      timeUnit: "month",
      data_provenance: "Derived from centralized application state",
      financial_mode: "revenue_only",
    },
    summaryMetrics: {
      scope: "selected_initiatives",
      currentMonthlyRevenue: Math.round(totalCurrentMonthly),
      projectedMonthlyRevenue: Math.round(totalCurrentMonthly + includedMonthlyDelta),
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
      unit: "patients/month",
      monthlyRevenueImpact: Math.round(driver.monthlyRevenueImpact),
      annualRevenueImpact: Math.round(driver.annualRevenueImpact),
      included: driver.included,
      assumptions: driver.assumptions,
    })),
    overallFinancials: (() => {
      const investment = userPreferences.maxInvestment || 0;
      const monthlyLift = includedMonthlyDelta || 0;
      const annualLift = Math.round(monthlyLift * 12);

      let roiNumeric = investment > 0 ? (annualLift / investment) * 100 : null;
      let paybackMonths = investment > 0 && monthlyLift > 0 ? investment / monthlyLift : Infinity;

      return {
        roi: roiNumeric === null ? null : Number(roiNumeric.toFixed(1)),
        paybackMonths: paybackMonths === Infinity ? Infinity : Number(paybackMonths.toFixed(1)),
        roiArithmetic: investment > 0 ? `${annualLift} / ${investment} * 100 = ${roiNumeric.toFixed(1)}%` : "N/A",
        paybackArithmetic: investment > 0 && monthlyLift > 0 ? `${investment} / ${monthlyLift} = ${paybackMonths.toFixed(1)} months` : "N/A",
        monthlyRevenueLift: Math.round(monthlyLift),
        annualRevenueLift: annualLift,
        totalInvestment: investment,
      };
    })(),
    userPreferences: {
      maxInvestment: userPreferences.maxInvestment || 15000,
      timeHorizonMonths: userPreferences.timeHorizonMonths || 12,
      preferredDepth: userPreferences.preferredDepth || "detailed",
    },
    financial_breakdown: {
      overall: {
        one_time_total: userPreferences.maxInvestment || 0,
        monthly_revenue_lift_total: includedMonthlyDelta,
        annual_revenue_lift_total: includedMonthlyDelta * 12,
      }
    }
  };

  return payload;
}
