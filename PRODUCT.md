# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: independent Australian community pharmacists and pharmacy owners/managers evaluating whether their pharmacy is leaving professional-services revenue on the table. They arrive with rough knowledge of their current service volumes (or a willingness to estimate) and limited time — typically assessing the opportunity between dispensing tasks or during a quiet moment, on desktop or mobile.

Secondary: prospective PharmIQ users at the top of the funnel — this calculator is often a first touchpoint with the PharmIQ platform.

## Product Purpose

The PharmIQ Opportunity Analysis Calculator lets a pharmacist quantify the untapped annual revenue available across government-funded and professional pharmacy programs, then receive a concrete, AI-generated action plan for capturing it. Success is a pharmacist who, in a single session, sees a credible dollar figure for their missed opportunity and leaves with prioritized next steps they trust enough to act on.

## Positioning

Enterprise-grade opportunity analysis exists only for large pharmacy chains; independent pharmacies decide from gut instinct, paper logs, or slow monthly reports. This tool encodes the current Australian pharmacy remuneration landscape (program eligibility and fees across DAA, MedsChecks, HMRs/RMMRs, QUM, vaccinations, ODT, Take Home Naloxone, biologics, and more) into a self-serve calculator, then pairs the numbers with an AI action plan. The differentiator is the pairing: not just "here is your number," but "here is what to do about it," grounded in real program economics rather than generic advice.

## Operating Context

- Single-page, four-part guided input flow, each part an accordion of related services:
  1. Government-Funded Programs (DAA eligible/private, IDAA, Staged Supply, MedsChecks & Diabetes MedsChecks, HMRs and follow-ups, RMMRs and follow-ups, Quality Use of Medicines)
  2. Vaccinations (COVID-19, NIPVIP, flu community and corporate, MMR, dTpa, polio, cholera, Hib, meningococcal, pneumococcal, and other travel/scheduled vaccines)
  3. Pharmacy Programs & Services (ODT oral supply and injectable admin, Take Home Naloxone, and related services)
  4. Biologics Dispensary Opportunity
- The pharmacist enters current and/or potential volumes; the tool computes the revenue opportunity live and formats it as currency.
- On request it generates an AI-powered action plan (executive summary plus prioritized growth steps) via serverless functions, with a fallback that copies a ready-to-run prompt to the clipboard for pasting into ChatGPT.
- An FAQ section supports first-time, unassisted visitors.

## Capabilities and Constraints

- Confirmed capabilities: multi-category service input, live opportunity calculation and currency formatting, payload assembly for AI plan generation, primary/background serverless plan generation with automatic fallback, and a copy-prompt escape hatch.
- Technical shape: static front end (HTML + vanilla JS modules: `calculations.js`, `serviceData.js`, `aiIntegration.js`, `main.js`) with Netlify serverless functions (`generate-plan`, `generate-plan-background`) for AI generation; deployed on Netlify.
- Constraint: remuneration figures and program definitions in `serviceData.js` reflect the Australian pharmacy programs landscape at a point in time and must be kept current as fees and eligibility change — stale figures undermine the tool's core credibility.
- Constraint: results are an estimate for opportunity-sizing, not financial or regulatory advice.

## Brand Commitments

- Part of the PharmIQ platform. Name: PharmIQ. Tagline: "Infrastructure for Choice. Clarity for Growth." Brand personality: Expert Friend, Infrastructure, Moment of Clarity, Professional Assurance.
- Visual and design authority for this repo lives in `DESIGN.md`, `brand-identity/brand-guidelines.md` (Brand Style Guide v2.0), and the `brand-identity/` token and asset set. This PRODUCT.md records product truth only; visual decisions belong to those files.

## Evidence on Hand

- Real, encoded program economics in `js/serviceData.js` (the service catalogue and fee structure the calculator runs on).
- Brand assets and guidelines in `brand-identity/` (logos, tokens, typography, mockups, Brand Style Guide v2.0).
- No customer testimonials, usage benchmarks, pricing, or deployment/scale claims are established in this repo; future work must not fabricate them.

## Product Principles

1. Credible numbers first. The opportunity figure is the product's trust anchor; program economics must stay accurate and current.
2. From number to next step. Always pair the calculated opportunity with actionable guidance, never a dead-end figure.
3. Low-friction, self-serve. A busy pharmacist should get value without sign-up, training, or hand-holding.
4. Estimate, not advice. Communicate the opportunity honestly as sizing, avoiding claims of financial or regulatory certainty.
5. Expert friend, not a sales pitch. Professional assurance over hype, even at a top-of-funnel touchpoint.

## Accessibility & Inclusion

Used on desktop and mobile in a working pharmacy. Maintain accessible accordions and forms (labels, `aria-*` wiring, visible focus indicators) and readable data tables that reflow on small screens, so the tool is usable one-handed between tasks.
