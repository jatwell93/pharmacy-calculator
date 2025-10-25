# Tasks to Fix Calculation Errors in Pharmacy Calculator

## Introduction

Based on the detailed analysis in `caclulation-errors.md`, this document outlines a prioritized list of tasks to resolve discrepancies in the financial calculations of the pharmacy calculator. The primary issues stem from modifications during the "vibe coding" process, which introduced non-original fields such as `recurringCostAnnual` and `oneTimeCost`. These additions have altered the core revenue calculations and led to mismatches in summary totals (e.g., `totalOneTimeCost = 585,000 AUD` and `totalRecurringCostAnnual = 504,000 AUD` do not align with sums from selected initiatives or `topDrivers`).

The original calculator (as in `original_calc.html`) is purely revenue-focused, calculating deltas based on funded rates, patient fees, and volumes—no per-service costs like `oneTimeCost` or `recurringCostAnnual` exist. The only financial input is a user-entered one-off annual investment (total, not per-service), used for overall ROI/payback. Modifications added invalid per-service costs, altering core logic. Financial extensions must be optional, use only the total investment, and align with `caclulation-errors.md`. The goal is to:
- Revert unauthorized changes to preserve original revenue logic.
- Make financial metrics consistent and computable (e.g., selected initiatives: monthly lift = 12,132 AUD, one-time costs = 105,000 AUD, recurring annual = 107,000 AUD).
- Add explicit flags, scopes, and validations to prevent LLM confusion.
- Ensure all arithmetic is transparent and verifiable.
- Introduce safeguards (e.g., `financial_mode` flag, forbidden key checks) to prevent re-introduction of per-service costs.

Search results and `original_calc.html` review confirm issues: original `servicesData` in `original_calc.html` (lines 375-1051) has no costs—only revenue calcs via `standardCalc` (fundedRate + patientFee) * volume * timeFactor. Hardcoded `serviceCostEstimates` in current `js/calculations.js` introduced invalid fields, propagating to LLM payloads in `js/aiIntegration.js`.

## Prioritized Tasks

### Task 1: Explicitly Mark Selected Initiatives (High Priority - Addresses Selection Mismatches)
- **Affected Files:** `js/calculations.js` (`generatePayload` function), potentially `js/serviceData.js` for service IDs.
- **Issue:** No `included` flag exists, leading the LLM to assume all `topDrivers` are selected. The model excludes IDAA (905 AUD monthly) and RMMRs (704 AUD), but totals include them inconsistently.
- **Steps:**
  1. In `processedData` mapping, add an `included` boolean: default to `true` for the top 6 initiatives by `monthlyRevenueImpact` (e.g., HMRs, HMR 1st Follow Up, DAA-eligible, Diabetes MedsChecks, ODT supply, Staged Supply), `false` for IDAA and RMMRs.
  2. Filter or mark `topDrivers` array to only include `included: true` items by default, or keep all with the flag visible.
  3. Update `summaryMetrics.monthlyRevenueDelta` to sum only included items + `otherItemsSummary.combinedMonthlyImpact` (target: 18,941 AUD for selected + other).
  4. Add user preference option in UI (`js/ui.js`) to toggle inclusions.
- **Verification:** Sum of selected monthly impacts = 12,132 AUD (revenue deltas only). Test with sample data excluding IDAA/RMMRs, using original revenue logic.
- **Estimated Effort:** 2-4 hours.
- **Status:** COMPLETE.

### Task 2: Add Costs to Other Items Summary (High Priority - Enables Full Calculations)
- **Affected Files:** `js/calculations.js` (`generatePayload` and `otherItemsSummary`).
- **Issue:** `otherItemsSummary` has `combinedMonthlyImpact = 6,809 AUD` but no `combinedOneTimeCost` or `combinedRecurringAnnualCost`, preventing accurate overall payback/ROI.
- **Steps:**
  1. Do not extend `serviceCostEstimates`—remove it entirely as per original (no per-service costs).
  2. For `otherItemsSummary`, include only revenue `combinedMonthlyImpact`; add totalInvestment field from user input for overall calcs.
  3. Set any cost fields to `null` and note: "No per-service costs; use total user-entered investment for ROI/payback."
  4. Update `summaryMetrics` to focus on revenue deltas; defer cost totals to totalInvestment.
- **Verification:** Full monthly lift (selected + other) = 18,941 AUD (revenue only). Payback uses total user investment / monthly lift; test with sample totalInvestment.
- **Estimated Effort:** 3-5 hours.
- **Status:** COMPLETE.

