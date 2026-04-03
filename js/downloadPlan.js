// Download Plan Functionality
// This file handles downloading the AI plan and calculator data as a PDF/document

/**
 * Collect all calculator data from the current UI state
 * @returns {Object} Complete calculator data snapshot
 */
function collectCalculatorData() {
  const data = {
    totals: {
      currentValue: document.getElementById("total-current-value")?.textContent || "$0.00",
      additionalValue: document.getElementById("total-additional-value")?.textContent || "$0.00",
      totalValue: document.getElementById("total-potential-value")?.textContent || "$0.00",
    },
    userPreferences: {
      maxInvestment: document.getElementById("max-investment")?.value || "15000",
      timeHorizon: document.getElementById("time-horizon")?.value || "12",
      detailLevel: document.getElementById("detail-level")?.value || "detailed",
    },
    sections: {},
    timestamp: new Date().toISOString(),
  };

  // Collect data by part
  const partNames = {
    part1: "Government-Funded Programs",
    part2: "Vaccinations",
    part3: "Pharmacy Programs & Services",
    part4: "Biologics Dispensary Opportunity",
  };

  Object.keys(partNames).forEach((partKey) => {
    const tbody = document.getElementById(`${partKey}-rows`);
    if (!tbody) return;

    data.sections[partKey] = {
      name: partNames[partKey],
      items: [],
    };

    // Parse rows from the table body
    const rows = tbody.querySelectorAll("tr");

    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (!cells.length) return;

      // Check if it's a header row
      if (cells[0].colSpan && cells[0].textContent.includes(":")) {
        return; // Skip category headers
      }

      // For each row, collect the data
      const inputs = row.querySelectorAll("input");
      const resultCells = row.querySelectorAll(".result-cell");

      if (inputs.length > 0 || resultCells.length > 0) {
        const serviceName = cells[0]?.textContent?.trim().replace("ℹ️", "").trim() || "Unknown Service";
        const fundedRate = cells[1]?.textContent?.trim() || "N/A";
        const currentValue = resultCells[0]?.textContent?.trim() || "$0.00";
        const additionalValue = resultCells[1]?.textContent?.trim() || "$0.00";

        const inputValues = {};
        inputs.forEach((input) => {
          inputValues[input.id] = input.value;
        });

        // Only add items that have actual values
        if (inputs.length > 0 || (currentValue !== "$0.00" && additionalValue !== "$0.00")) {
          data.sections[partKey].items.push({
            name: serviceName,
            fundedRate,
            currentValue,
            additionalValue,
            inputs: inputValues,
          });
        }
      }
    });
  });

  return data;
}

/**
 * Generate HTML content for the plan document
 * @param {Object} plan - The AI-generated plan
 * @param {Object} calculatorData - The calculator data snapshot
 * @returns {string} HTML string for the document
 */
