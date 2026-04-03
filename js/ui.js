// UI Functions
// This file contains all DOM manipulation and table generation logic

/* global mermaid */

import { servicesData } from "./serviceData.js";
import { calculateAll } from "./calculations.js";
import { downloadPlanHTML, downloadPlanPDF, downloadPlanCSV } from "./downloadPlan.js";

/**
 * Simple HTML escaping to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  if (typeof str !== "string") return String(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
    const tbody = document.getElementById(`${partKey}-rows`);
    if (!tbody) return;

    // Add category header
    const headerTr = document.createElement("tr");
    headerTr.innerHTML = `<td colspan="6" class="px-6 py-4 bg-brand-teal/5 font-bold text-brand-teal border-b border-brand-teal/10 font-heading uppercase text-sm tracking-wider">${partNames[partKey]}</td>`;
    tbody.appendChild(headerTr);

    servicesData[partKey].forEach((service) => {
      if (service.customLayout && service.id === "staged-supply") {
        // Custom layout for staged-supply
        // Header row
        const headerRow = document.createElement("tr");
        const assumptionsHtml = service.assumptions
          ? '<span title="' + service.assumptions.replace(/"/g, "&quot;") + '" class="text-slate-400 cursor-help" aria-label="Assumptions: ' + service.assumptions.replace(/"/g, "'") + '">(i)</span>'
          : "";
        headerRow.innerHTML = `
          <td class="px-4 py-3 font-semibold text-brand-navy" data-label="Service"><span class="service-name">${service.name}</span>${assumptionsHtml}</td>
          <td class="px-4 py-3 funded-cell font-medium" data-label="Funded Rate">${service.fundedRateDesc}</td>
          <td class="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider font-heading" data-label="Pickups/Week">Pickups<br>per Week</td>
          <td class="px-4 py-3 text-center"></td>
          <td class="px-4 py-3 text-center"></td>
          <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums text-brand-teal" data-label="Current Value"></td>
          <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums text-brand-amber font-bold" data-label="Additional Value"></td>
        `;
        tbody.appendChild(headerRow);

        // Patient rows (A to O, 15 patients)
        for (let i = 1; i <= 15; i++) {
          const letter = String.fromCharCode(64 + i); // A to O
          const patientRow = document.createElement("tr");
          patientRow.innerHTML = `
            <td class="px-4 py-3 text-center row-label" data-label="Patient">Patient ${letter}</td>
            <td class="px-4 py-3 text-center"></td>
            <td class="px-4 py-3 text-center" data-label="Pickups/Week">
              <label for="staged-supply-patient-${letter.toLowerCase()}" class="sr-only">Patient ${letter} — weekly pickups</label>
              <input type="number" class="calc-input" id="staged-supply-patient-${letter.toLowerCase()}" min="0" max="7" placeholder="0–7" aria-label="Patient ${letter}: weekly pickups (0 to 7)" />
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
          <td class="px-4 py-3 font-semibold text-brand-navy">Home Medication Reviews</td>
          <td class="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider font-heading">Funded<br>Rate</td>
          <td class="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider font-heading">Services<br>per Month</td>
          <td class="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider font-heading">% Paid to<br>3rd Party</td>
          <td class="px-4 py-3 text-center"></td>
          <td class="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider font-heading">Current<br>Value</td>
          <td class="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider font-heading">Additional<br>Value</td>
        `;
        tbody.appendChild(headerRow);

        // Input row
        const hmrAssumptionsHtml = service.assumptions
          ? '<span title="' + service.assumptions.replace(/"/g, "&quot;") + '" class="text-slate-400 cursor-help" aria-label="Assumptions: ' + service.assumptions.replace(/"/g, "'") + '">(i)</span>'
          : "";
        const inputRow = document.createElement("tr");
        inputRow.innerHTML = `
          <td class="px-4 py-3 font-semibold text-brand-navy" data-label="Service"><span class="service-name">${service.name}</span>${hmrAssumptionsHtml}</td>
          <td class="px-4 py-3 funded-cell font-medium" data-label="Funded Rate">${service.fundedRateDesc}</td>
          <td class="px-4 py-3 text-center" data-label="Services/Month">
            <label for="${service.id}-current" class="sr-only">Home Medication Reviews — services per month</label>
            <input type="number" class="calc-input" id="${service.id}-current" min="0" placeholder="0" aria-label="Home Medication Reviews: services per month" />
          </td>
          <td class="px-4 py-3 text-center" data-label="% to 3rd Party">
            <label for="${service.id}-3rd-party-pct" class="sr-only">Percentage paid to third party</label>
            <input type="number" class="calc-input" id="${service.id}-3rd-party-pct" min="0" max="100" placeholder="0" value="0" aria-label="Home Medication Reviews: percentage of payment paid to third party (0 to 100)" /> <span class="text-slate-400 font-bold">%</span>
          </td>
          <td class="px-4 py-3 text-center"></td>
          <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums text-brand-teal" data-label="Current Value"></td>
          <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums text-brand-amber font-bold" data-label="Additional Value"></td>
        `;
        tbody.appendChild(inputRow);

        return; // Skip standard processing
      } else if (service.customLayout && service.id === "rmmr") {
        // Custom layout for RMMR with conditional display
        // Eligibility row
        const eligibilityRow = document.createElement("tr");
        const rmmrAssumptionsHtml = service.assumptions
          ? '<span title="' + service.assumptions.replace(/"/g, "&quot;") + '" class="text-muted cursor-help" aria-label="Assumptions: ' + service.assumptions.replace(/"/g, "'") + '">(i)</span>'
          : "";
        eligibilityRow.innerHTML = `
          <td class="px-4 py-3 font-semibold text-brand-navy"><span class="service-name">${service.name}</span>${rmmrAssumptionsHtml}</td>
          <td colspan="6" class="px-4 py-3">
            <div class="flex flex-col sm:flex-row sm:items-center gap-3 bg-surface-alt p-4 rounded-xl border border-light shadow-sm">
              <label class="text-brand-navy text-sm font-medium" for="rmmr-eligible">Do you claim RMMR services through an Australian Government-funded aged care facility?</label>
              <select class="w-full sm:w-auto px-4 py-2 border border-light rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-teal focus:outline-none transition-all font-bold" id="rmmr-eligible" onchange="toggleRMMRFields()">
                <option value="No">Not yet</option>
                <option value="Yes">Yes, we do</option>
              </select>
            </div>
          </td>
        `;
        tbody.appendChild(eligibilityRow);

        // Details section (hidden by default)
        const detailsDiv = document.createElement("div");
        detailsDiv.id = "rmmr-details";
        detailsDiv.className = "hidden w-full p-6 bg-slate-50/50 rounded-2xl border border-slate-100 mt-2 shadow-inner";
        detailsDiv.innerHTML = `
          <div class="grid grid-cols-3 gap-4 font-bold text-brand-navy mb-6 font-heading uppercase text-xs tracking-widest">
            <div class="col-span-3">Residential Medication Management Review (RMMR) Details</div>
          </div>
          <div class="space-y-6">
            <div class="grid grid-cols-3 gap-6 items-center">
              <label class="text-slate-700 text-sm font-medium" for="rmmr-beds">
                Eligible aged care beds
                <p class="text-xs text-slate-400 font-normal mt-1">Enter 0 if not applicable.</p>
              </label>
              <div>
                <input type="number" class="calc-input w-full" id="rmmr-beds" min="0" placeholder="e.g. 120" aria-label="Number of eligible aged care beds serviced for RMMR" />
              </div>
              <div></div>
            </div>
            <div class="grid grid-cols-3 gap-6 items-start">
              <label class="text-slate-700 text-sm font-medium" for="current-${service.id}">
                Annual RMMR volume
                <span id="rmmr-benchmark" class="hidden block text-brand-teal text-xs italic mt-2 font-semibold">
                  Benchmark: 79 RMMRs per 100 beds per year.
                </span>
              </label>
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs text-slate-400 font-semibold uppercase">Current</span>
                </div>
                <input type="number" class="calc-input w-full" id="current-${service.id}" value="${service.currentVol}" aria-label="Current annual RMMR volume" />
              </div>
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs text-slate-400 font-semibold uppercase">Potential</span>
                </div>
                <input type="number" class="calc-input w-full" id="potential-${service.id}" value="${service.potentialVol}" aria-label="Potential annual RMMR volume" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-6 items-center">
              <div id="current-val-${service.id}" class="text-right result-cell tabular-nums text-brand-teal text-xl"></div>
              <div id="additional-val-${service.id}" class="text-right result-cell tabular-nums text-brand-amber text-xl font-bold"></div>
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
          <td class="px-4 py-3 font-semibold text-brand-navy"><span class="service-name">${service.name}</span></td>
          <td colspan="6" class="px-4 py-3">
            <div class="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
              <label class="text-brand-navy text-sm font-medium" for="qum-eligible">Do you claim QUM services through an Australian Government-funded aged care facility?</label>
              <select class="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-teal focus:outline-none transition-all font-bold" id="qum-eligible" onchange="toggleQUMFields()">
                <option value="No">Not yet</option>
                <option value="Yes">Yes, we do</option>
              </select>
            </div>
          </td>
        `;
        tbody.appendChild(eligibilityRow);

        // Details section (hidden by default)
        const detailsDiv = document.createElement("div");
        detailsDiv.id = "qum-details";
        detailsDiv.className = "hidden w-full p-6 bg-slate-50/50 rounded-2xl border border-slate-100 mt-2 shadow-inner";
        detailsDiv.innerHTML = `
          <div class="grid grid-cols-3 gap-4 font-bold text-brand-navy mb-6 font-heading uppercase text-xs tracking-widest">
            <div class="col-span-3">Quality Use of Medicines (QUM) Details</div>
          </div>
          <div class="space-y-6">
            <div class="grid grid-cols-3 gap-6 items-center">
              <label class="text-slate-700 text-sm font-medium" for="qum-beds">
                Eligible aged care beds
              </label>
              <div>
                <input type="number" class="calc-input w-full" id="qum-beds" min="0" placeholder="e.g. 80" aria-label="Number of eligible aged care beds serviced for QUM" />
              </div>
              <div></div>
            </div>
            <div class="grid grid-cols-3 gap-6 items-center">
              <div id="current-val-${service.id}" class="text-right result-cell tabular-nums text-brand-teal text-xl"></div>
              <div id="additional-val-${service.id}" class="text-right result-cell tabular-nums text-brand-amber text-xl font-bold"></div>
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
          <td class="px-4 py-3 font-semibold text-brand-navy"><span class="service-name">${service.name}</span></td>
          <td class="px-4 py-3" colspan="6">
            <div class="w-full bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div class="grid grid-cols-3 gap-6 font-bold text-brand-navy mb-6 font-heading uppercase text-[10px] tracking-widest text-center">
                <div class="p-2 border-b border-slate-200">Reference Biologic<br><span class="text-[9px] font-normal text-slate-400">(originator brand)</span></div>
                <div class="p-2 border-b border-slate-200">Biosimilar<br>Patients</div>
                <div class="p-2 border-b border-slate-200">Program Enrolled<br><span class="text-[9px] font-normal text-slate-400">(via PharmaPrograms)</span></div>
              </div>
              <div class="mb-6 text-sm text-slate-500 text-center">
                Enter the number of patients you currently dispense biologics for.
              </div>
              <div class="grid grid-cols-3 gap-6 items-center">
                <div class="text-center">
                  <label for="${service.id}-originator" class="sr-only">Reference biologic patients for ${service.name}</label>
                  <input type="number" class="calc-input w-full" id="${service.id}-originator" min="0" placeholder="0" aria-label="${service.name}: reference biologic patients (originator brand)" />
                </div>
                <div class="text-center">
                  <label for="${service.id}-biosimilar" class="sr-only">Biosimilar patients for ${service.name}</label>
                  <input type="number" class="calc-input w-full" id="${service.id}-biosimilar" min="0" placeholder="0" aria-label="${service.name}: biosimilar patients" />
                </div>
                <div class="text-center">
                  <label for="${service.id}-program" class="sr-only">Pharmacy program enrolled patients for ${service.name}</label>
                  <input type="number" class="calc-input w-full" id="${service.id}-program" min="0" placeholder="0" aria-label="${service.name}: pharmacy program enrolled patients (via PharmaPrograms)" />
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
          <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums text-brand-teal font-semibold"></td>
          <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums text-brand-amber font-bold"></td>
          <td colspan="4"></td>
        `;
        tbody.appendChild(resultRow);

        return; // Skip standard processing
      } else if (service.customLayout && service.id === "etanercept") {
        // Custom layout for Etanercept (similar to adalimumab)
        const headerRow = document.createElement("tr");
        headerRow.innerHTML = `
          <td class="px-4 py-3 font-semibold text-brand-navy"><span class="service-name">${service.name}</span></td>
          <td class="px-4 py-3" colspan="6">
            <div class="w-full bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm">
              <div class="grid grid-cols-3 gap-6 font-bold text-brand-navy mb-6 font-heading uppercase text-[10px] tracking-widest text-center">
                <div class="p-2 border-b border-slate-200">Reference Biologic<br><span class="text-[9px] font-normal text-slate-400">(originator brand)</span></div>
                <div class="p-2 border-b border-slate-200">Biosimilar<br>Patients</div>
                <div class="p-2 border-b border-slate-200">Program Enrolled<br><span class="text-[9px] font-normal text-slate-400">(via PharmaPrograms)</span></div>
              </div>
              <div class="mb-6 text-sm text-slate-500 text-center">
                Enter the number of patients you currently dispense biologics for.
              </div>
              <div class="grid grid-cols-3 gap-6 items-center">
                <div class="text-center">
                  <label for="${service.id}-originator" class="sr-only">Reference biologic patients for ${service.name}</label>
                  <input type="number" class="calc-input w-full" id="${service.id}-originator" min="0" placeholder="0" aria-label="${service.name}: reference biologic patients (originator brand)" />
                </div>
                <div class="text-center">
                  <label for="${service.id}-biosimilar" class="sr-only">Biosimilar patients for ${service.name}</label>
                  <input type="number" class="calc-input w-full" id="${service.id}-biosimilar" min="0" placeholder="0" aria-label="${service.name}: biosimilar patients" />
                </div>
                <div class="text-center">
                  <label for="${service.id}-program" class="sr-only">Pharmacy program enrolled patients for ${service.name}</label>
                  <input type="number" class="calc-input w-full" id="${service.id}-program" min="0" placeholder="0" aria-label="${service.name}: pharmacy program enrolled patients (via PharmaPrograms)" />
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
          <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums text-brand-teal font-semibold"></td>
          <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums text-brand-amber font-bold"></td>
          <td colspan="4"></td>
        `;
        tbody.appendChild(resultRow);

        return; // Skip standard processing
      }
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50/50 transition-all";

      if (service.isCombined) {
        // Layout for combined services (e.g., MedsChecks)
        const combinedAssumptionsHtml = service.assumptions
          ? '<span title="' + service.assumptions.replace(/"/g, "&quot;") + '" class="text-slate-400 cursor-help" aria-label="Assumptions: ' + service.assumptions.replace(/"/g, "'") + '">(i)</span>'
          : "";
        tr.innerHTML = `
            <td class="px-4 py-3 font-semibold text-brand-navy" data-label="Service"><span class="service-name">${service.name}</span>${combinedAssumptionsHtml}</td>
            <td class="px-4 py-3" colspan="2" data-label="Funded Rate">
                        ${service.fields.map((f) => `<div class="text-sm text-slate-600 my-2">${f.name}: <span class="font-bold text-brand-teal">${f.fundedRateDesc}</span></div>`).join("")}
                    </td>
                    <td class="px-4 py-3 text-center" data-label="Current">
                        ${service.fields.map((f) => `<div class="my-2"><label for="current-${service.id}-${f.id}" class="sr-only">${f.name} — current volume</label><input type="number" id="current-${service.id}-${f.id}" value="${f.currentVol}" class="calc-input" aria-label="${f.name}: current volume (${service.unit})"><span class="text-xs text-slate-400 ml-1 font-bold">${service.unit}</span></div>`).join("")}
                    </td>
                    <td class="px-4 py-3 text-center" data-label="Potential">
                        ${service.fields.map((f) => `<div class="my-2"><label for="potential-${service.id}-${f.id}" class="sr-only">${f.name} — potential volume</label><input type="number" id="potential-${service.id}-${f.id}" value="${f.potentialVol}" class="calc-input" aria-label="${f.name}: potential volume (${service.unit})"><span class="text-xs text-slate-400 ml-1 font-bold">${service.unit}</span></div>`).join("")}
                    </td>
                    <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums align-top pt-5 text-brand-teal" data-label="Current Value"></td>
                    <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums align-top pt-5 text-brand-amber font-bold" data-label="Additional Value"></td>
                `;
      } else {
        // Standard layout for regular services
        const stdAssumptionsHtml = service.assumptions
          ? '<span title="' + service.assumptions.replace(/"/g, "&quot;") + '" class="text-slate-400 cursor-help" aria-label="Assumptions: ' + service.assumptions.replace(/"/g, "'") + '">(i)</span>'
          : "";
        tr.innerHTML = `
            <td class="px-4 py-3 font-semibold text-brand-navy" data-label="Service"><span class="service-name">${service.name}</span>${stdAssumptionsHtml}</td>
            <td class="px-4 py-3 funded-cell font-medium" data-label="Funded Rate">${service.fundedRateDesc}</td>
                    <td class="px-4 py-3 text-center" data-label="Patient Fee (Current/Potential)">
                        <div class="flex items-center justify-center gap-2">
                            <label for="pfc-${service.id}" class="sr-only">${service.name} — current patient fee ($)</label>
                            <input type="number" id="pfc-${service.id}" value="${service.patientFeeCurrent}" class="calc-input" ${service.patientFeeCurrent === 0 && service.patientFeePotential === 0 ? "disabled" : ""} aria-label="${service.name}: current patient fee ($)" placeholder="0"> <span class="text-slate-300">/</span>
                            <label for="pfp-${service.id}" class="sr-only">${service.name} — potential patient fee ($)</label>
                            <input type="number" id="pfp-${service.id}" value="${service.patientFeePotential}" class="calc-input" ${service.patientFeeCurrent === 0 && service.patientFeePotential === 0 ? "disabled" : ""} aria-label="${service.name}: potential patient fee ($)" placeholder="0">
                        </div>
                    </td>
                    <td class="px-4 py-3 text-center" data-label="Current Volume">
                        <label for="current-${service.id}" class="sr-only">${service.name} — current volume (${service.unit})</label>
                        <input type="number" id="current-${service.id}" value="${service.currentVol}" class="calc-input" aria-label="${service.name}: current volume (${service.unit})">
                        <span class="text-xs text-slate-400 ml-1 font-bold">${service.unit}</span>
                    </td>
                    <td class="px-4 py-3 text-center" data-label="Potential Volume">
                        <label for="potential-${service.id}" class="sr-only">${service.name} — potential volume (${service.unit})</label>
                        <input type="number" id="potential-${service.id}" value="${service.potentialVol}" class="calc-input" aria-label="${service.name}: potential volume (${service.unit})">
                        <span class="text-xs text-slate-400 ml-1 font-bold">${service.unit}</span>
                    </td>
                    <td id="current-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums text-brand-teal" data-label="Current Value (Yearly)"></td>
                    <td id="additional-val-${service.id}" class="px-4 py-3 text-right result-cell tabular-nums text-brand-amber font-bold" data-label="Additional Value (Yearly)"></td>
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
  if (!serviceType) return "Moderate";
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
  // Store plan globally for download functionality
  window.currentPlan = plan;

  const planResult = document.getElementById("plan-result");
  if (!planResult) return;

  // Build initiatives HTML
  let initiativesHTML = "";
  plan.plan.forEach((initiative) => {
    initiativesHTML += `
      <div class="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all">
        <div class="flex justify-between items-start mb-4">
          <h5 class="font-bold text-xl text-brand-navy font-heading">${escapeHTML(initiative.title)}</h5>
          <span class="px-3 py-1 bg-brand-teal text-white text-xs font-bold rounded-full uppercase tracking-widest shadow-sm">Priority ${escapeHTML(initiative.priority)}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Owner</p>
            <p class="font-semibold text-brand-navy text-sm">${escapeHTML(initiative.owner_role)}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Timeline</p>
            <p class="font-semibold text-brand-navy text-sm">Week ${escapeHTML(initiative.start_week)} - ${escapeHTML(initiative.start_week + (initiative.duration_weeks || 0))}</p>
          </div>
          <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">ROI</p>
            <p class="font-semibold text-brand-teal text-sm">${escapeHTML(initiative.ROI)}</p>
          </div>
        </div>
        <div class="mb-6">
          <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">Monthly Revenue Lift</p>
          <p class="text-2xl font-bold text-brand-teal font-heading">$${(initiative.expected_monthly_revenue_lift || 0).toLocaleString()}</p>
        </div>
        <div class="mb-6">
          <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-3">Tasks</p>
          <ul class="space-y-2">
            ${initiative.tasks.map(task => `
              <li class="flex items-start gap-2 text-sm text-slate-600">
                <span class="text-brand-teal mt-1">✓</span>
                <span><strong class="text-brand-navy">${escapeHTML(task.title)}</strong> <span class="text-slate-400">(${escapeHTML(task.owner)}, ${escapeHTML(task.est_hours)}h)</span></span>
              </li>
            `).join('')}
          </ul>
        </div>
        <div class="pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
          <p><span class="font-bold text-slate-400 uppercase tracking-tighter mr-1">Difficulty:</span> ${getImplementationDifficulty(initiative.service_type || initiative.title)}</p>
          <p><span class="font-bold text-slate-400 uppercase tracking-tighter mr-1">Mitigations:</span> ${(initiative.top_2_mitigations || initiative.mitigations || []).join(", ")}</p>
        </div>
      </div>
    `;
  });

  // Build validation HTML
  let validationHTML = "<p class='text-brand-teal font-medium flex items-center gap-2'><span class='text-lg'>✓</span> No validation issues found.</p>";
  if (plan.validation && plan.validation.length > 0) {
    let issuesHTML = "";
    plan.validation.forEach((item) => {
      issuesHTML += `<li class="flex items-start gap-2">
        <span class="text-brand-amber font-bold">!</span>
        <span>${item}</span>
      </li>`;
    });
    validationHTML = `
      <p class="font-bold text-brand-amber mb-3 uppercase text-xs tracking-widest">Inconsistencies detected:</p>
      <ul class="space-y-2 text-sm text-slate-600">
        ${issuesHTML}
      </ul>
    `;
  }

  // Create the plan HTML
  planResult.innerHTML = `
    <div class="bg-white p-8 md:p-12 rounded-3xl shadow-2xl border border-slate-100">
      <div class="flex items-center gap-4 mb-8">
        <div class="bg-brand-navy text-white p-3 rounded-2xl shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 class="text-3xl font-bold text-brand-navy font-heading tracking-tight">AI-Generated Pharmacy Action Plan</h3>
      </div>

      <!-- Executive Summary -->
      <div class="mb-10 p-8 bg-brand-teal/5 rounded-3xl border border-brand-teal/10 shadow-sm">
        <h4 class="font-bold text-brand-teal mb-4 font-heading uppercase text-xs tracking-[0.2em]">📋 Executive Summary</h4>
        <p class="text-brand-navy leading-relaxed font-medium">${escapeHTML(plan.executive_summary).replace(/\n/g, "<br>")}</p>
      </div>

      <!-- Initiatives -->
      <div class="mb-12">
        <h4 class="font-bold text-brand-navy mb-6 font-heading uppercase text-xs tracking-[0.2em] flex items-center gap-2">
          <span>🎯</span> Implementation Initiatives
        </h4>
        <div class="space-y-6">
          ${initiativesHTML}
        </div>
      </div>

      <!-- Financial Breakdown -->
      <div class="mb-10 p-8 bg-brand-navy text-white rounded-3xl shadow-xl">
        <h4 class="font-bold text-teal-400 mb-6 font-heading uppercase text-xs tracking-[0.2em] flex items-center gap-2">
          <span>💰</span> Financial Breakdown
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div class="space-y-4">
            ${
              plan.overallFinancials
                ? `
              <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
                <p class="text-teal-400 text-[10px] font-bold uppercase tracking-widest mb-1">Payback Period</p>
                <p class="text-2xl font-bold font-heading">${plan.overallFinancials.paybackArithmetic || "N/A"}</p>
              </div>
              <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
                <p class="text-teal-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total ROI</p>
                <p class="text-2xl font-bold font-heading text-brand-amber">${plan.overallFinancials.roiArithmetic || "N/A"}</p>
              </div>
            `
                : `
              <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
                <p class="text-teal-400 text-[10px] font-bold uppercase tracking-widest mb-1">Payback Period</p>
                <p class="text-2xl font-bold font-heading">${plan.financial_breakdown && plan.financial_breakdown.payback_period_months ? plan.financial_breakdown.payback_period_months.toFixed(1) + ' months' : "N/A"}</p>
              </div>
            `
            }
          </div>
          <div class="space-y-4">
            <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
              <p class="text-teal-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Monthly Revenue Lift</p>
              <p class="text-3xl font-bold font-heading text-teal-400 tabular-nums">$${(typeof (plan.overallFinancials?.monthlyRevenueLift) === "number" ? plan.overallFinancials.monthlyRevenueLift : (plan.financial_breakdown?.overall?.monthly_revenue_lift_total) || 0).toLocaleString()}</p>
            </div>
            <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
              <p class="text-teal-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Investment</p>
              <p class="text-2xl font-bold font-heading tabular-nums">$${(typeof (plan.overallFinancials?.totalInvestment) === "number" ? plan.overallFinancials.totalInvestment : (plan.financial_breakdown?.overall?.one_time_total) || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div class="mt-8 pt-6 border-t border-white/10">
          <pre class="text-[10px] font-mono text-slate-400 whitespace-pre-wrap">${escapeHTML(plan.overallFinancials?.roiArithmetic || (plan.financial_breakdown?.arithmetic) || "Details not available")}</pre>
        </div>
      </div>

      <!-- Validation & Notes -->
      <div class="p-8 bg-brand-amber/5 rounded-3xl border border-brand-amber/10 shadow-sm">
        <h4 class="font-bold text-brand-amber mb-4 font-heading uppercase text-xs tracking-[0.2em] flex items-center gap-2">
          <span>⚠️</span> Validation & Notes
        </h4>
        <div class="text-sm text-slate-700">
          ${validationHTML}
          ${plan.notes ? `<div class="mt-4 pt-4 border-t border-brand-amber/10 italic text-slate-500">${escapeHTML(plan.notes)}</div>` : ""}
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
      <p class="text-sm text-gray-600 mb-2">Checksum: <span class="font-mono">${escapeHTML(plan.metadata && plan.metadata.checksum ? plan.metadata.checksum : "N/A")}</span></p>
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
 * Download plan functionality with multiple format options
 */