### Task 3: Define Scope for Summary Metrics and Fix Total Mismatches (High Priority - Core Discrepancy Fix)
- **Affected Files:** `js/calculations.js` (`summaryMetrics` computation).
- **Issue:** `totalOneTimeCost = 585,000 AUD` and `totalRecurringCostAnnual = 504,000 AUD` include all items (or unfiltered data), not matching selected sums (105,000 / 107,000 AUD).
- **Steps:**
  1. Add `scope` field to `summaryMetrics` (e.g., `"selected_initiatives"` or `"all_initiatives"`), defaulting to `"selected_initiatives"`.
  2. Recompute only revenue fields (`monthlyRevenueDelta`) by summing included `topDrivers` + other; remove `totalOneTimeCost` and `totalRecurringCostAnnual` as they are invalid—use user-entered `totalInvestment` instead.
  3. For `"all"`, sum revenue from entire `processedData`; add `itemCount` and `totalInvestment` from UI input. Strengthen validation by adding `computedFrom` array in `summaryMetrics` listing IDs of included initiatives (e.g., `["hmr", "daa-eligible"]`); test that all IDs have `included: true`.
  4. Ensure `estimatedAnnualDelta = monthlyRevenueDelta * 12` (target: 246,600 AUD for full delta of 20,550 monthly).
  5. Add "data_provenance" to metadata:
    ```JSON
    "metadata": {
      "financial_mode": "revenue_only",
      "data_provenance": "Derived directly from servicesData in original_calc.html (no cost fields)",
      "calculatorVersion": "1.3.0"
    }
    ```

  6. Add validation in `generatePayload`: log if revenue sums mismatch original logic.
- **Verification:** For selected scope, revenue deltas match 12,132 AUD monthly; flag cost mismatches by noting no per-service costs. Verify `computedFrom` matches included IDs.
- **Estimated Effort:** 2-3 hours.
- **Status:** COMPLETE.

### Task 4: Incorporate Computed Financial Fields Per Initiative (Medium Priority - Reduces LLM Errors)
- **Affected Files:** `js/calculations.js` (`processedData` mapping and `topDrivers`).
- **Issue:** LLM computes ROI/payback inconsistently; original lacks these, but extensions need them explicit.
- **Steps:**
  1. In `processedData`, add:
     - `annualRevenueImpact = Math.round(monthlyRevenueImpact * 12)`
     - Per-initiative ROI/payback invalid—remove; compute overall only using totalInvestment / total monthly delta.
  2. Include only revenue fields in `topDrivers`; for financials, add overall `roiArithmetic` using totalInvestment (e.g., "(totalMonthlyDelta * 12 - totalRecurringIfAny) / totalInvestment"). Add `overallFinancials` section to payload with derived fields: `roi: "(monthlyRevenueDelta * 12 - 0) / totalInvestment"`, `paybackMonths: "totalInvestment / monthlyRevenueDelta"`. Clarify role with metadata: `"userInputs": { "totalInvestment": 150000, "totalInvestmentPurpose": "used_for_overall_roi_and_payback_only" }`.
  3. Handle edge cases: flag if totalInvestment = 0 (infinite ROI).
  4. Add thresholds for overall: warn if overall ROI < 0 or payback > 24 months.
- **Verification:** Match revenue examples: HMR annual lift 77,520 AUD. Overall ROI/payback using totalInvestment and total delta (e.g., from `caclulation-errors.md` samples).
- **Estimated Effort:** 3-5 hours.
- **Status:** COMPLETE.

### Task 5: Review and Validate Cost Estimates (High Priority - Revert Invalid Additions)
- **Affected Files:** `js/calculations.js` (`serviceCostEstimates`), `js/serviceData.js`, `js/ui.js`.
- **Issue:** Hardcoded `serviceCostEstimates` (e.g., HMR: 50,000 one-time, 65,000 recurring) added without basis—original has no per-service costs, only total user-entered investment.
- **Steps:**
  1. Confirm no cost logic in original `servicesData` (revenue-only via fundedRate * volume).
  2. Remove per-service cost inputs/UI—add single totalInvestment input in UI (`js/ui.js`), default 0.
  3. In revenue mode (default), exclude all cost fields; financial mode uses totalInvestment for overall ROI/payback.
  4. **Priority:** Delete hardcoded `serviceCostEstimates` in `js/calculations.js`; compute overall financials post-revenue deltas. Add explicit `financial_mode` flag to payload metadata: `"financial_mode": "revenue_only"`. Instruct LLM: “If financial_mode = revenue_only, ignore or flag any per-service cost fields.”
  5. Update `collectCurrentAnalysisData` and `generatePayload` to include only revenue, plus totalInvestment. Add validation function in `generatePayload`: `const forbiddenCostKeys = ["oneTimeCost", "recurringCostAnnual", "serviceCost", "operationalCost"]; const found = Object.keys(payload).filter(k => forbiddenCostKeys.includes(k)); if (found.length) console.warn("⚠️ Forbidden cost fields present:", found);`.
- **Verification:** Original revenue calcs unchanged (e.g., HMR: 222.77 * volume * 12/month); only totalInvestment for financials, costs fully removed per-service. Test forbidden keys warning triggers on invalid fields; `financial_mode` present in payloads.
- **Estimated Effort:** 5-7 hours.
- **Status:** COMPLETE.