function generatePlanHTML(plan, calculatorData) {
  const currentDate = new Date().toLocaleDateString("en-AU");
  
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PharmIQ | Implementation Plan</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #0F172A;
      line-height: 1.6;
      background: #F8FAFC;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    .header {
      text-align: left;
      border-bottom: 4px solid #0F766E;
      padding-bottom: 30px;
      margin-bottom: 40px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    
    h1 {
      font-size: 36px;
      color: #0F766E;
      margin-bottom: 5px;
      font-family: 'Space Grotesk', sans-serif;
      letter-spacing: -0.02em;
    }
    
    .tagline {
      font-size: 14px;
      color: #0F172A;
      font-weight: 600;
      margin-bottom: 5px;
    }
    
    .subtitle {
      font-size: 13px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 700;
    }
    
    h2 {
      font-size: 24px;
      color: #0F172A;
      margin-top: 40px;
      margin-bottom: 20px;
      font-family: 'Space Grotesk', sans-serif;
      letter-spacing: -0.01em;
    }
    
    h3 {
      font-size: 18px;
      color: #0F172A;
      margin-top: 25px;
      margin-bottom: 12px;
      font-weight: 700;
    }
    
    .section {
      margin-bottom: 35px;
    }
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .card {
      background: white;
      border: 1px solid #E2E8F0;
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .card-teal { background: #F0FDFA; border-color: #CCFBF1; }
    .card-amber { background: #FFFBEB; border-color: #FDE68A; }
    .card-navy { background: #0F172A; color: white; }
    
    .card-label {
      font-size: 10px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 800;
      margin-bottom: 8px;
    }
    
    .card-navy .card-label { color: #94A3B8; }
    
    .card-value {
      font-size: 24px;
      font-weight: 800;
      color: #0F172A;
    }
    
    .card-navy .card-value { color: white; }
    
    .executive-summary {
      background: #F0FDFA;
      border-left: 6px solid #0F766E;
      padding: 25px;
      margin-bottom: 30px;
      border-radius: 12px;
      font-weight: 500;
    }
    
    .executive-summary p {
      margin-bottom: 15px;
    }
    
    .initiative {
      border: 1px solid #E2E8F0;
      background: white;
      padding: 25px;
      margin-bottom: 20px;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .initiative-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 1px solid #F1F5F9;
    }
    
    .initiative-title {
      font-weight: 800;
      font-size: 18px;
      color: #0F172A;
    }
    
    .priority-badge {
      background: #0F766E;
      color: white;
      padding: 6px 12px;
      border-radius: 99px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .initiative-details {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 15px;
    }
    
    .detail-item {
      background: #F8FAFC;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #F1F5F9;
    }
    
    .detail-label {
      color: #94A3B8;
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 800;
      letter-spacing: 0.05em;
    }
    
    .detail-value {
      font-weight: 700;
      color: #0F172A;
      margin-top: 4px;
      font-size: 14px;
    }
    
    .task-list {
      margin-top: 20px;
      background: #F8FAFC;
      padding: 15px;
      border-radius: 8px;
    }
    
    .task-list ul {
      margin-left: 5px;
      list-style: none;
      font-size: 13px;
    }
    
    .task-list li {
      margin-bottom: 8px;
      color: #475569;
      display: flex;
      gap: 10px;
    }
    
    .task-list li::before {
      content: "✓";
      color: #0F766E;
      font-weight: 800;
    }
    
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-bottom: 20px;
      font-size: 13px;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      overflow: hidden;
    }
    
    th {
      background: #F8FAFC;
      color: #64748B;
      padding: 12px 15px;
      text-align: left;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #E2E8F0;
    }
    
    td {
      padding: 12px 15px;
      border-bottom: 1px solid #F1F5F9;
      background: white;
    }
    
    tr:last-child td {
      border-bottom: none;
    }
    
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    
    .financial-breakdown {
      background: #0F172A;
      color: white;
      padding: 30px;
      margin-bottom: 30px;
      border-radius: 20px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }
    
    .financial-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    
    .fin-card {
      background: rgba(255,255,255,0.05);
      padding: 15px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    
    .financial-label {
      color: #94A3B8;
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 800;
      margin-bottom: 5px;
    }
    
    .financial-value {
      font-weight: 800;
      color: #2DD4BF;
      font-size: 20px;
    }
    
    .roi-value { color: #F59E0B; }
    
    .validation-box {
      background: #FFFBEB;
      border-left: 6px solid #D97706;
      padding: 20px;
      margin-bottom: 30px;
      border-radius: 12px;
      font-size: 13px;
    }
    
    .validation-box ul {
      margin-left: 20px;
      margin-top: 10px;
    }
    
    .calculator-section {
      page-break-before: always;
      margin-top: 50px;
    }
    
    .footer {
      margin-top: 60px;
      padding-top: 30px;
      border-top: 1px solid #E2E8F0;
      text-align: center;
      font-size: 11px;
      color: #94A3B8;
    }
    
    .brand-accent { color: #0F766E; font-weight: 800; }
    
    @media print {
      body { background: white; }
      .container { max-width: 100%; padding: 0; }
      .initiative, .card, .financial-breakdown { box-shadow: none; border: 1px solid #EEE; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div>
        <h1>PharmIQ</h1>
        <p class="tagline">Infrastructure for Choice. Clarity for Growth.</p>
        <p class="subtitle">Implementation Action Plan</p>
      </div>
      <div style="text-align: right;">
        <p style="font-size: 12px; color: #64748B; font-weight: 700;">DOCUMENT ID: PIQ-${Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
        <p style="font-size: 12px; color: #64748B;">GENERATED: ${currentDate}</p>
      </div>
    </div>
    
    <!-- Calculator Totals Summary -->
    <div class="summary-cards">
      <div class="card card-teal">
        <div class="card-label">Est. Current Value (Yearly)</div>
        <div class="card-value">${calculatorData.totals.currentValue}</div>
      </div>
      <div class="card card-amber">
        <div class="card-label">Est. Additional Value (Yearly)</div>
        <div class="card-value">${calculatorData.totals.additionalValue}</div>
      </div>
      <div class="card card-navy">
        <div class="card-label">Total Potential Value (Yearly)</div>
        <div class="card-value">${calculatorData.totals.totalValue}</div>
      </div>
    </div>
    
    <!-- Executive Summary -->
    ${
      plan.executive_summary
        ? `
      <div class="section">
        <h2>Executive Summary</h2>
        <div class="executive-summary">
          <p>${plan.executive_summary.replace(/\n/g, "</p><p>")}</p>
        </div>
      </div>
    `
        : ""
    }
    
    <!-- Implementation Initiatives -->
    <div class="section">
      <h2>Strategic Initiatives</h2>
      ${
        plan.plan && plan.plan.length > 0
          ? plan.plan
              .map(
                (initiative) => `
        <div class="initiative">
          <div class="initiative-header">
            <div class="initiative-title">${initiative.title || "Untitled Initiative"}</div>
            <div class="priority-badge">Priority ${initiative.priority || "N/A"}</div>
          </div>
          
          <div class="initiative-details">
            <div class="detail-item">
              <div class="detail-label">Owner Role</div>
              <div class="detail-value">${initiative.owner_role || "TBD"}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Implementation Window</div>
              <div class="detail-value">${
                initiative.start_week && initiative.duration_weeks
                  ? `Week ${initiative.start_week} - ${initiative.start_week + initiative.duration_weeks}`
                  : "TBD"
              }</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Monthly Revenue Lift</div>
              <div class="detail-value" style="color: #0F766E;">$${(initiative.expected_monthly_revenue_lift || 0).toLocaleString()}</div>
            </div>
          </div>
          
          <div class="initiative-details">
            <div class="detail-item">
              <div class="detail-label">Projected ROI</div>
              <div class="detail-value" style="color: #D97706;">${initiative.ROI || "TBD"}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Required Investment</div>
              <div class="detail-value">$${(initiative.one_time_cost || 0).toLocaleString()}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Complexity</div>
              <div class="detail-value">${getImplementationDifficulty(initiative.service_type)}</div>
            </div>
          </div>
          
          ${
            initiative.tasks && initiative.tasks.length > 0
              ? `
            <div class="task-list">
              <p class="detail-label" style="margin-bottom: 10px;">ACTION TASKS:</p>
              <ul>
                ${initiative.tasks
                  .map(
                    (task) => `
                  <li><strong>${task.title || "Task"}</strong> <span style="color: #94A3B8; font-size: 11px;">(${task.owner || "TBD"}, ${task.est_hours || "0"}h)</span></li>
                `,
                  )
                  .join("")}
              </ul>
            </div>
          `
              : ""
          }
          
          ${
            initiative.mitigations && initiative.mitigations.length > 0
              ? `<p style="margin-top: 15px; font-size: 11px; color: #64748B;"><strong>RISK MITIGATIONS:</strong> ${initiative.mitigations.join(", ")}</p>`
              : ""
          }
        </div>
      `,
              )
              .join("")
          : `<p class="text-gray-600">No initiatives in plan.</p>`
      }
    </div>
    
    <!-- Financial Breakdown -->
    <div class="section">
      <h2>Financial Performance Summary</h2>
      <div class="financial-breakdown">
        <div class="financial-grid">
          ${
            plan.overallFinancials
              ? `
            <div class="fin-card">
              <div class="financial-label">Payback Period Analysis</div>
              <div class="financial-value">${plan.overallFinancials.paybackArithmetic || "N/A"}</div>
            </div>
            <div class="fin-card">
              <div class="financial-label">Total ROI Projection</div>
              <div class="financial-value roi-value">${plan.overallFinancials.roiArithmetic || "N/A"}</div>
            </div>
            <div class="fin-card">
              <div class="financial-label">Monthly Revenue Growth</div>
              <div class="financial-value">$${(plan.overallFinancials.monthlyRevenueLift || 0).toLocaleString()}</div>
            </div>
            <div class="fin-card">
              <div class="financial-label">Total Implementation Capital</div>
              <div class="financial-value">$${(plan.overallFinancials.totalInvestment || 0).toLocaleString()}</div>
            </div>
          `
              : plan.financial_breakdown
                ? `
            <div class="fin-card">
              <div class="financial-label">Payback Period</div>
              <div class="financial-value">${plan.financial_breakdown.payback_period_months ? plan.financial_breakdown.payback_period_months.toFixed(1) + ' months' : "N/A"}</div>
            </div>
            <div class="fin-card">
              <div class="financial-label">Total Monthly Revenue Lift</div>
              <div class="financial-value">$${(plan.financial_breakdown.total_monthly_revenue_lift || 0).toLocaleString()}</div>
            </div>
          `
                : ""
          }
        </div>
        
        ${
          plan.financial_breakdown && plan.financial_breakdown.arithmetic
            ? `
          <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); font-family: monospace; font-size: 10px; color: #94A3B8; white-space: pre-wrap;">
PROJECTION BASIS:
${plan.financial_breakdown.arithmetic}
          </div>
        `
            : ""
        }
      </div>
    </div>
    
    <!-- Validation & Notes -->
    ${
      plan.validation && plan.validation.length > 0
        ? `
      <div class="section">
        <h2>Professional Assurance Validation</h2>
        <div class="validation-box">
          <strong class="detail-label" style="color: #92400E; display: block; margin-bottom: 10px;">VALIDATION CHECKS:</strong>
          <ul>
            ${plan.validation.map((issue) => `<li>${issue}</li>`).join("")}
          </ul>
          ${plan.notes ? `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #FDE68A; font-style: italic;">${plan.notes}</div>` : ""}
        </div>
      </div>
    `
        : ""
    }
    
    <!-- Calculator Data Appendix -->
    <div class="section calculator-section">
      <h2>Appendix: Opportunity Analysis Data</h2>
      <p style="font-size: 12px; color: #64748B; margin-bottom: 20px;">
        The following data was provided by the operator and used as the mathematical basis for this PharmIQ Strategic Action Plan.
      </p>
      
      ${Object.entries(calculatorData.sections)
        .map(
          ([key, section]) => `
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B;">${section.name}</h3>
        <div class="calculator-data">
          <table>
            <thead>
              <tr>
                <th>Service Name</th>
                <th>8CPA Funded Rate</th>
                <th class="text-right">Current Value</th>
                <th class="text-right">Additional Opportunity</th>
              </tr>
            </thead>
            <tbody>
              ${section.items
                .map(
                  (item) => `
                <tr>
                  <td style="font-weight: 600; color: #0F172A;">${item.name}</td>
                  <td>${item.fundedRate}</td>
                  <td class="text-right">${item.currentValue}</td>
                  <td class="text-right" style="font-weight: 700; color: #0F766E;">${item.additionalValue}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `,
        )
        .join("")}
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>This professional assurance plan was generated by <span class="brand-accent">PharmIQ</span> — Infrastructure for Choice. Clarity for Growth.</p>
      <p style="margin-top: 5px;">&copy; 2026 PharmIQ Operations. All rights reserved.</p>
      <p style="margin-top: 15px; font-size: 9px; color: #CBD5E1;">PRIVACY NOTICE: This document contains confidential operational data. Ensure secure distribution. No data is stored on PharmIQ servers.</p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Determine implementation difficulty based on service type
 */
function getImplementationDifficulty(serviceType) {
  if (!serviceType) return "Moderate";
  const easy = ["vaccinations", "app enrollments", "consultations"];
  const moderate = ["hmrs", "daas", "staged supply"];
  const complex = ["rmmrs", "biosimilars"];

  const type = serviceType.toLowerCase();
  if (easy.some((s) => type.includes(s))) return "Easy";
  if (moderate.some((s) => type.includes(s))) return "Moderate";
  if (complex.some((s) => type.includes(s))) return "Complex";
  return "Moderate";
}

/**
 * Download the plan as an HTML file
 * @param {Object} plan - The AI-generated plan
 */
export function downloadPlanHTML(plan) {
  try {
    // Collect current calculator data
    const calculatorData = collectCalculatorData();

    // Generate HTML content
    const htmlContent = generatePlanHTML(plan, calculatorData);

    // Create blob and download
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pharmiq-plan-${new Date().toISOString().split("T")[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    console.log("Plan downloaded successfully!");
  } catch (error) {
    console.error("Error downloading plan:", error);
    alert("Error downloading plan: " + error.message);
  }
}

/**
 * Download the plan as a PDF using browser's print-to-PDF functionality
 * @param {Object} plan - The AI-generated plan
 */
export async function downloadPlanPDF(plan) {
  try {
    // Collect current calculator data
    const calculatorData = collectCalculatorData();

    // Generate HTML content
    const htmlContent = generatePlanHTML(plan, calculatorData);

    // Create a Blob and URL for the content to avoid document.write
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    // Open a new window with the URL
    const printWindow = window.open(url, "_blank");

    // Clean up the URL after opening
    if (printWindow) {
      // Trigger print dialog when loaded
      printWindow.addEventListener("load", () => {
        setTimeout(() => {
          printWindow.print();
          URL.revokeObjectURL(url);
        }, 500);
      });
    }
  } catch (error) {
    console.error("Error preparing PDF download:", error);
    alert("Error preparing PDF: " + error.message);
  }
}

/**
 * Download plan as CSV (for calculator data)
 * @param {Object} plan - The AI-generated plan
 */
export function downloadPlanCSV(plan) {
  try {
    const calculatorData = collectCalculatorData();

    let csv = "PharmIQ Implementation Plan - Calculator Data\n\n";

    // Add summary
    csv += "SUMMARY\n";
    csv += `Current Value (Yearly),Additional Value (Yearly),Total Value (Yearly)\n`;
    csv += `${calculatorData.totals.currentValue},${calculatorData.totals.additionalValue},${calculatorData.totals.totalValue}\n\n`;

    // Add each section
    Object.entries(calculatorData.sections).forEach(([key, section]) => {
      csv += `${section.name}\n`;
      csv += `Service,Funded Rate,Current Value,Additional Value\n`;
      section.items.forEach((item) => {
        csv += `"${item.name}","${item.fundedRate}","${item.currentValue}","${item.additionalValue}"\n`;
      });
      csv += "\n";
    });

    // Create blob and download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pharmiq-calculator-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    console.log("Calculator data exported as CSV!");
  } catch (error) {
    console.error("Error downloading CSV:", error);
    alert("Error downloading CSV: " + error.message);
  }
}