export function downloadPlan() {
  const planResult = document.getElementById("plan-result");
  if (!planResult || planResult.classList.contains("hidden")) {
    alert("No plan to download. Please generate a plan first.");
    return;
  }

  // Extract plan data from the displayed result
  const plan = window.currentPlan;
  if (!plan) {
    alert("Plan data not found. Please generate a plan first.");
    return;
  }

  // Create a modal with download options
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
  modal.innerHTML = `
    <div class="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-100">
      <h3 class="text-2xl font-bold text-brand-navy mb-4 font-heading tracking-tight text-center">Download Action Plan</h3>
      <p class="text-slate-500 text-sm mb-8 text-center">Select your preferred professional format for distribution or archiving.</p>
      
      <div class="space-y-4">
        <button
          class="w-full px-6 py-4 bg-brand-teal hover:bg-teal-700 text-white rounded-2xl font-bold transition-all shadow-md flex items-center justify-between group"
          onclick="downloadPlanAsHTML()"
        >
          <span>📄 Download as HTML</span>
          <span class="text-white/50 group-hover:translate-x-1 transition-all">→</span>
        </button>
        
        <button
          class="w-full px-6 py-4 bg-brand-navy hover:bg-slate-800 text-white rounded-2xl font-bold transition-all shadow-md flex items-center justify-between group"
          onclick="downloadPlanAsPDF()"
        >
          <span>📕 Download as PDF</span>
          <span class="text-white/50 group-hover:translate-x-1 transition-all">→</span>
        </button>
        
        <button
          class="w-full px-6 py-4 bg-white border-2 border-slate-100 hover:border-brand-amber/30 text-slate-600 hover:text-brand-amber rounded-2xl font-bold transition-all flex items-center justify-between group"
          onclick="downloadPlanAsCSV()"
        >
          <span>📊 Calculator Data (CSV)</span>
          <span class="text-slate-200 group-hover:translate-x-1 transition-all">→</span>
        </button>
        
        <button
          class="w-full px-6 py-4 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl font-bold transition-all mt-4"
          onclick="window.closePlanDownloadModal()"
        >
          Cancel
        </button>
      </div>
      
      <p class="text-[10px] text-slate-400 mt-8 text-center uppercase tracking-widest font-bold">
        PharmIQ | Infrastructure for Choice
      </p>
    </div>
  `;

  document.body.appendChild(modal);
  window.currentDownloadModal = modal;

  // Expose download functions to window
  window.downloadPlanAsHTML = () => {
    downloadPlanHTML(plan);
    window.closePlanDownloadModal();
  };

  window.downloadPlanAsPDF = () => {
    downloadPlanPDF(plan);
    window.closePlanDownloadModal();
  };

  window.downloadPlanAsCSV = () => {
    downloadPlanCSV(plan);
    window.closePlanDownloadModal();
  };

  window.closePlanDownloadModal = () => {
    const m = window.currentDownloadModal;
    if (m && m.parentNode) {
      m.parentNode.removeChild(m);
    }
  };
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
    '<h3 class="text-xl font-bold mb-4 font-heading text-brand-navy">Definitions & Rate Sources</h3>';
  html +=
    '<p class="text-xs text-slate-400 mb-6 uppercase tracking-widest font-bold">Last updated: October 2024 (based on 8CPA guidelines)</p>';

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

  html += '<ul class="space-y-3 text-sm text-slate-600 mb-8">';
  Object.entries(rates).forEach(([rate, services]) => {
    html += `<li class="flex items-start gap-2"><span class="text-brand-teal font-bold">•</span><span><strong class="text-brand-navy">${escapeHTML(services.join(", "))}:</strong> ${escapeHTML(rate)}</span></li>`;
  });
  html += "</ul>";
  html +=
    '<button onclick="copyDebugInfo()" class="px-6 py-3 bg-brand-navy hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-md text-sm">Copy Debug Information</button>';

  provenanceEl.innerHTML = html;
}
