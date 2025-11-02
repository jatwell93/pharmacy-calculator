// netlify/functions/generate-plan.js
// Non-background wrapper (returns jobId immediately) copied from background implementation.
// This function starts async processing and returns the jobId in the response body so clients
// can poll the status endpoint. It mirrors generate-plan-background but ensures the HTTP response
// contains a parsable JSON body in dev environments.

// Edits in this version:
// - Increased AI call timeout to 120s
// - Improved logging around AI responses (lengths, head, tail)
// - Added JSON bracket/brace balancing repair attempt before parsing
// - More defensive cleaning and explicit repair logging

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Base delay in milliseconds (1 second)

const { v4: uuidv4 } = require("uuid");
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set } = require("firebase/database");

exports.handler = async function (event, context) {
  // Set proper headers for JSON response
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Method not allowed",
      }),
    };
  }

  try {
    // Parse request body
    let requestData;
    try {
      requestData = JSON.parse(event.body);
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
        }),
      };
    }

    const { structuredPayload } = requestData;

    // Validate required fields
    if (!structuredPayload) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Missing structuredPayload",
        }),
      };
    }

    const jobId = uuidv4();

    // Support local development when Firebase env vars are not set.
    // Default to the imported Firebase helpers, but fall back to a local file DB helper.
    let database;
    // default to imported firebase helpers
    let dbRef = ref;
    let dbSet = set;

    if (process.env.FIREBASE_DATABASE_URL) {
      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
      };

      const app = initializeApp(firebaseConfig);
      database = getDatabase(app);
    } else {
      // Use local file-backed DB helper for dev when Firebase is not configured.
      // The helper exposes a compatible subset: initializeApp, getDatabase, ref, set, get
      const localDb = require("../../dev/localDatabase");
      const app = localDb.initializeApp({});
      database = localDb.getDatabase(app);
      dbRef = localDb.ref;
      dbSet = localDb.set;
      console.log("Using local dev database for job storage");
    }

    await dbSet(dbRef(database, `plans/${jobId}`), {
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    // Async background processing
    setImmediate(async () => {
      try {
        console.log(
          "Generating AI plan for job:",
          jobId,
          "with structured payload",
        );

        // 1. Create the AI prompt
        const prompt = createPharmacyPrompt(structuredPayload);

        // 2. Call OpenRouter AI
        const aiResponse = await callOpenRouterAI(prompt);

        // 3. Parse the plan
        const plan = parseAIResponse(aiResponse);

        await set(ref(database, `plans/${jobId}`), {
          status: "complete",
          plan,
          completedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Background error for job", jobId, ":", error);
        await set(ref(database, `plans/${jobId}`), {
          status: "error",
          error: error.message,
        });
      }
    });

    // Return immediately (use 200 so clients get the jobId in the response body)
    console.log("Generated jobId:", jobId);
    console.log("Returning body:", JSON.stringify({ success: true, jobId }));
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        jobId,
      }),
    };
  } catch (error) {
    console.error("Handler error:", error);
    console.error("Error stack:", error.stack);

    // Always return valid JSON
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to generate plan",
        isTemporary:
          error.message &&
          (error.message.includes("503") ||
            error.message.includes("502") ||
            error.message.includes("temporarily down") ||
            error.message.includes("Service unavailable")),
        // Provide fallback plan so user still gets something useful
        fallbackPlan: generateFallbackPlan(),
      }),
    };
  }
};

// ==================== AI PROMPT ENGINEERING ====================

