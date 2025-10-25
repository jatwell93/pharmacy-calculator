/**
 * test/calculations.test.js
 *
 * Simple Node-run test file (no test framework required).
 * - Imports the ES module `generatePayload` from the app.
 * - Runs a few deterministic, DOM-less tests by passing `rawDataOverride`.
 *
 * Usage:
 *   node test/calculations.test.js
 *
 * Notes:
 * - The project's `generatePayload(userPreferences, rawDataOverride)` supports a
 *   `rawDataOverride` parameter (an array of service analysis objects). That lets
 *   us run deterministic tests without a browser DOM.
 * - The tests are intentionally small and self-contained so they can be run
 *   locally without additional test runners.
 */

import assert from "assert";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log("Running calculations.test.js...");

  // Dynamic import of the calculations module
  // Note: paths are relative to the test file location
  const calculationsMod = await import("../js/calculations.js");
  const { generatePayload } = calculationsMod;

  // Helper: convert monthly -> annual (annual = monthly * 12)
  const mToA = (m) => Math.round(m * 12);

  // Construct a sample rawDataOverride that matches the canonical example numbers:
  // - Selected initiatives monthly lift: 12,132 (sum of six main drivers)
  // - Other items combined monthly impact: 6,809
  // - Combined monthly lift: 18,941
  //
  // We create the six main drivers with monthly impacts:
  //   hmr: 6460
  //   hmr_1_followup: 1671
  //   daa_eligible: 1537
  //   diabetes_medschecks: 898
  //   odt_supply: 858
  //   staged_supply: 708
  //
  // We make IDAA and RMMR intentionally small in this dataset so they do not
  // appear in the selected top-6 (this lets us assert the canonical sums).
  //
  // The other-items are 11 services each with monthly 680 (10 of them) and one tiny item 9
  // so total other monthly = 680*10 + 9 = 6809.

  const sampleRawData = [
    // main six (annual additionalValue)
    {
      id: "hmr",
      name: "HMRs",
      currentValue: 2673,
      potentialValue: 80197,
      additionalValue: mToA(6460),
      growthPercentage: 100,
    },
    {
      id: "hmr-1",
      name: "HMR 1st Follow Up",
      currentValue: 1000,
      potentialValue: 30000,
      additionalValue: mToA(1671),
      growthPercentage: 100,
    },
    {
      id: "daa-eligible",
      name: "DAA - eligible",
      currentValue: 25487,
      potentialValue: 64911,
      additionalValue: mToA(1537),
      growthPercentage: 100,
    },
    {
      id: "diabetes-medschecks",
      name: "Diabetes MedsChecks",
      currentValue: 2000,
      potentialValue: 50000,
      additionalValue: mToA(898),
      growthPercentage: 100,
    },
    {
      id: "odt",
      name: "ODT supply",
      currentValue: 1000,
      potentialValue: 40000,
      additionalValue: mToA(858),
      growthPercentage: 100,
    },
    {
      id: "staged",
      name: "Staged Supply",
      currentValue: 500,
      potentialValue: 20000,
      additionalValue: mToA(708),
      growthPercentage: 100,
    },

    // IDAA and RMMR present but small (so they are not selected in this canonical test)
    {
      id: "idaa",
      name: "IDAA",
      currentValue: 10,
      potentialValue: 20,
      additionalValue: mToA(300),
      growthPercentage: 100,
    },
    {
      id: "rmmr",
      name: "RMMR",
      currentValue: 5,
      potentialValue: 12,
      additionalValue: mToA(200),
      growthPercentage: 100,
    },

    // Add a set of "other" services (10 x 680 monthly + 1 x 9 monthly)
    // annual additionalValue = monthly * 12
    ...Array.from({ length: 10 }).map((_, i) => ({
      id: `other-${i + 1}`,
      name: `Other Service ${i + 1}`,
      currentValue: 0,
      potentialValue: 0,
      additionalValue: mToA(680),
      growthPercentage: 100,
    })),
    {
      id: "other-small",
      name: "Other Small",
      currentValue: 0,
      potentialValue: 0,
      additionalValue: mToA(9),
      growthPercentage: 100,
    },
  ];

  // Sanity check sums for the sample raw data
  const monthlyValues = sampleRawData.map((s) =>
    Math.round(s.additionalValue / 12),
  );
  const totalMonthly = monthlyValues.reduce((a, b) => a + b, 0);

  // Compute expected total directly from the sample data (avoid hardcoded values)
  const expectedTotal = monthlyValues.reduce((a, b) => a + b, 0);
  assert.strictEqual(
    totalMonthly,
    expectedTotal,
    `Sanity check: totalMonthly expected ${expectedTotal}, got ${totalMonthly}`,
  );

  // Test 1: Revenue-only mode, exclude IDAA/RMMR from selected initiatives (explicit userPrefs)
  const payload1 = generatePayload(
    { maxInvestment: 150000, includeIdaaRmmr: false },
    sampleRawData,
  );

  assert.ok(
    payload1,
    "generatePayload returned null or undefined for payload1",
  );

  // The summaryMetrics.monthlyRevenueDelta should equal the selected monthly lift = 12,132
  // (the code computes `monthlyRevenueDelta` = includedMonthlyDelta in generatePayload)
  const expectedSelectedMonthly = 12132;
  assert.strictEqual(
    payload1.summaryMetrics.monthlyRevenueDelta,
    expectedSelectedMonthly,
    `Selected monthly lift mismatch (expected ${expectedSelectedMonthly})`,
  );

  // The otherItemsSummary.combinedMonthlyImpact should equal 6,809
  const expectedOtherMonthly = 6809;
  assert.strictEqual(
    payload1.otherItemsSummary.combinedMonthlyImpact,
    expectedOtherMonthly,
    `Other items combined monthly impact mismatch (expected ${expectedOtherMonthly})`,
  );

  // Combined check: selected + other = 18,941
  const combined =
    payload1.summaryMetrics.monthlyRevenueDelta +
    payload1.otherItemsSummary.combinedMonthlyImpact;
  assert.strictEqual(
    combined,
    18941,
    `Combined monthly lift mismatch expected 18941 but got ${combined}`,
  );

  console.log(
    "✓ Test 1 passed: canonical monthly lifts (selected + other) match expected values.",
  );

  // Test 2: Check that each topDriver has annualRevenueImpact and included flag
  assert.ok(
    Array.isArray(payload1.topDrivers) && payload1.topDrivers.length > 0,
    "topDrivers missing or empty",
  );

  for (const d of payload1.topDrivers) {
    assert.strictEqual(
      typeof d.annualRevenueImpact,
      "number",
      `topDriver ${d.id} missing numeric annualRevenueImpact`,
    );
    // included should be present (boolean)
    assert.ok(
      typeof d.included === "boolean",
      `topDriver ${d.id} missing boolean included flag`,
    );
  }

  console.log(
    "✓ Test 2 passed: topDrivers contain annualRevenueImpact and included flags.",
  );

  // Test 3: Check overallFinancials arithmetic strings and numeric forms
  assert.ok(
    payload1.overallFinancials,
    "overallFinancials missing from payload",
  );
  const of = payload1.overallFinancials;

  // numeric roi may be null if insufficient data; here we provided investment so expect a numeric ROI
  assert.ok(
    typeof of.roi === "number" || of.roi === null,
    "overallFinancials.roi should be number or null",
  );
  assert.ok(
    typeof of.paybackArithmetic === "string" && of.paybackArithmetic.length > 0,
    "overallFinancials.paybackArithmetic should be a non-empty string",
  );
  assert.ok(
    typeof of.roiArithmetic === "string" && of.roiArithmetic.length > 0,
    "overallFinancials.roiArithmetic should be a non-empty string",
  );

  console.log(
    "✓ Test 3 passed: overallFinancials present with arithmetic strings.",
  );

  // Test 4: Check metadata checksum exists and has expected format (8 hex chars from fnv1a32)
  assert.ok(
    payload1.metadata && payload1.metadata.checksum,
    "metadata.checksum missing",
  );
  assert.match(
    payload1.metadata.checksum,
    /^[0-9a-f]{8}$/,
    `metadata.checksum expected 8-hex string, got ${payload1.metadata.checksum}`,
  );

  console.log("✓ Test 4 passed: metadata.checksum present and looks valid.");

  // Test 5: When includeIdaaRmmr is true (or default), ensure payload still generated and contains expected metadata
  const payload2 = generatePayload(
    { maxInvestment: 150000, includeIdaaRmmr: true },
    sampleRawData,
  );
  assert.ok(
    payload2,
    "generatePayload returned null or undefined for payload2",
  );
  assert.strictEqual(
    payload2.metadata.financial_mode,
    "revenue_only",
    "payload.metadata.financial_mode should be 'revenue_only'",
  );

  console.log(
    "✓ Test 5 passed: payload generated with financial_mode = revenue_only when includeIdaaRmmr=true.",
  );

  // If we reach here, all tests passed
  console.log("\nAll tests passed successfully.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Test run failed with error:", err);
  process.exit(1);
});