### Task 6: Update AI Integration for Financial Breakdown and Warnings (Medium Priority)
- **Affected Files:** `js/aiIntegration.js` (`generatePlan`, `validateAndCorrectPlan`).
- **Issue:** LLM payloads lack `financial_breakdown` with arithmetic; no warnings for missing data.
- **Steps:**
  1. In `generatePayload`, add `financial_breakdown` object:
     - `overall`: totals using totalInvestment (e.g., one_time_total: totalInvestment, monthly_revenue_lift_total: 12132).
     - Payback strings: e.g., `${totalInvestment} / ${totalMonthlyDelta} months`.
     - `details`: revenue per-initiative only; overall ROI: `(annualDelta - 0) / totalInvestment * 100` (no recurring assumed).
     - `missing_data_warnings`: array (e.g., ["No per-service costs; using total user investment"]).
  2. In LLM prompt, instruct: "Use provided financial_breakdown; verify sums and show arithmetic."
  3. In `validateAndCorrectPlan`, check payload totals vs. computed sums; correct or flag.
- **Verification:** Payload uses revenue deltas + totalInvestment; matches `caclulation-errors.md` revenue sums, flags per-service cost removal.
- **Estimated Effort:** 2-3 hours.
- **Status:** COMPLETE.

### Task 7: Enhance LLM Prompt for Validation and Arithmetic (Low Priority - Preventive)
- **Affected Files:** `js/aiIntegration.js` (prompt in `generatePlan`).
- **Issue:** Prompt doesn't enforce sum checks or explicit math, leading to invented totals.
- **Steps:**
  1. Add to prompt: "Validate: summaryMetrics revenue totals must equal sum of included topDrivers + otherItemsSummary (revenue only). Show step-by-step: e.g., HMRs 6460 + ... = 12132."
  2. "Flag: No per-service costs—use totalInvestment for overall ROI/payback. Ignore invalid fields like recurringCostAnnual."
  3. "Use exact numbers from JSON; no assumptions on per-service costs/margins. If any numeric field required for ROI or payback is missing or null, state `insufficient data` instead of estimating."
  4. Include validation list from `caclulation-errors.md`, updated for revenue-only + totalInvestment.
- **Verification:** Test LLM output flags mismatches and shows digit-by-digit sums; handles missing data with "insufficient data".
- **Estimated Effort:** 4-6 hours.
- **Status:** COMPLETE.

### Task 8: Implement Testing and Diagnostics (Ongoing)
- **Affected Files:** `js/aiIntegration.js` (`testWithSampleData`), new `test/calculations.test.js`.
- **Issue:** No automated checks for arithmetic.
- **Steps:**
  1. Extend `testWithSampleData` with assertions: e.g., expect(selectedMonthlyLift).toBe(12132); expect(no per-service costs in payload).
  2. Add unit tests for `generatePayload`: mock inputs/volumes, verify revenue totals; test totalInvestment integration.
  3. Run end-to-end: input sample volumes (e.g., HMR current 2673, target 80197) + totalInvestment=100000, check revenue deltas and overall ROI.
  4. Use `caclulation-errors.md` revenue examples + `original_calc.html` for golden revenue data. Optionally, add checksum in metadata for verification: `payload.metadata.checksum = sha256(JSON.stringify({ topDrivers: payload.topDrivers.map(d => [d.id, d.monthlyRevenueImpact]), summaryMetrics: payload.summaryMetrics }))`; test that changes produce new checksums.
  5. Add console logs in `calculateAll` for revenue deltas and totalInvestment. For versioning, increment `calculatorVersion` in metadata on breaking changes (e.g., "1.3.0"); ensure LLM outputs reference it.
- **Verification:** All checks pass: topDrivers revenue sum 13,741 monthly; selected 12,132; no per-service costs; overall payback = totalInvestment / totalDelta. Version and checksum (if used) validate integrity.
- **Estimated Effort:** 5-7 hours.
- **Status:** COMPLETE.

## Implementation Notes
- **Dependencies:** Ensure Node.js for tests; add `crypto` for optional sha256 checksum (built-in).
- **Best Practices:** Use descriptive logs; avoid hardcoding (e.g., make exclusions configurable); stick to original revenue logic from `original_calc.html`. Increment version on changes; use `financial_mode` and forbidden keys to safeguard against cost drift.
- **Risks:** Changing costs may affect existing LLM plans; test backward compatibility.
- **Next Steps:** Start with Task 5 (remove costs) and add `financial_mode` flag. Then Tasks 1–3 (flags + scope alignment). Then Task 4 (derived financial fields). Finally Tasks 6–8 (AI prompt, testing, diagnostics). After fixes, regenerate payloads and validate revenue against `original_calc.html` samples and `caclulation-errors.md`.
- **Tracking:** Update status here after each task. Re-run codebase search for "recurringCostAnnual" post-fixes to confirm removal/reversion.

## References
- `caclulation-errors.md`: Source of exact checks and examples.
- `original_calc.html` (lines 367-1051): Original revenue calcs baseline (fundedRate + patientFee) * volume * timeFactor; no per-service costs.