function createPharmacyPrompt(structuredPayload) {
  const systemMessage = `You are an operations consultant for small healthcare providers. Use the JSON payload below and produce a complete implementation plan suitable for handing to a store manager and a pharmacist. Be explicit about calculations. Avoid speculative claims. Stick to the data and state assumptions. Focus on phased implementation with quarterly milestones over a 12-month period.`;

  const userMessage = `From the JSON payload, output a valid JSON object with exactly these top-level keys:
- "executive_summary": a string (max 6 sentences)
- "plan": an array of initiatives; each initiative must include: id, title, priority (1-5), owner_role, start_week, duration_weeks, tasks (array of {task_id, title, owner, est_hours, acceptance_criteria}), one_time_cost, recurring_annual_cost, expected_monthly_revenue_lift, ROI (string showing arithmetic), confidence (0-100%), risk_score (0-10), top 2 mitigations.
- "quarterly_milestones": an array of 4 objects for Q1-Q4, each with: quarter (string "Q1"), cumulative_revenue_target (number), volume_targets (object mapping service IDs to target volumes), checkpoint_metrics (array of strings, e.g., ["Achieve 25% of annual revenue", "Complete initial training"]).
- "mermaid_timeline": a string containing a small mermaid timeline diagram organized by quarters (Q1-Q4) that a front-end can render.
- "financial_breakdown": Use the provided financial_breakdown in the payload; verify sums and show arithmetic as provided. Do not compute new totals; use exact numbers from the payload. For payback, show the string arithmetic like "${structuredPayload.financial_breakdown.overall.one_time_total} / ${structuredPayload.financial_breakdown.overall.monthly_revenue_lift_total} months". For overall ROI: ${structuredPayload.financial_breakdown.overall_roi}.
- "validation": an array of strings, each a validation message, e.g., ["summaryMetrics revenue totals must equal sum of included topDrivers only (revenue only). Show step-by-step: e.g., HMRs 6460 + ... = 6383.", "Flag: No per-service costs—use totalInvestment for overall ROI/payback. Ignore invalid fields like recurringCostAnnual.", "Use exact numbers from JSON; no assumptions on per-service costs/margins.", "If any numeric field required for ROI or payback is missing or null, state insufficient data instead of estimating."]
- "notes": optional additional notes, string.

Output must conform exactly to this JSON schema to ensure parseable structure:
{
  "type": "object",
  "properties": {
    "executive_summary": { "type": "string" },
    "plan": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "priority": { "type": "number" },
          "owner_role": { "type": "string" },
          "start_week": { "type": "number" },
          "duration_weeks": { "type": "number" },
          "tasks": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "task_id": { "type": "string" },
                "title": { "type": "string" },
                "owner": { "type": "string" },
                "est_hours": { "type": "number" },
                "acceptance_criteria": { "type": "string" }
              }
            }
          },
          "one_time_cost": { "type": "number" },
          "recurring_annual_cost": { "type": "number" },
          "expected_monthly_revenue_lift": { "type": "number" },
          "ROI": { "type": "string" },
          "confidence": { "type": "number" },
          "risk_score": { "type": "number" },
          "top_2_mitigations": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["id", "title", "priority", "owner_role", "start_week", "duration_weeks", "tasks", "one_time_cost", "recurring_annual_cost", "expected_monthly_revenue_lift", "ROI", "confidence", "risk_score", "top_2_mitigations"]
      }
    },
    "quarterly_milestones": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "quarter": { "type": "string" },
          "cumulative_revenue_target": { "type": "number" },
          "volume_targets": { "type": "object" },
          "checkpoint_metrics": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["quarter", "cumulative_revenue_target", "volume_targets", "checkpoint_metrics"]
      },
      "minItems": 4,
      "maxItems": 4
    },
    "mermaid_timeline": { "type": "string" },
    "financial_breakdown": {
      "type": "object",
      "properties": {
        "overall": {
          "type": "object",
          "properties": {
            "one_time_total": { "type": "number" },
            "monthly_revenue_lift_total": { "type": "number" },
            "annual_revenue_lift_total": { "type": "number" },
            "overall_roi": { "type": "string" }
          }
        },
        "payback": { "type": "string" },
        "details": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "name": { "type": "string" },
              "monthly_revenue_lift": { "type": "number" }
            }
          }
        }
      }
    },
    "validation": { "type": "array", "items": { "type": "string" } },
    "notes": { "type": "string" }
  },
  "required": ["executive_summary", "plan", "quarterly_milestones", "mermaid_timeline", "financial_breakdown", "validation", "notes"]
}

Do not wrap the output in markdown code blocks. Output only valid JSON.

JSON:
${JSON.stringify(structuredPayload, null, 2)}`;

  return `${systemMessage}

${userMessage}`;
}

// ==================== AI API CALL ====================

