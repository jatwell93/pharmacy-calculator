// UI Functions
// This file contains all DOM manipulation and table generation logic

/* global mermaid */

import { servicesData } from "./serviceData.js";
import { calculateAll } from "./calculations.js";

/**
 * Generate all service tables dynamically
 */
export function generateTables() {
  const partNames = {
    part1: "Government-Funded Programs",
    part2: "Vaccinations",
    part3: "Pharmacy Programs & Services",
    part4: "Biologics Dispensary Opportunity",
  };

  Object.keys(servicesData).forEach((partKey) => {
    const tbody = document.getElementById(`${partKey}-body`);
    if (!tbody) return;

    // Add category header
    const headerTr = document.createElement("tr");
    headerTr.innerHTML = `<td colspan="6" class="px-4 py-4 bg-blue-50 font-bold text-blue-800 border-b-2">${partNames[partKey]}</td>`;
    tbody.appendChild(headerTr);

    servicesData[partKey].forEach((service) => {
      if (service.customLayout && service.id === "staged-supply") {
        // Custom layout for staged-supply
        // Header row
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = `
          <td class="px-4 py-3 font-medium text-gray-900">${service.name}${service.assumptions ? '<span title="' + service.assumptions.replace(/"/g, "&quot;") + '" class="text-gray-500 cursor-help"> ℹ️</span>' : ""}</td>
          <td class="px-4 py-3 funded-cell">${service.fundedRateDesc}</td>
          <td class="px-4 py-3 text-center">Pickups Per Week</td>
          <td class="px-4 py-3 text-center"></td>
          <td class="px-4 py-3 text-center"></td>
          <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
          <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>

        `;
        tbody.appendChild(headerRow);

        // Patient rows (A to O, 15 patients)
        for (let i = 1; i <= 15; i++) {
          const letter = String.fromCharCode(64 + i); // A to O
          const patientRow = document.createElement("tr");
          patientRow.innerHTML = `
            <td class="px-4 py-3 text-center row-label">Patient ${letter}</td>
            <td class="px-4 py-3 text-center"></td>
            <td class="px-4 py-3 text-center">
              <input type="number" class="calc-input" id="staged-supply-patient-${letter.toLowerCase()}" min="0" max="7" placeholder="e.g. 3" />
            </td>
            <td colspan="4"></td>
          `;
          tbody.appendChild(patientRow);
        }

        return; // Skip standard processing
      } else if (service.customLayout && service.id === "hmr") {
        // Custom layout for HMR with third-party %
        // Header row
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = `
          <td class="px-4 py-3 row-label">Home Medications Reviews</td>
          <td class="px-4 py-3 text-center">Funded Rate</td>
          <td class="px-4 py-3 text-center">Services Per Month</td>
          <td class="px-4 py-3 text-center">% Paid to 3rd Party</td>
          <td class="px-4 py-3 text-center"></td>
          <td class="px-4 py-3 text-right">Current Value</td>
          <td class="px-4 py-3 text-right">Additional Value</td>
        `;
        tbody.appendChild(headerRow);

        // Input row
        const inputRow = document.createElement("tr");
        inputRow.innerHTML = `
          <td class="px-4 py-3 font-medium text-gray-900">${service.name}${service.assumptions ? '<span title="' + service.assumptions.replace(/"/g, "&quot;") + '" class="text-gray-500 cursor-help"> ℹ️</span>' : ""}</td>
          <td class="px-4 py-3 funded-cell">${service.fundedRateDesc}</td>
          <td class="px-4 py-3 text-center">
            <input type="number" class="calc-input" id="${service.id}-current" placeholder="e.g. 5" />
          </td>
          <td class="px-4 py-3 text-center">
            <input type="number" class="calc-input" id="${service.id}-3rd-party-pct" min="0" max="100" placeholder="0.00%" value="0" /> %
          </td>
          <td class="px-4 py-3 text-center"></td>
          <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
          <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
        `;
        tbody.appendChild(inputRow);

        return; // Skip standard processing
      } else if (service.customLayout && service.id === "rmmr") {
        // Custom layout for RMMR with conditional display
        // Eligibility row
        const eligibilityRow = document.createElement("tr");
        eligibilityRow.innerHTML = `
          <td class="px-4 py-3 font-medium text-gray-900">${service.name}${service.assumptions ? '<span title="' + service.assumptions.replace(/"/g, "&quot;") + '" class="text-gray-500 cursor-help"> ℹ️</span>' : ""}</td>
          <td colspan="6" class="px-4 py-3">
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
              <label class="row-label">Do you provide and claim RMMR services within an approved Australian Government-funded Aged Care Facility/Facilities?</label>
              <select class="w-full sm:w-auto px-2 py-1 border border-gray-300 rounded-md text-sm" id="rmmr-eligible" onchange="toggleRMMRFields()">
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </td>
        `;
        tbody.appendChild(eligibilityRow);

        // Details section (hidden by default)
        const detailsDiv = document.createElement("div");
        detailsDiv.id = "rmmr-details";
        detailsDiv.className = "hidden w-full";
        detailsDiv.innerHTML = `
          <div class="grid grid-cols-3 gap-4 font-medium text-gray-900 mb-4">
            <div class="col-span-3">Residential Medication Management Review (RMMR)</div>
          </div>
          <div class="space-y-4">
            <div class="grid grid-cols-3 gap-4 items-start">
              <label class="row-label" for="rmmr-beds">
                Enter the number of eligible aged care beds within the Facilities serviced by you.<br>
                <em>If there is no opportunity to service a Facility, enter 0.</em>
              </label>
              <div>
                <input type="number" class="calc-input" id="rmmr-beds" min="0" placeholder="e.g. 120" />
              </div>
              <div></div>
            </div>
            <div class="grid grid-cols-3 gap-4 items-start">
              <label class="row-label" for="current-${service.id}">
                How many RMMRs do you provide each year? And how many do you have the potential to provide/what is your goal?
                <span id="rmmr-benchmark" class="hidden text-cyan-500 italic">
                  <br>Note: On average, 79 RMMRs are conducted per 100 beds.
                </span>
              </label>
              <div>
                <input type="number" class="calc-input" id="current-${service.id}" value="${service.currentVol}" />
              </div>
              <div>
                <input type="number" class="calc-input" id="potential-${service.id}" value="${service.potentialVol}" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-4 items-start">
              <div id="current-val-${service.id}" class="text-right result-cell tabular-nums"></div>
              <div id="additional-val-${service.id}" class="text-right result-cell tabular-nums"></div>
              <div></div>
            </div>
          </div>
        `;
        const detailsRow = document.createElement("tr");
        const detailsCell = document.createElement("td");
        detailsCell.colSpan = 7;
        detailsCell.appendChild(detailsDiv);
        detailsRow.appendChild(detailsCell);
        tbody.appendChild(detailsRow);

        return; // Skip standard processing
      } else if (service.customLayout && service.id === "qum") {
        // Custom layout for QUM with conditional display
        // Eligibility row
        const eligibilityRow = document.createElement("tr");
        eligibilityRow.innerHTML = `
          <td class="px-4 py-3 font-medium text-gray-900">${service.name}</td>
          <td colspan="6" class="px-4 py-3">
            <div class="flex flex-col sm:flex-row sm:items-center gap-2">
              <label class="row-label">Do you provide and claim QUM services within an approved Australian Government-funded Aged Care Facility/Facilities?</label>
              <select class="w-full sm:w-auto px-2 py-1 border border-gray-300 rounded-md text-sm" id="qum-eligible" onchange="toggleQUMFields()">
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </td>
        `;
        tbody.appendChild(eligibilityRow);

        // Details section (hidden by default)
        const detailsDiv = document.createElement("div");
        detailsDiv.id = "qum-details";
        detailsDiv.className = "hidden w-full";
        detailsDiv.innerHTML = `
          <div class="grid grid-cols-3 gap-4 font-medium text-gray-900 mb-4">
            <div class="col-span-3">Quality Use of Medicines (QUM)</div>
          </div>
          <div class="space-y-4">
            <div class="grid grid-cols-3 gap-4 items-start">
              <label class="row-label" for="qum-beds">
                Enter the number of eligible aged care beds within the Facilities serviced by you.
              </label>
              <div>
                <input type="number" class="calc-input" id="qum-beds" min="0" />
              </div>
              <div></div>
            </div>
            <div class="grid grid-cols-3 gap-4 items-start">
              <div id="current-val-${service.id}" class="text-right result-cell tabular-nums"></div>
              <div id="additional-val-${service.id}" class="text-right result-cell tabular-nums"></div>
              <div></div>
            </div>
          </div>
        `;
        const detailsRow = document.createElement("tr");
        const detailsCell = document.createElement("td");
        detailsCell.colSpan = 7;
        detailsCell.appendChild(detailsDiv);
        detailsRow.appendChild(detailsCell);
        tbody.appendChild(detailsRow);

        return; // Skip standard processing
      } else if (service.customLayout && service.id === "adalimumab") {
        // Custom layout for Adalimumab
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = `
          <td class="px-4 py-3 font-medium text-gray-900">${service.name}</td>
          <td class="px-4 py-3" colspan="6">
            <div class="w-full">
              <div class="grid grid-cols-3 gap-4 font-medium text-gray-900 mb-4">
                <div class="text-center">Reference Biologic Patients<br><small class="text-sm">(originator brand)</small></div>
                <div class="text-center">Biosimilar Patients</div>
                <div class="text-center">Pharmacy Program Enrolled<br><small class="text-sm">(via PharmaPrograms)</small></div>
              </div>
              <div class="mb-4 italic">
                Enter the number of patients you are currently dispensing biologics for, specifying how many of these receive the reference biologic (originator) and how many of these are receiving the biosimilar.
              </div>
              <div class="grid grid-cols-3 gap-4 items-center">
                <div class="text-center">
                  <input type="number" class="calc-input" id="${service.id}-originator" min="0" />
                </div>
                <div class="text-center">
                  <input type="number" class="calc-input" id="${service.id}-biosimilar" min="0" />
                </div>
                <div class="text-center">
                  <input type="number" class="calc-input" id="${service.id}-program" min="0" />
                </div>
              </div>
            </div>
          </td>
        `;
        tbody.appendChild(headerRow);

        // Result row
        const resultRow = document.createElement("tr");
        resultRow.innerHTML = `
          <td></td>
          <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
          <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
          <td colspan="4"></td>
        `;
        tbody.appendChild(resultRow);

        return; // Skip standard processing
      } else if (service.customLayout && service.id === "etanercept") {
        // Custom layout for Etanercept (similar to adalimumab)
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = `
          <td class="px-4 py-3 font-medium text-gray-900">${service.name}</td>
          <td class="px-4 py-3" colspan="6">
            <div class="w-full">
              <div class="grid grid-cols-3 gap-4 font-medium text-gray-900 mb-4">
                <div class="text-center">Reference Biologic Patients<br><small class="text-sm">(originator brand)</small></div>
                <div class="text-center">Biosimilar Patients</div>
                <div class="text-center">Pharmacy Program Enrolled<br><small class="text-sm">(via PharmaPrograms)</small></div>
              </div>
              <div class="mb-4 italic">
                Enter the number of patients you are currently dispensing biologics for, specifying how many of these receive the reference biologic (originator) and how many of these are receiving the biosimilar.
              </div>
              <div class="grid grid-cols-3 gap-4 items-center">
                <div class="text-center">
                  <input type="number" class="calc-input" id="${service.id}-originator" min="0" />
                </div>
                <div class="text-center">
                  <input type="number" class="calc-input" id="${service.id}-biosimilar" min="0" />
                </div>
                <div class="text-center">
                  <input type="number" class="calc-input" id="${service.id}-program" min="0" />
                </div>
              </div>
            </div>
          </td>
        `;
        tbody.appendChild(headerRow);

        // Result row
        const resultRow = document.createElement("tr");
        resultRow.innerHTML = `
          <td></td>
          <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
          <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums"></td>
          <td colspan="4"></td>
        `;
        tbody.appendChild(resultRow);

        return; // Skip standard processing
      }
      const tr = document.createElement("tr");
      tr.className = "hover:bg-gray-50";

      if (service.isCombined) {
        // Layout for combined services (e.g., MedsChecks)
        tr.innerHTML = `
            <td class="px-4 py-3 font-medium text-gray-900">${service.name}${service.assumptions ? '<span title="' + service.assumptions.replace(/"/g, "&quot;") + '" class="text-gray-500 cursor-help"> ℹ️</span>' : ""}</td>
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
            <td class="px-4 py-3 font-medium text-gray-900">${service.name}${service.assumptions ? '<span title="' + service.assumptions.replace(/"/g, "&quot;") + '" class="text-gray-500 cursor-help"> ℹ️</span>' : ""}</td>
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

function getImplementationDifficulty(serviceType) {
  const easy = ["vaccinations", "app enrollments", "consultations"];
  const moderate = ["hmrs", "daas", "staged supply"];
  const complex = ["rmmrs", "biosimilars"];

  const type = serviceType.toLowerCase();
  if (easy.some((s) => type.includes(s))) return "Easy";
  if (moderate.some((s) => type.includes(s))) return "Moderate";
  if (complex.some((s) => type.includes(s))) return "Complex";
  return "Moderate"; // Default
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
          <p>Difficulty: ${getImplementationDifficulty(initiative.service_type)}</p>
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

      <!-- Mermaid Timeline Chart -->
      <div class="mb-6">
        <h4 class="font-bold text-purple-800 mb-2">📅 Implementation Timeline</h4>
        <div id="timeline-chart" class="mermaid bg-white p-4 rounded-lg border">
          ${plan.mermaid_timeline}
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

  // Add debug info section
  const debugInfoHtml = `
    <div class="mt-6 p-4 bg-gray-50 rounded-lg border">
      <h4 class="font-semibold mb-2 text-gray-800">Debug Information</h4>
      <p class="text-sm text-gray-600 mb-2">Checksum: <span class="font-mono">${plan.metadata && plan.metadata.checksum ? plan.metadata.checksum : "N/A"}</span></p>
      <p class="text-sm text-gray-600 mb-2">Use this info when reporting issues for faster support.</p>
      <button onclick="copyDebugInfo()" class="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">Copy Debug Info</button>
    </div>
  `;
  planResult.innerHTML += debugInfoHtml;

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

/**
 * Get debug info for support
 */
export function getDebugInfo() {
  const inputs = {};
  document.querySelectorAll(".calc-input").forEach((el) => {
    inputs[el.id] = el.value;
  });
  const maxInvestment = document.getElementById("max-investment")?.value || "";
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    inputValues: inputs,
    userPreferences: {
      maxInvestment,
      timeHorizon: document.getElementById("time-horizon")?.value || "",
      detailLevel: document.getElementById("detail-level")?.value || "",
    },
    userAgent: navigator.userAgent,
  };
}

/**
 * Copy debug info to clipboard
 */
export function copyDebugInfo() {
  const debugInfo = getDebugInfo();
  navigator.clipboard
    .writeText(JSON.stringify(debugInfo, null, 2))
    .then(() => {
      alert("Debug info copied to clipboard!");
    })
    .catch((err) => {
      console.error("Failed to copy debug info:", err);
      alert("Failed to copy debug info. Check console for details.");
    });
}

/**
 * Display calculation provenance and rate definitions
 */
export function displayProvenance() {
  const provenanceEl = document.getElementById("definitions");
  if (!provenanceEl) return;

  let html =
    '<h3 class="text-lg font-bold mb-2">Definitions & Rate Sources</h3>';
  html +=
    '<p class="text-sm text-gray-600 mb-2">Last updated: October 2024 (based on CPA guidelines)</p>';

  // Collect unique rates from services
  const rates = {};
  Object.values(servicesData).forEach((part) => {
    part.forEach((service) => {
      if (service.fundedRateDesc && service.fundedRateDesc !== "N/A") {
        if (!rates[service.fundedRateDesc]) {
          rates[service.fundedRateDesc] = [];
        }
        rates[service.fundedRateDesc].push(service.name);
      }
      if (service.fields) {
        service.fields.forEach((f) => {
          if (f.fundedRateDesc && f.fundedRateDesc !== "N/A") {
            if (!rates[f.fundedRateDesc]) {
              rates[f.fundedRateDesc] = [];
            }
            rates[f.fundedRateDesc].push(`${service.name} (${f.name})`);
          }
        });
      }
    });
  });

  html += '<ul class="list-disc list-inside text-sm">';
  Object.entries(rates).forEach(([rate, services]) => {
    html += `<li>${services.join(", ")}: ${rate}</li>`;
  });
  html += "</ul>";
  html +=
    '<button onclick="copyDebugInfo()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Copy Debug Info</button>';

  provenanceEl.innerHTML = html;
}
