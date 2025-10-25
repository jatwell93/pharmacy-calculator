// UI Functions
// This file contains all DOM manipulation and table generation logic

import { servicesData } from "./serviceData.js";
import { calculateAll } from "./calculations.js";

/**
 * Generate all service tables dynamically
 */
export function generateTables() {
  Object.keys(servicesData).forEach((partKey) => {
    const tbody = document.getElementById(`${partKey}-body`);
    if (!tbody) return;

    servicesData[partKey].forEach((service) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-gray-50";

      if (partKey === "part4") {
        // Special layout for Part 4 (Biologics)
        tr.innerHTML = `
                    <td class="px-4 py-3 font-medium text-gray-900">${service.name}</td>
                    <td class="px-4 py-3 funded-cell" colspan="2">${service.fundedRateDesc}</td>
                    <td class="px-4 py-3 text-center">
                        <input type="number" id="current-${service.id}" value="${service.currentVol}" class="calc-input">
                        <span class="text-sm text-gray-500 ml-1">${service.unit}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <input type="number" id="potential-${service.id}" value="${service.potentialVol}" class="calc-input">
                        <span class="text-sm text-gray-500 ml-1">${service.unit}</span>
                    </td>
                    <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
                    <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
                    <input type="hidden" id="pfc-${service.id}" value="0">
                    <input type="hidden" id="pfp-${service.id}" value="0">
                `;
      } else if (service.isCombined) {
        // Layout for combined services (e.g., MedsChecks)
        tr.innerHTML = `
                    <td class="px-4 py-3 font-medium text-gray-900">${service.name}</td>
                    <td class="px-4 py-3" colspan="2">
                        ${service.fields.map((f) => `<div class="text-sm text-gray-600 my-1">${f.name}: <span class="font-semibold">${f.fundedRateDesc}</span></div>`).join("")}
                    </td>
                    <td class="px-4 py-3 text-center">
                        ${service.fields.map((f) => `<div class="my-1"><input type="number" id="current-${service.id}-${f.id}" value="${f.currentVol}" class="calc-input"><span class="text-sm text-gray-500 ml-1">${service.unit}</span></div>`).join("")}
                    </td>
                    <td class="px-4 py-3 text-center">
                        ${service.fields.map((f) => `<div class="my-1"><input type="number" id="potential-${service.id}-${f.id}" value="${f.potentialVol}" class="calc-input"><span class="text-sm text-gray-500 ml-1">${service.unit}</span></div>`).join("")}
                    </td>
                    <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums align-top pt-5"></td>
                    <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums align-top pt-5"></td>
                `;
      } else {
        // Standard layout for regular services
        tr.innerHTML = `
                    <td class="px-4 py-3 font-medium text-gray-900">${service.name}</td>
                    <td class="px-4 py-3 funded-cell">${service.fundedRateDesc}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <input type="number" id="pfc-${service.id}" value="${service.patientFeeCurrent}" class="calc-input" ${service.patientFeeCurrent === 0 && service.patientFeePotential === 0 ? "disabled" : ""}> /
                            <input type="number" id="pfp-${service.id}" value="${service.patientFeePotential}" class="calc-input" ${service.patientFeeCurrent === 0 && service.patientFeePotential === 0 ? "disabled" : ""}>
                        </div>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <input type="number" id="current-${service.id}" value="${service.currentVol}" class="calc-input">
                        <span class="text-sm text-gray-500 ml-1">${service.unit}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <input type="number" id="potential-${service.id}" value="${service.potentialVol}" class="calc-input">
                        <span class="text-sm text-gray-500 ml-1">${service.unit}</span>
                    </td>
                    <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
                    <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
                `;
      }
      tbody.appendChild(tr);
    });
  });
}

/**
 * Setup event listeners for all calculator inputs
 */
export function setupEventListeners() {
  document.querySelectorAll(".calc-input").forEach((input) => {
    input.addEventListener("input", calculateAll);
  });
}

/**
 * Display the AI-generated plan in the UI
 * @param {Object} plan - The AI-generated plan object
 */