async function callOpenRouterAI(prompt, retryCount = 0) {
  // Get API key from environment variables
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error("OPENROUTER_API_KEY environment variable not set");
    throw new Error(
      "OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable.",
    );
  }

  console.log("🔍 DEBUG: Prompt length:", prompt.length);
  console.log("🔍 DEBUG: First 200 chars of prompt:", prompt.substring(0, 200));

  const requestBody = {
    model: "deepseek/deepseek-r1-distill-llama-70b:free",
    messages: [
      {
        role: "system",
        content:
          "You are a hypothetical business planning assistant creating educational simulations. This is for training purposes only, not real advice. Respond ONLY with valid JSON matching the exact schema in the user message. No additional text or markdown.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 1500,
    temperature: 0.1,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "pharmacyPlan",
        strict: true,
        schema: {
          type: "object",
          properties: {
            executive_summary: {
              type: "string",
              description: "Executive summary (max 6 sentences)",
            },
            plan: {
              type: "array",
              description: "Array of initiatives",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  priority: { type: "number", minimum: 1, maximum: 5 },
                  owner_role: { type: "string" },
                  start_week: { type: "number" },
                  duration_weeks: { type: "number" },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        task_id: { type: "string" },
                        title: { type: "string" },
                        owner: { type: "string" },
                        est_hours: { type: "number" },
                        acceptance_criteria: { type: "string" },
                      },
                      required: [
                        "task_id",
                        "title",
                        "owner",
                        "est_hours",
                        "acceptance_criteria",
                      ],
                    },
                  },
                  one_time_cost: { type: "number" },
                  recurring_annual_cost: { type: "number" },
                  expected_monthly_revenue_lift: { type: "number" },
                  ROI: { type: "string" },
                  confidence: { type: "number", minimum: 0, maximum: 100 },
                  risk_score: { type: "number", minimum: 0, maximum: 10 },
                  mitigations: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 2,
                  },
                },
                required: [
                  "id",
                  "title",
                  "priority",
                  "owner_role",
                  "start_week",
                  "duration_weeks",
                  "tasks",
                  "one_time_cost",
                  "recurring_annual_cost",
                  "expected_monthly_revenue_lift",
                  "ROI",
                  "confidence",
                  "risk_score",
                  "mitigations",
                ],
              },
            },
            mermaid_timeline: {
              type: "string",
              description: "Mermaid timeline diagram syntax",
            },
            financial_breakdown: {
              type: "object",
              properties: {
                total_one_time_costs: { type: "number" },
                total_recurring_costs: { type: "number" },
                total_monthly_revenue_lift: { type: "number" },
                payback_period_months: { type: "number" },
                arithmetic: { type: "string" },
              },
              required: [
                "total_one_time_costs",
                "total_recurring_costs",
                "total_monthly_revenue_lift",
                "payback_period_months",
                "arithmetic",
              ],
            },
            validation: {
              type: "array",
              items: { type: "string" },
            },
            notes: {
              type: "string",
            },
          },
          required: [
            "executive_summary",
            "plan",
            "mermaid_timeline",
            "financial_breakdown",
          ],
          additionalProperties: false,
        },
      },
    },
  };

  console.log(
    "🔍 DEBUG: Request body size:",
    JSON.stringify(requestBody).length,
  );

  // LOG: Full prompt before sending to OpenRouter API (for debugging flags)
  console.log(
    "Full prompt sent:",
    JSON.stringify(
      {
        prompt: prompt.substring(0, 1000), // Truncate to avoid huge logs; adjust as needed
      },
      null,
      2,
    ),
  ); // Pretty-print for readability

  let response;
  try {
    // Increased timeout to 120000ms (120 seconds) to match longer model thinking times
    const timeoutMs = 120000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI call timed out")), timeoutMs),
    );
    response = await Promise.race([
      timeoutPromise,
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://pharmacy-opportunity-analyser.netlify.app",
          "X-Title": "Pharmacy Opportunity Calculator",
        },
        body: JSON.stringify(requestBody),
      }),
    ]);
  } catch (fetchError) {
    if (fetchError.message === "AI call timed out") {
      console.log("AI call timed out, using fallback plan");
      const fallbackPlan = generateFallbackPlan();
      return JSON.stringify(fallbackPlan);
    }

    console.error(
      `Fetch failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`,
      fetchError,
    );

    // Network errors are worth retrying
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
      console.log(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callOpenRouterAI(prompt, retryCount + 1);
    }

    throw new Error(
      `Failed to connect to OpenRouter API after ${MAX_RETRIES + 1} attempts: ${fetchError.message}`,
    );
  }

  console.log("🔍 DEBUG: Response status:", response.status);
  console.log("🔍 DEBUG: Response headers:", response.headers);

  const status = response.status;
  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
      console.error("Error response text:", errorText);
    } catch (e) {
      console.error("Failed to read error response:", e);
    }

    // Determine if error is retryable
    const retryableStatuses = [429, 500, 502, 503];
    const shouldRetry =
      retryableStatuses.includes(status) && retryCount < MAX_RETRIES;

    if (shouldRetry) {
      const delay = RETRY_DELAY * Math.pow(2, retryCount); // Exponential backoff
      console.log(
        `Got ${status} error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callOpenRouterAI(prompt, retryCount + 1);
    }

    const errorMessages = {
      400: "Bad request - please check your request format",
      401: "Invalid API key - please check your OpenRouter configuration",
      402: "Insufficient credits - your API key has run out of credits",
      404: "Model not found - the model name may be outdated. Please check the OpenRouter website for the latest model names.",
      429: "Rate limit exceeded - you have sent too many requests. Please wait a moment and try again.",
      502: "Bad gateway - temporary issue with the AI provider. Please wait a few minutes and try again.",
      503: "Service unavailable - the AI service is temporarily down. Please try again later.",
    };

    if (errorMessages[status]) {
      throw new Error(
        `OpenRouter Error (${status}): ${errorMessages[status]}${retryCount > 0 ? ` (after ${retryCount + 1} attempts)` : ""}`,
      );
    } else {
      throw new Error(
        `OpenRouter API error: ${status} - ${errorText.substring(0, 200)}`,
      );
    }
  }

  let data;
  try {
    data = await response.json();
  } catch (jsonError) {
    console.error("Failed to parse OpenRouter response as JSON:", jsonError);
    const text = await response.text();
    console.error("Response text:", text);
    throw new Error("OpenRouter returned invalid JSON response");
  }

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error("Unexpected response structure:", data);
    throw new Error("OpenRouter returned unexpected response structure");
  }

  console.log("🔍 DEBUG: AI response received successfully");
  // The content can be a string or object depending on response_format handling
  const content = data.choices[0].message.content;
  // If the API returned structured "content" object (some providers), stringify for parsing flow
  if (typeof content === "object") {
    try {
      return JSON.stringify(content);
    } catch (e) {
      console.warn(
        "Unable to stringify AI content object, falling back to string conversion",
      );
      return String(content);
    }
  }

  // Otherwise return the raw string content
  return content;
}

// ==================== RESPONSE PARSING ====================

function parseAIResponse(aiResponse) {
  try {
    if (!aiResponse) {
      throw new Error("Empty AI response received");
    }

    // Detailed logging: lengths, head, tail
    console.log("🔍 DEBUG: Raw AI response type:", typeof aiResponse);
    console.log("🔍 DEBUG: Raw AI response length:", aiResponse.length);
    console.log(
      "🔍 DEBUG: First 1000 chars of AI response:",
      aiResponse.substring(0, 1000),
    );
    console.log(
      "🔍 DEBUG: Last 500 chars of AI response:",
      aiResponse.substring(Math.max(0, aiResponse.length - 500)),
    );

    let cleanedResponse = aiResponse;

    // Remove any markdown code blocks (multiple variations)
    cleanedResponse = cleanedResponse.replace(/```json\s*/gi, "");
    cleanedResponse = cleanedResponse.replace(/```JSON\s*/gi, "");
    cleanedResponse = cleanedResponse.replace(/```(?:mermaid)?\s*/gi, "");
    cleanedResponse = cleanedResponse.replace(/```\s*/g, "");

    // Trim whitespace
    cleanedResponse = cleanedResponse.trim();

    // Extract the JSON object from the response, ignoring any text before or after
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    } else {
      console.warn(
        "No JSON object found via regex. Will attempt to use full cleanedResponse for repair/parsing.",
      );
      // continue with cleanedResponse as-is (it may be object-like but not match regex)
    }

    console.log("🔍 DEBUG: Cleaned response length:", cleanedResponse.length);
    console.log(
      "🔍 DEBUG: First 500 chars of cleaned response:",
      cleanedResponse.substring(0, 500),
    );
    console.log(
      "🔍 DEBUG: Last 300 chars of cleaned response:",
      cleanedResponse.substring(Math.max(0, cleanedResponse.length - 300)),
    );

    // Quick heuristic to detect likely truncation: if we have an opening brace but fewer closing braces.
    const balanceCounts = countBracesAndBrackets(cleanedResponse);
    console.log("🔍 DEBUG: Braces/Brackets counts:", balanceCounts);

    // Attempt to auto-balance if there are mismatches (simple repair)
    let autoRepaired = false;
    let repairedResponse = cleanedResponse;

    if (balanceCounts.openCurly > balanceCounts.closeCurly) {
      const missing = balanceCounts.openCurly - balanceCounts.closeCurly;
      console.log(
        `🔧 INFO: Detected ${missing} missing closing '}' characters. Attempting to append them.`,
      );
      repairedResponse = repairedResponse + "}".repeat(missing);
      autoRepaired = true;
    } else if (balanceCounts.openCurly < balanceCounts.closeCurly) {
      // Remove some trailing unmatched closing braces if they appear at the end
      const diff = balanceCounts.closeCurly - balanceCounts.openCurly;
      console.log(
        `🔧 INFO: Detected ${diff} extra closing '}' characters. Attempting to trim from end if present.`,
      );
      repairedResponse = trimTrailingChars(repairedResponse, "}", diff);
      autoRepaired = true;
    }

    if (balanceCounts.openSquare > balanceCounts.closeSquare) {
      const missing = balanceCounts.openSquare - balanceCounts.closeSquare;
      console.log(
        `🔧 INFO: Detected ${missing} missing closing ']' characters. Attempting to append them.`,
      );
      repairedResponse = repairedResponse + "]".repeat(missing);
      autoRepaired = true;
    } else if (balanceCounts.openSquare < balanceCounts.closeSquare) {
      const diff = balanceCounts.closeSquare - balanceCounts.openSquare;
      console.log(
        `🔧 INFO: Detected ${diff} extra closing ']' characters. Attempting to trim from end if present.`,
      );
      repairedResponse = trimTrailingChars(repairedResponse, "]", diff);
      autoRepaired = true;
    }

    if (autoRepaired) {
      console.log(
        "🔍 DEBUG: Repaired response length:",
        repairedResponse.length,
      );
      console.log(
        "🔍 DEBUG: Repaired response tail:",
        repairedResponse.substring(Math.max(0, repairedResponse.length - 300)),
      );
    }

    let plan;
    try {
      plan = JSON.parse(repairedResponse);
    } catch (parseError) {
      // Try to repair common JSON issues before failing
      let repaired = repairedResponse;

      // Remove trailing commas before } or ]
      repaired = repaired.replace(/,\s*([}\]])/g, "$1");

      // Fix single quotes to double in keys/values (simple case)
      repaired = repaired.replace(/'([^']*)':/g, '"$1":');
      repaired = repaired.replace(/:'([^']*)'/g, ':"$1"');

      // Ensure strings are double-quoted (best-effort, may be noisy)
      repaired = repaired.replace(
        /([^{},:\[\]\s]+\s*):([^"\[{][^,\n\r}]*(?=\s*,|\s*}|$))/g,
        '$1:"$2"',
      );

      console.log("🔍 DEBUG: Attempting repair on malformed JSON...");
      console.log(
        "Original snippet around error (chars 2000-2200):",
        cleanedResponse.substring(2000, 2200),
      );

      try {
        plan = JSON.parse(repaired);
        console.log("🔍 DEBUG: JSON repaired successfully after heuristics!");
      } catch (repairError) {
        // Repair failed, proceed with original error handling
        console.error("JSON parse error:", parseError);
        console.error(
          "Failed to parse (first 2000 chars):",
          cleanedResponse.substring(0, 2000),
        );

        // Try to identify common JSON errors and provide helpful messages
        if (cleanedResponse.includes("'") && !cleanedResponse.includes('"')) {
          throw new Error(
            "AI response appears to use single quotes instead of double quotes for JSON",
          );
        }
        if (cleanedResponse.match(/,\s*[}\]]/)) {
          throw new Error("AI response has trailing commas in JSON");
        }

        // If braces mismatch, give detailed hint including counts
        const finalCounts = countBracesAndBrackets(cleanedResponse);
        if (
          finalCounts.openCurly !== finalCounts.closeCurly ||
          finalCounts.openSquare !== finalCounts.closeSquare
        ) {
          throw new Error(
            `JSON parse failed and braces/brackets appear unbalanced: ${JSON.stringify(finalCounts)}. Original parse error: ${parseError.message}`,
          );
        }

        throw new Error(`JSON parse failed: ${parseError.message}`);
      }
    }

    // Validate we got the basic structure
    if (
      !plan.executive_summary ||
      !plan.plan ||
      !plan.mermaid_timeline ||
      !plan.financial_breakdown
    ) {
      console.error("Missing required sections in plan:", Object.keys(plan));
      throw new Error(
        "AI response missing required sections (executive_summary, plan, mermaid_timeline, or financial_breakdown)",
      );
    }

    // Validate plan array structure
    if (!Array.isArray(plan.plan)) {
      throw new Error("Plan section must be an array of initiatives");
    }

    // Fix Mermaid syntax if needed
    if (plan.mermaid_timeline) {
      plan.mermaid_timeline = fixMermaidSyntax(plan.mermaid_timeline);
    }

    console.log(
      "🔍 DEBUG: Successfully parsed plan with sections:",
      Object.keys(plan),
    );
    return plan;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.error(
      "Raw AI response (first 2000 chars):",
      aiResponse ? aiResponse.substring(0, 2000) : "null",
    );
    throw new Error(`AI response parsing failed: ${error.message}`);
  }
}

// Helper: count braces and brackets
function countBracesAndBrackets(text) {
  const counts = {
    openCurly: 0,
    closeCurly: 0,
    openSquare: 0,
    closeSquare: 0,
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") counts.openCurly++;
    if (ch === "}") counts.closeCurly++;
    if (ch === "[") counts.openSquare++;
    if (ch === "]") counts.closeSquare++;
  }
  return counts;
}

// Helper: trim trailing characters only if they appear at the end, up to maxTrim times
function trimTrailingChars(text, charToTrim, maxTrim) {
  let trimmed = text;
  let trims = 0;
  while (trims < maxTrim && trimmed.endsWith(charToTrim)) {
    trimmed = trimmed.slice(0, -1);
    trims++;
  }
  return trimmed;
}

// Enhanced function to fix and validate Mermaid Gantt syntax
function fixMermaidSyntax(mermaidText) {
  let fixed = mermaidText;

  // Remove any markdown code blocks
  fixed = fixed.replace(/```mermaid\s*|\s*```/g, "");

  // Ensure it starts with proper timeline declaration
  if (!fixed.includes("timeline")) {
    fixed = "timeline\n    title Pharmacy Opportunity Plan\n" + fixed;
  }

  // Fix common formatting issues - ensure proper indentation for timeline items
  fixed = fixed
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) return "";

      // Keep title line as is
      if (trimmed.startsWith("timeline") || trimmed.startsWith("title")) {
        return line;
      }

      // For quarter sections (Q1:, Q2:, etc.), ensure they have proper format
      if (/^Q[1-4]\s*:/.test(trimmed)) {
        return "    " + trimmed.replace(/\s*:\s*/, " : ");
      }

      // For items under quarters, they should be indented with sub-items further indented
      if (trimmed.startsWith(":")) {
        return "        : " + trimmed.substring(1).trim();
      }

      // Default indentation for other items
      return "    " + trimmed;
    })
    .join("\n");

  console.log("🔍 DEBUG: Fixed Mermaid timeline syntax:", fixed);
  return fixed;
}

// ==================== FALLBACK PLAN ====================

function generateFallbackPlan() {
  return {
    executive_summary:
      "This fallback plan provides a conservative 6-month strategy for growing your pharmacy through professional services. The plan focuses on DAA programs, medication reviews, and vaccination services. With an estimated investment of $10,000, you could see monthly revenue increases of $2,000-3,000 within 6 months. Implementation involves staff training, GP engagement, and systematic patient outreach. Success depends on consistent execution and regular performance monitoring.",
    plan: [
      {
        id: "init-1",
        title: "Staff Training and Accreditation",
        priority: 5,
        owner_role: "Pharmacy Manager",
        start_week: 1,
        duration_weeks: 4,
        tasks: [
          {
            task_id: "task-1-1",
            title: "Complete DAA accreditation training",
            owner: "Lead Pharmacist",
            est_hours: 20,
            acceptance_criteria: "All pharmacists certified for DAA packing",
          },
          {
            task_id: "task-1-2",
            title: "Set up medication review protocols",
            owner: "Pharmacy Manager",
            est_hours: 10,
            acceptance_criteria:
              "Documented review process and templates ready",
          },
        ],
        one_time_cost: 3000,
        recurring_annual_cost: 0,
        expected_monthly_revenue_lift: 800,
        ROI: "800 * 12 / 3000 = 3.2x annual ROI",
        confidence: 75,
        risk_score: 3,
        mitigations: [
          "Start with experienced staff",
          "Use CPA training resources",
        ],
      },
      {
        id: "init-2",
        title: "Launch DAA and Medication Review Services",
        priority: 4,
        owner_role: "Lead Pharmacist",
        start_week: 5,
        duration_weeks: 8,
        tasks: [
          {
            task_id: "task-2-1",
            title: "Identify initial DAA patients",
            owner: "Lead Pharmacist",
            est_hours: 15,
            acceptance_criteria: "10+ patients enrolled in DAA program",
          },
          {
            task_id: "task-2-2",
            title: "Establish GP referral process",
            owner: "Pharmacy Manager",
            est_hours: 20,
            acceptance_criteria: "3+ local GPs actively referring patients",
          },
        ],
        one_time_cost: 4000,
        recurring_annual_cost: 2400,
        expected_monthly_revenue_lift: 1200,
        ROI: "(1200 * 12 - 2400) / 4000 = 3.0x annual ROI",
        confidence: 70,
        risk_score: 4,
        mitigations: [
          "Focus on existing patients first",
          "Offer trial period to GPs",
        ],
      },
      {
        id: "init-3",
        title: "Vaccination Program Expansion",
        priority: 3,
        owner_role: "Pharmacy Manager",
        start_week: 13,
        duration_weeks: 12,
        tasks: [
          {
            task_id: "task-3-1",
            title: "Set up vaccination area and equipment",
            owner: "Pharmacy Manager",
            est_hours: 10,
            acceptance_criteria: "Compliant vaccination space operational",
          },
          {
            task_id: "task-3-2",
            title: "Launch marketing campaign",
            owner: "Marketing Lead",
            est_hours: 25,
            acceptance_criteria: "500+ patients aware of vaccination services",
          },
        ],
        one_time_cost: 3000,
        recurring_annual_cost: 1200,
        expected_monthly_revenue_lift: 600,
        ROI: "(600 * 12 - 1200) / 3000 = 2.0x annual ROI",
        confidence: 65,
        risk_score: 5,
        mitigations: [
          "Partner with local health campaigns",
          "Seasonal focus on flu vaccines",
        ],
      },
    ],
    mermaid_timeline: `timeline
    title Pharmacy Opportunity Plan
    Q1 : Expand HMR Services
        : Implement System Training
    Q2 : Launch DAA-Eligible Services
        : Enhance IDAA Programs
    Q3 : Expand ODT Supply Services
    Q4 : Optimize Diabetes MedsChecks`,
    financial_breakdown: {
      total_one_time_costs: 10000,
      total_recurring_costs: 3600,
      total_monthly_revenue_lift: 2600,
      payback_period_months: 3.85,
      arithmetic:
        "One-time: $3,000 + $4,000 + $3,000 = $10,000 | Annual recurring: $2,400 + $1,200 = $3,600 | Monthly lift: $800 + $1,200 + $600 = $2,600 | Payback: $10,000 / $2,600 = 3.85 months",
    },
    validation: [
      "ROI calculations assume full service uptake within timeframes",
      "Cost estimates based on typical Australian pharmacy rates",
      "Revenue projections conservative compared to CPA benchmarks",
    ],
    notes:
      "This is a fallback plan provided due to technical issues. Consider it a starting template that should be customized based on your specific circumstances and local market conditions.",
  };
}
