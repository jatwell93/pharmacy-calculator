// netlify/functions/generate-plan-background.js

// Retry configuration constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Base delay in milliseconds (1 second)

const { v4: uuidv4 } = require("uuid");
// Use local dev DB helper when Firebase env not configured
let initializeApp, getDatabase, ref, set;
if (!process.env.FIREBASE_DATABASE_URL) {
  console.log("Local dev: using file-backed local database");
  const localDb = require("../../dev/localDatabase");
  initializeApp = localDb.initializeApp;
  getDatabase = localDb.getDatabase;
  ref = localDb.ref;
  set = localDb.set;
} else {
  const firebaseAppModule = require("firebase/app");
  const firebaseDbModule = require("firebase/database");
  initializeApp = firebaseAppModule.initializeApp;
  getDatabase = firebaseDbModule.getDatabase;
  ref = firebaseDbModule.ref;
  set = firebaseDbModule.set;
}

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
  const systemMessage = `You are an operations consultant for small healthcare providers. Use the JSON payload below and produce a complete implementation plan suitable for handing to a store manager and a pharmacist. Be explicit about calculations. Avoid speculative claims. Stick to the data and state assumptions.`;

  const userMessage = `From the JSON payload, output:
- "executive_summary" (max 6 sentences)
- "plan" (array of initiatives; each initiative must include: id, title, priority (1-5), owner_role, start_week, duration_weeks, tasks (array of {task_id, title, owner, est_hours, acceptance_criteria}), one_time_cost, recurring_annual_cost, expected_monthly_revenue_lift, ROI (show arithmetic), confidence (0-100%), risk_score (0-10), top 2 mitigations).
- "mermaid_gantt" - a small mermaid gantt diagram that uses weeks as units that a front-end can render.
- "financial_breakdown": verify totals, sum of one_time_costs, recurring, and compute payback_period_months = one_time_cost / monthly_revenue_lift (per initiative and overall). Show the arithmetic for each computed number.
- "validation": run simple checks and list any inconsistencies (e.g., ROI > 1000x, negative costs).

Return valid JSON only (no extra commentary) in a top-level object with keys: executive_summary, plan, mermaid_gantt, financial_breakdown, validation, notes.

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
    model: "ibm-granite/granite-4.0-h-micro",
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
            mermaid_gantt: {
              type: "string",
              description: "Mermaid gantt diagram syntax",
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
            "mermaid_gantt",
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
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI call timed out")), 25000),
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
  return data.choices[0].message.content;
}

// ==================== RESPONSE PARSING ====================

function parseAIResponse(aiResponse) {
  try {
    if (!aiResponse) {
      throw new Error("Empty AI response received");
    }

    console.log("🔍 DEBUG: Raw AI response length:", aiResponse.length);
    console.log(
      "🔍 DEBUG: First 500 chars of AI response:",
      aiResponse.substring(0, 500),
    );

    let cleanedResponse = aiResponse;

    // Remove any markdown code blocks (multiple variations)
    cleanedResponse = cleanedResponse.replace(/```json\s*/gi, "");
    cleanedResponse = cleanedResponse.replace(/```JSON\s*/gi, "");
    cleanedResponse = cleanedResponse.replace(/```\s*/g, "");

    // Trim whitespace
    cleanedResponse = cleanedResponse.trim();

    // Extract the JSON object from the response, ignoring any text before or after
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    } else {
      console.error(
        "No JSON object found in response:",
        cleanedResponse.substring(0, 500),
      );
      throw new Error("No JSON object found in AI response");
    }

    console.log("🔍 DEBUG: Cleaned response length:", cleanedResponse.length);
    console.log(
      "🔍 DEBUG: First 500 chars of cleaned response:",
      cleanedResponse.substring(0, 500),
    );

    let plan;
    try {
      plan = JSON.parse(cleanedResponse);
    } catch (parseError) {
      // Try to repair common JSON issues before failing
      let repaired = cleanedResponse;

      // Remove trailing commas before } or ]
      repaired = repaired.replace(/,\s*([}\]])/g, "$1");

      // Fix single quotes to double in keys/values (simple case)
      repaired = repaired.replace(/'([^']*)':/g, '"$1":');
      repaired = repaired.replace(/:'([^']*)'/g, ':"$1"');

      // Ensure strings are double-quoted
      repaired = repaired.replace(
        /([^{},:]\s*):([^"\{]*?)(?=\s*,|\s*}|$)/g,
        '$1:"$2"',
      );

      console.log("🔍 DEBUG: Attempting repair on malformed JSON...");
      console.log(
        "Original snippet around error:",
        cleanedResponse.substring(4000, 4200),
      );

      try {
        plan = JSON.parse(repaired);
        console.log("🔍 DEBUG: JSON repaired successfully!");
      } catch (repairError) {
        // Repair failed, proceed with original error handling
        console.error("JSON parse error:", parseError);
        console.error("Failed to parse:", cleanedResponse.substring(0, 1000));

        // Try to identify common JSON errors
        if (cleanedResponse.includes("'") && !cleanedResponse.includes('"')) {
          throw new Error(
            "AI response uses single quotes instead of double quotes for JSON",
          );
        }
        if (cleanedResponse.match(/,\s*[}\]]/)) {
          throw new Error("AI response has trailing commas in JSON");
        }
        throw new Error(`JSON parse failed: ${parseError.message}`);
      }
    }

    // Validate we got the basic structure
    if (
      !plan.executive_summary ||
      !plan.plan ||
      !plan.mermaid_gantt ||
      !plan.financial_breakdown
    ) {
      console.error("Missing required sections in plan:", Object.keys(plan));
      throw new Error(
        "AI response missing required sections (executive_summary, plan, mermaid_gantt, or financial_breakdown)",
      );
    }

    // Validate plan array structure
    if (!Array.isArray(plan.plan)) {
      throw new Error("Plan section must be an array of initiatives");
    }

    // Fix Mermaid syntax if needed
    if (plan.mermaid_gantt) {
      plan.mermaid_gantt = fixMermaidSyntax(plan.mermaid_gantt);
    }

    console.log(
      "🔍 DEBUG: Successfully parsed plan with sections:",
      Object.keys(plan),
    );
    return plan;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.error(
      "Raw AI response:",
      aiResponse ? aiResponse.substring(0, 1000) : "null",
    );
    throw new Error(`AI response parsing failed: ${error.message}`);
  }
}

