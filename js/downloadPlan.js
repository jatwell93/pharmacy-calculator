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
    const tbody = document.getElementById(`${partKey}-body`);
    if (!tbody) return;

    data.sections[partKey] = {
      name: partNames[partKey],
      items: [],
    };

    // Parse rows from the table body
    const rows = tbody.querySelectorAll("tr");
    let currentService = null;

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
  <title>Pharmacy Implementation Plan</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      line-height: 1.6;
      background: white;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      text-align: center;
      border-bottom: 3px solid #0066cc;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    h1 {
      font-size: 32px;
      color: #0066cc;
      margin-bottom: 5px;
    }
    
    .subtitle {
      font-size: 14px;
      color: #666;
      margin: 5px 0;
    }
    
    h2 {
      font-size: 20px;
      color: #0066cc;
      margin-top: 30px;
      margin-bottom: 15px;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 10px;
    }
    
    h3 {
      font-size: 16px;
      color: #333;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    
    .section {
      margin-bottom: 25px;
    }
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .card {
      background: #f5f5f5;
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    
    .card-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    
    .card-value {
      font-size: 22px;
      font-weight: bold;
      color: #0066cc;
    }
    
    .executive-summary {
      background: #e6f2ff;
      border-left: 4px solid #0066cc;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    
    .executive-summary p {
      margin-bottom: 10px;
    }
    
    .initiative {
      border-left: 4px solid #28a745;
      background: #f9f9f9;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 4px;
    }
    
    .initiative-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    
    .initiative-title {
      font-weight: bold;
      font-size: 16px;
      color: #333;
    }
    
    .priority-badge {
      background: #28a745;
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      white-space: nowrap;
    }
    
    .initiative-details {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 10px;
      font-size: 13px;
    }
    
    .detail-item {
      background: white;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #e0e0e0;
    }
    
    .detail-label {
      color: #666;
      font-size: 11px;
      text-transform: uppercase;
    }
    
    .detail-value {
      font-weight: bold;
      color: #333;
      margin-top: 3px;
    }
    
    .task-list {
      margin-top: 10px;
    }
    
    .task-list ul {
      margin-left: 20px;
      font-size: 13px;
    }
    
    .task-list li {
      margin-bottom: 5px;
      color: #555;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 13px;
    }
    
    th {
      background: #0066cc;
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: 600;
    }
    
    td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
    }
    
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    
    .text-right {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .financial-breakdown {
      background: #e6ffe6;
      border-left: 4px solid #28a745;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    
    .financial-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    
    .financial-label {
      color: #333;
    }
    
    .financial-value {
      font-weight: bold;
      color: #28a745;
    }
    
    .validation-box {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin-bottom: 20px;
      border-radius: 4px;
      font-size: 13px;
    }
    
    .validation-box ul {
      margin-left: 20px;
      margin-top: 10px;
    }
    
    .validation-box li {
      margin-bottom: 5px;
      color: #555;
    }
    
    .calculator-section {
      page-break-before: always;
      margin-top: 30px;
    }
    
    .calculator-data {
      font-size: 12px;
    }
    
    .calculator-data table td {
      padding: 8px;
      font-size: 12px;
    }
    
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 11px;
      color: #999;
    }
    
    @media print {
      body {
        background: white;
      }
      .container {
        max-width: 100%;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>Pharmacy Implementation Plan</h1>
      <p class="subtitle">AI-Generated Action Plan & Financial Analysis</p>
      <p class="subtitle">Generated: ${currentDate}</p>
    </div>
    
    <!-- Calculator Totals Summary -->
    <div class="summary-cards">
      <div class="card">
        <div class="card-label">Estimated Current Value (Yearly)</div>
        <div class="card-value">${calculatorData.totals.currentValue}</div>
      </div>
      <div class="card">
        <div class="card-label">Estimated Additional Value (Yearly)</div>
        <div class="card-value">${calculatorData.totals.additionalValue}</div>
      </div>
      <div class="card">
        <div class="card-label">Estimated Total Value (Yearly)</div>
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
      <h2>Implementation Initiatives</h2>
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
              <div class="detail-label">Timeline</div>
              <div class="detail-value">${
                initiative.start_week && initiative.duration_weeks
                  ? `Week ${initiative.start_week} - ${initiative.start_week + initiative.duration_weeks}`
                  : "TBD"
              }</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Monthly Revenue Lift</div>
              <div class="detail-value">$${(initiative.expected_monthly_revenue_lift || 0).toLocaleString()}</div>
            </div>
          </div>
          
          <div class="initiative-details">
            <div class="detail-item">
              <div class="detail-label">ROI</div>
              <div class="detail-value">${initiative.ROI || "TBD"}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Investment</div>
              <div class="detail-value">$${(initiative.one_time_cost || 0).toLocaleString()}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Difficulty</div>
              <div class="detail-value">${getImplementationDifficulty(initiative.service_type)}</div>
            </div>
          </div>
          
          ${
            initiative.tasks && initiative.tasks.length > 0
              ? `
            <div class="task-list">
              <strong style="font-size: 13px;">Tasks:</strong>
              <ul>
                ${initiative.tasks
                  .map(
                    (task) => `
                  <li><strong>${task.title || "Task"}</strong> (${task.owner || "TBD"}, ${task.est_hours || "0"}h) - ${task.acceptance_criteria || "No criteria specified"}</li>
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
              ? `<p style="margin-top: 10px; font-size: 13px;"><strong>Risk Mitigations:</strong> ${initiative.mitigations.join(", ")}</p>`
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
      <h2>Financial Breakdown</h2>
      <div class="financial-breakdown">
        ${
          plan.overallFinancials
            ? `
          ${
            plan.overallFinancials.paybackArithmetic
              ? `<div class="financial-item"><span class="financial-label">Payback Analysis:</span><span class="financial-value">${plan.overallFinancials.paybackArithmetic}</span></div>`
              : ""
          }
          ${
            plan.overallFinancials.roiArithmetic
              ? `<div class="financial-item"><span class="financial-label">ROI Analysis:</span><span class="financial-value">${plan.overallFinancials.roiArithmetic}</span></div>`
              : ""
          }
          <div class="financial-item"><span class="financial-label">Total Monthly Revenue Lift:</span><span class="financial-value">$${(plan.overallFinancials.monthlyRevenueLift || 0).toLocaleString()}</span></div>
          <div class="financial-item"><span class="financial-label">Total Investment Required:</span><span class="financial-value">$${(plan.overallFinancials.totalInvestment || 0).toLocaleString()}</span></div>
        `
            : plan.financial_breakdown
              ? `
          ${plan.financial_breakdown.payback_period_months ? `<div class="financial-item"><span class="financial-label">Payback Period:</span><span class="financial-value">${plan.financial_breakdown.payback_period_months.toFixed(1)} months</span></div>` : ""}
          <div class="financial-item"><span class="financial-label">Total One-Time Costs:</span><span class="financial-value">$${(plan.financial_breakdown.total_one_time_costs || 0).toLocaleString()}</span></div>
          <div class="financial-item"><span class="financial-label">Total Annual Recurring Costs:</span><span class="financial-value">$${(plan.financial_breakdown.total_recurring_costs || 0).toLocaleString()}</span></div>
          <div class="financial-item"><span class="financial-label">Total Monthly Revenue Lift:</span><span class="financial-value">$${(plan.financial_breakdown.total_monthly_revenue_lift || 0).toLocaleString()}</span></div>
        `
              : ""
        }
      </div>
      
      ${
        plan.financial_breakdown && plan.financial_breakdown.arithmetic
          ? `
        <h3>Financial Calculation Details</h3>
        <div style="background: #f9f9f9; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; overflow-x: auto;">
${plan.financial_breakdown.arithmetic}
        </div>
      `
          : ""
      }
    </div>
    
    <!-- Validation & Notes -->
    ${
      plan.validation && plan.validation.length > 0
        ? `
      <div class="section">
        <h2>Validation & Notes</h2>
        <div class="validation-box">
          <strong>Validation Results:</strong>
          <ul>
            ${plan.validation.map((issue) => `<li>${issue}</li>`).join("")}
          </ul>
          ${plan.notes ? `<p style="margin-top: 10px;"><strong>Additional Notes:</strong> ${plan.notes}</p>` : ""}
        </div>
      </div>
    `
        : ""
    }
    
    <!-- User Preferences -->
    <div class="section">
      <h2>Plan Configuration</h2>
      <table>
        <tbody>
          <tr>
            <td><strong>Max Investment:</strong></td>
            <td>$${calculatorData.userPreferences.maxInvestment}</td>
          </tr>
          <tr>
            <td><strong>Time Horizon:</strong></td>
            <td>${calculatorData.userPreferences.timeHorizon} months</td>
          </tr>
          <tr>
            <td><strong>Detail Level:</strong></td>
            <td>${calculatorData.userPreferences.detailLevel}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Calculator Data Appendix -->
    <div class="section calculator-section">
      <h2>Calculator Data Snapshot</h2>
      <p style="font-size: 13px; color: #666; margin-bottom: 15px;">
        This section contains the detailed calculator input and output data that was used to generate this plan.
      </p>
      
      ${Object.entries(calculatorData.sections)
        .map(
          ([key, section]) => `
        <h3>${section.name}</h3>
        <div class="calculator-data">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Funded Rate</th>
                <th>Current Value</th>
                <th>Additional Value</th>
              </tr>
            </thead>
            <tbody>
              ${section.items
                .map(
                  (item) => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.fundedRate}</td>
                  <td class="text-right">${item.currentValue}</td>
                  <td class="text-right">${item.additionalValue}</td>
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
      <p>This plan was generated using the Pharmacy Opportunity Analysis Calculator.</p>
      <p>For questions or updates, please contact your pharmacy operations team.</p>
      <p>Document generated: ${currentDate}</p>
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
    link.download = `pharmacy-plan-${new Date().toISOString().split("T")[0]}.html`;
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

    // Open a new window with the HTML
    const printWindow = window.open("", "_blank");
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load, then trigger print dialog
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        // Note: After printing, user should save as PDF from the print dialog
        // Or they can close the window - the file will be saved based on browser print settings
      }, 500);
    };
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

    let csv = "Pharmacy Implementation Plan - Calculator Data\n\n";

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
    link.download = `pharmacy-calculator-${new Date().toISOString().split("T")[0]}.csv`;
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