export function displayPlan(plan) {
  const planResult = document.getElementById("plan-result");

  // Build initiatives HTML
  let initiativesHTML = "";
  plan.plan.forEach((initiative) => {
    let tasksHTML = "";
    initiative.tasks.forEach((task) => {
      tasksHTML += `<li>${task.title} (${task.owner}, ${task.est_hours}h) - ${task.acceptance_criteria}</li>`;
    });

    initiativesHTML += `
      <div class="bg-white border border-gray-200 rounded-lg p-4">
        <div class="flex justify-between items-start mb-2">
          <h5 class="font-semibold text-lg text-gray-900">${initiative.title}</h5>
          <span class="px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full">Priority ${initiative.priority}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <div>
            <p class="text-sm text-gray-600">Owner</p>
            <p class="font-medium">${initiative.owner_role}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">Timeline</p>
            <p class="font-medium">Week ${initiative.start_week} - ${initiative.start_week + initiative.duration_weeks}</p>
          </div>
          <div>
            <p class="text-sm text-gray-600">ROI</p>
            <p class="font-medium">${initiative.ROI}</p>
          </div>
        </div>
        <div class="mb-3">
          <p class="text-sm text-gray-600 mb-1">Monthly Revenue Lift</p>
          <p class="font-bold text-green-600">$${initiative.expected_monthly_revenue_lift.toLocaleString()}</p>
        </div>
        <div class="mb-3">
          <p class="text-sm text-gray-600 mb-1">Tasks</p>
          <ul class="list-disc list-inside text-sm space-y-1">
            ${tasksHTML}
          </ul>
        </div>
        <div class="text-sm text-gray-600">
          <p>Confidence: ${initiative.confidence_pct}% | Risk Score: ${initiative.risk_score}/10</p>
          <p>Mitigations: ${initiative.mitigations.join(", ")}</p>
        </div>
      </div>
    `;
  });

  // Build validation HTML
  let validationHTML = "<p>No validation issues found.</p>";
  if (plan.validation && plan.validation.length > 0) {
    let issuesHTML = "";
    plan.validation.forEach((item) => {
      issuesHTML += `<li>${item}</li>`;
    });
    validationHTML = `
      <p><strong>Inconsistencies:</strong></p>
      <ul class="list-disc list-inside">
        ${issuesHTML}
      </ul>
    `;
  }

  // Create the plan HTML
  planResult.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow-lg">
      <h3 class="text-2xl font-bold text-blue-900 mb-4">Your AI-Generated Pharmacy Action Plan</h3>

      <!-- Executive Summary -->
      <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 class="font-bold text-blue-800 mb-2">📋 Executive Summary</h4>
        <p class="text-gray-700">${plan.executive_summary.replace(/\n/g, "<br>")}</p>
      </div>

      <!-- Initiatives -->
      <div class="mb-6">
        <h4 class="font-bold text-green-800 mb-4">🎯 Implementation Initiatives</h4>
        <div class="space-y-4">
          ${initiativesHTML}
        </div>
      </div>

      <!-- Mermaid Gantt Chart -->
      <div class="mb-6">
        <h4 class="font-bold text-purple-800 mb-2">📅 Implementation Timeline</h4>
        <div id="gantt-chart" class="mermaid bg-white p-4 rounded-lg border">
          ${plan.mermaid_gantt}
        </div>
      </div>

      <!-- Financial Breakdown -->
      <div class="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
        <h4 class="font-bold text-green-800 mb-2">💰 Financial Breakdown</h4>
        <div class="text-sm text-gray-700">
          ${
            plan.overallFinancials
              ? `
            ${plan.overallFinancials.paybackArithmetic ? `<p><strong>Payback:</strong> ${plan.overallFinancials.paybackArithmetic}</p>` : ""}
            ${plan.overallFinancials.roiArithmetic ? `<p><strong>ROI:</strong> ${plan.overallFinancials.roiArithmetic}</p>` : ""}
            <p><strong>Total Monthly Revenue Lift:</strong> $${(typeof plan.overallFinancials.monthlyRevenueLift === "number" ? plan.overallFinancials.monthlyRevenueLift : (plan.financial_breakdown && plan.financial_breakdown.overall && plan.financial_breakdown.overall.monthly_revenue_lift_total) || 0).toLocaleString()}</p>
            <p><strong>Total Investment:</strong> $${(typeof plan.overallFinancials.totalInvestment === "number" ? plan.overallFinancials.totalInvestment : (plan.financial_breakdown && plan.financial_breakdown.overall && plan.financial_breakdown.overall.one_time_total) || 0).toLocaleString()}</p>
            <pre class="mt-2 whitespace-pre-wrap">${plan.overallFinancials.roiArithmetic || (plan.financial_breakdown && plan.financial_breakdown.arithmetic) || "Details not available"}</pre>
          `
              : `
            ${plan.financial_breakdown && plan.financial_breakdown.payback_period_months ? `<p><strong>Payback Period:</strong> ${plan.financial_breakdown.payback_period_months.toFixed(1)} months</p>` : ""}
            <p><strong>Total One-Time Costs:</strong> $${((plan.financial_breakdown && plan.financial_breakdown.total_one_time_costs) || 0).toLocaleString()}</p>
            <p><strong>Total Recurring Annual Costs:</strong> $${((plan.financial_breakdown && plan.financial_breakdown.total_recurring_costs) || 0).toLocaleString()}</p>
            <p><strong>Total Monthly Revenue Lift:</strong> $${((plan.financial_breakdown && plan.financial_breakdown.total_monthly_revenue_lift) || 0).toLocaleString()}</p>
            <pre class="mt-2 whitespace-pre-wrap">${(plan.financial_breakdown && plan.financial_breakdown.arithmetic) || "Details not available"}</pre>
          `
          }
        </div>
      </div>

      <!-- Validation & Notes -->
      <div class="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h4 class="font-bold text-yellow-800 mb-2">⚠️ Validation & Notes</h4>
        <div class="text-sm text-gray-700">
          ${validationHTML}
          ${plan.notes ? `<p><strong>Notes:</strong> ${plan.notes}</p>` : ""}
        </div>
      </div>
    </div>
  `;

  // Initialize Mermaid charts
  setTimeout(() => {
    if (typeof mermaid !== "undefined") {
      try {
        mermaid.initialize({
          startOnLoad: true,
          theme: "default",
          gantt: {
            barHeight: 20,
            fontSize: 12,
            useWidth: 900,
          },
        });

        // Try to render all mermaid charts
        const mermaidElements = document.querySelectorAll(".mermaid");
        mermaidElements.forEach((element, index) => {
          try {
            mermaid.init(undefined, element);
            console.log(`Mermaid chart ${index + 1} rendered successfully`);
          } catch (mermaidError) {
            console.error(`Mermaid chart ${index + 1} failed:`, mermaidError);
            // Show the raw text as fallback
            element.innerHTML = `<div class="bg-red-50 p-4 rounded border border-red-200">
              <p class="text-red-700 font-semibold">Chart rendering failed</p>
              <pre class="text-sm mt-2 whitespace-pre-wrap">${element.textContent}</pre>
            </div>`;
          }
        });
      } catch (initError) {
        console.error("Mermaid initialization failed:", initError);
      }
    } else {
      console.error("Mermaid library not loaded");
    }
  }, 500);

  planResult.classList.remove("hidden");

  // Show the download button
  document.getElementById("download-plan-btn").classList.remove("hidden");
}

/**
 * Show loading state for AI plan generation
 */
export function showLoading() {
  const loadingEl = document.getElementById("plan-loading");
  const resultEl = document.getElementById("plan-result");

  // Disable all generation buttons
  const buttonsToDisable = [
    "generate-quick-plan-btn",
    "generate-full-plan-btn",
    "preview-plan-btn",
    "copy-payload-btn",
  ];

  buttonsToDisable.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = true;
  });

  loadingEl.classList.remove("hidden");
  resultEl.classList.add("hidden");
}

/**
 * Hide loading state for AI plan generation
 */
export function hideLoading() {
  const loadingEl = document.getElementById("plan-loading");

  // Enable all generation buttons
  const buttonsToEnable = [
    "generate-quick-plan-btn",
    "generate-full-plan-btn",
    "preview-plan-btn",
    "copy-payload-btn",
  ];

  buttonsToEnable.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = false;
  });

  loadingEl.classList.add("hidden");
}

/**
 * Download plan functionality (placeholder)
 */
export function downloadPlan() {
  alert("Download functionality not implemented yet.");
}