// Enhanced function to fix and validate Mermaid Gantt syntax
function fixMermaidSyntax(mermaidText) {
  let fixed = mermaidText;

  // Remove any markdown code blocks
  fixed = fixed.replace(/```mermaid\s*|\s*```/g, "");

  // Ensure it starts with proper gantt declaration
  if (!fixed.includes("gantt")) {
    fixed =
      "gantt\n    title Pharmacy Implementation Timeline\n    dateFormat YYYY-MM-DD\n    axisFormat %b %Y\n" +
      fixed;
  }

  // Fix common formatting issues
  fixed = fixed.replace(/^\s*section\s+/gm, "    section ");
  fixed = fixed.replace(/^\s*task\s+/gm, "    ");
  fixed = fixed.replace(/:\s*(done|active|crit|milestone)/g, " :$1");

  // Process each line to validate and fix task definitions
  fixed = fixed
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      // Skip empty lines or header lines
      if (
        !trimmed ||
        trimmed.startsWith("gantt") ||
        trimmed.startsWith("title") ||
        trimmed.startsWith("dateFormat") ||
        trimmed.startsWith("axisFormat") ||
        trimmed.startsWith("section")
      ) {
        // Indent section headers properly
        if (trimmed.startsWith("section")) {
          return "    " + trimmed;
        }
        return line; // Keep header lines as is
      }

      // Fix task lines - ensure they have required components
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) return "        " + trimmed; // Not a task line

      const taskName = trimmed.substring(0, colonIndex).trim();
      const taskData = trimmed.substring(colonIndex + 1).trim();

      // Split by comma to get components: status, id, startDate, duration
      const parts = taskData.split(",").map((p) => p.trim());

      // Validate and fix components
      let status = "";
      let taskId = "";
      let startDate = "";
      let duration = "";

      if (parts.length >= 1) {
        // First part should contain status
        const statusMatch = parts[0].match(/(crit|milestone|active|done)/);
        status = statusMatch ? statusMatch[0] : "active";

        // Remove status from first part if present
        parts[0] = parts[0].replace(/(crit|milestone|active|done)/, "").trim();
      } else {
        status = "active";
      }

      // Extract or set taskId (second part)
      taskId =
        parts.length >= 2
          ? parts[1]
          : "task" + Math.random().toString(36).substr(2, 5);

      // Extract or set startDate (third part) - ensure YYYY-MM-DD format
      if (parts.length >= 3) {
        startDate = parts[2].trim();
        // Basic date validation - if not valid, use today + offset
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
          const today = new Date();
          today.setDate(today.getDate() + Math.floor(Math.random() * 180)); // Random date within 6 months
          startDate = today.toISOString().split("T")[0];
        }
      } else {
        // Default start date: today + 1 month
        const today = new Date();
        today.setMonth(today.getMonth() + 1);
        startDate = today.toISOString().split("T")[0];
      }

      // Extract or set duration (fourth part) - ensure format like 30d, 2w, etc.
      if (parts.length >= 4) {
        duration = parts[3].trim();
        // Basic duration validation
        if (!/^\d+[dwmy]$/i.test(duration)) {
          duration = "30d"; // Default 30 days
        }
      } else {
        duration = "30d";
      }

      // Reconstruct the task line
      const fixedTask = `${taskName} :${status}, ${taskId}, ${startDate}, ${duration}`;
      return "        " + fixedTask;
    })
    .join("\n");

  console.log("🔍 DEBUG: Fixed Mermaid syntax:", fixed);
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
    mermaid_gantt: `gantt
    title Pharmacy Growth Plan (6 Months)
    dateFormat  YYYY-MM-DD
    axisFormat %b %Y

    section Staff & Training
    Pharmacist Training    :crit, training, 2024-01-01, 30d
    System Setup           :after training, 14d

    section Service Launch
    DAA Program Launch     :milestone, m1, 2024-02-15, 1d
    Vaccination Services   :after m1, 60d

    section Marketing
    GP Engagement         :2024-01-15, 45d
    Patient Outreach      :2024-03-01, 90d`,
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
