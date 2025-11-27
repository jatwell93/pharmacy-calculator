// netlify/functions/generate-plan-background.js
// FIXED: Moved Firebase initialization from module-level to handler function
// to ensure environment variables are available at runtime

// Retry configuration constants
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Base delay in milliseconds (1 second)

const { v4: uuidv4 } = require("uuid");

// Helper function to initialize database based on environment
// This is called inside the handler to ensure env vars are available
function initializeDatabase() {
  // Log environment variable status for debugging
  console.log("🔍 Environment Check:", {
    NETLIFY: process.env.NETLIFY,
    CONTEXT: process.env.CONTEXT,
    NODE_ENV: process.env.NODE_ENV,
    hasFirebaseApiKey: !!process.env.FIREBASE_API_KEY,
    hasFirebaseAuthDomain: !!process.env.FIREBASE_AUTH_DOMAIN,
    hasFirebaseDatabaseUrl: !!process.env.FIREBASE_DATABASE_URL,
    hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
    FORCE_LOCAL_DB: process.env.FORCE_LOCAL_DB
  });

  const isProduction = process.env.NETLIFY === "true" || process.env.CONTEXT === "production";
  const forceLocalDb = process.env.FORCE_LOCAL_DB === "true";
  
  const hasFirebaseConfig = process.env.FIREBASE_API_KEY &&
                           process.env.FIREBASE_AUTH_DOMAIN &&
                           process.env.FIREBASE_DATABASE_URL &&
                           process.env.FIREBASE_PROJECT_ID;

  let database, dbRef, dbSet;

  if (hasFirebaseConfig && !forceLocalDb) {
    // Use Firebase when config is available (production or development with Firebase)
    console.log("🔐 Using Firebase Realtime Database");
    try {
      const firebaseAppModule = require("firebase/app");
      const firebaseDbModule = require("firebase/database");
      
      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
      };

      // Check if app is already initialized
      let app;
      if (firebaseAppModule.getApps().length === 0) {
        app = firebaseAppModule.initializeApp(firebaseConfig);
      } else {
        app = firebaseAppModule.getApp();
      }
      
      database = firebaseDbModule.getDatabase(app);
      dbRef = firebaseDbModule.ref;
      dbSet = firebaseDbModule.set;
      console.log("✅ Firebase initialized successfully");
    } catch (firebaseError) {
      console.error("❌ Firebase initialization failed:", firebaseError.message);
      throw new Error(`Firebase initialization failed: ${firebaseError.message}`);
    }
  } else if (forceLocalDb || !isProduction) {
    // Development mode: use local file-backed database
    console.log("⚙️ Development mode: using local file-backed database");
    try {
      const localDb = require("../../dev/localDatabase");
      const app = localDb.initializeApp({});
      database = localDb.getDatabase(app);
      dbRef = localDb.ref;
      dbSet = localDb.set;
      console.log("✅ Local database initialized successfully");
    } catch (localDbError) {
      console.error("❌ Local database initialization failed:", localDbError.message);
      throw new Error(`Local database initialization failed: ${localDbError.message}`);
    }
  } else {
    // Production but missing Firebase config - this is an error state
    console.error("❌ PRODUCTION ERROR: Missing Firebase configuration.");
    console.error("Required variables: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_DATABASE_URL, FIREBASE_PROJECT_ID");
    console.error("Current values:", {
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ? "SET" : "NOT SET",
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ? "SET" : "NOT SET",
      FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL ? "SET" : "NOT SET",
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "SET" : "NOT SET",
    });
    throw new Error("Firebase configuration missing for production deployment. Please set environment variables in Netlify dashboard.");
  }

  return { database, dbRef, dbSet };
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

    // Initialize database - this is now done inside the handler to ensure
    // environment variables are available at runtime
    const { database, dbRef, dbSet } = initializeDatabase();
    console.log("📱 Database initialized for job:", jobId);

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

        await dbSet(dbRef(database, `plans/${jobId}`), {
          status: "complete",
          plan,
          completedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Background error for job", jobId, ":", error);
        await dbSet(dbRef(database, `plans/${jobId}`), {
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
  const systemMessage = `You are a pharmacy operations consultant. Respond ONLY with valid JSON. No other text.`;

  const userMessage = `Generate comprehensive implementation plan. Output ONLY JSON with these exact keys:
- "executive_summary": string (max 8 sentences)
- "plan": array of 5-7 initiatives (REQUIRED, not empty). Each: id, title, priority (1-5), owner_role, start_week (int), duration_weeks (int), tasks (2+: task_id, title, owner, est_hours, acceptance_criteria), one_time_cost (num), recurring_annual_cost (num), expected_monthly_revenue_lift (num), ROI (string), confidence (0-100), risk_score (1-5), top_2_mitigations (2 strings)
- "quarterly_milestones": array of 4 (Q1-Q4): quarter, cumulative_revenue_target, volume_targets, checkpoint_metrics
- "financial_breakdown": total_one_time_costs (num), total_recurring_costs (num), total_monthly_revenue_lift (num), payback_period_months (num), arithmetic (string)
- "validation": array of strings
- "notes": string

ALLOWED SERVICES ONLY: DAA, Staged Supply, MedsChecks, Diabetes MedsChecks, HMRs, RMMRs, QUM, ODT, THN, Vaccinations (COVID/Flu/NIPVIP/MMR/dTpa/HPV/Shingles/RSV), App enrolments, UTI consultation, OCP consultation, Minor skin conditions, Travel health, Weight management, Sleep studies, Wound care, Home delivery, Adalimumab, Etanercept

FORBIDDEN: telemedicine, virtual care, online consultations, unlisted services

IMPORTANT: Generate initiatives from the HIGHEST revenue-opportunity services in the data. Use all positive-revenue services to create a thorough, multi-phased implementation strategy across 6 months to 12 months. Prioritize by revenue impact (1=highest revenue, 7=moderate revenue).

Data:
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
    model: "qwen/qwen3-vl-235b-a22b-thinking",
    messages: [
      {
        role: "system",
        content:
          "You are a business planning assistant skilled in business plans. From the provided JSON you will create a succinct plan for the business to achieve its targets. Respond ONLY with valid JSON matching the exact schema in the user message. No additional text or markdown.",
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
      plan.plan === undefined ||
      !plan.financial_breakdown
    ) {
      console.error("Missing required sections in plan:", Object.keys(plan));
      throw new Error(
        "AI response missing required sections (executive_summary, plan, or financial_breakdown)",
      );
    }

    // Validate plan array structure
    if (!Array.isArray(plan.plan)) {
      throw new Error("Plan section must be an array of initiatives");
    }
    
    // If plan is empty, use fallback plan
    if (plan.plan.length === 0) {
      console.warn("⚠️ AI returned empty plan array, using fallback plan");
      return generateFallbackPlan();
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
      {
        id: "init-4",
        title: "Implement Diabetes MedsChecks Service",
        priority: 4,
        owner_role: "Accredited Pharmacist",
        start_week: 5,
        duration_weeks: 6,
        tasks: [
          {
            task_id: "task-4-1",
            title: "Train staff on diabetes care protocols",
            owner: "Lead Pharmacist",
            est_hours: 12,
            acceptance_criteria: "Team certified in diabetes medication review",
          },
          {
            task_id: "task-4-2",
            title: "Establish referral relationships with GPs",
            owner: "Pharmacy Manager",
            est_hours: 10,
            acceptance_criteria: "5+ GPs actively referring diabetes patients",
          },
        ],
        one_time_cost: 2500,
        recurring_annual_cost: 1800,
        expected_monthly_revenue_lift: 450,
        ROI: "(450 * 12 - 1800) / 2500 = 1.68x annual ROI",
        confidence: 68,
        risk_score: 3,
        mitigations: [
          "Partner with diabetes educator",
          "Start with existing diabetic patients",
        ],
      },
      {
        id: "init-5",
        title: "Launch Minor Ailments & OTC Consultation Service",
        priority: 5,
        owner_role: "Accredited Pharmacist",
        start_week: 9,
        duration_weeks: 8,
        tasks: [
          {
            task_id: "task-5-1",
            title: "Develop consultation protocols",
            owner: "Lead Pharmacist",
            est_hours: 15,
            acceptance_criteria: "Protocol templates approved by management",
          },
          {
            task_id: "task-5-2",
            title: "Market service to local community",
            owner: "Marketing Lead",
            est_hours: 12,
            acceptance_criteria: "100+ patients aware of minor ailment service",
          },
        ],
        one_time_cost: 2000,
        recurring_annual_cost: 1400,
        expected_monthly_revenue_lift: 350,
        ROI: "(350 * 12 - 1400) / 2000 = 1.75x annual ROI",
        confidence: 72,
        risk_score: 2,
        mitigations: [
          "Ensure clear scope of practice boundaries",
          "Build relationship with local GPs",
        ],
      },
      {
        id: "init-6",
        title: "Expand Health & Wellness Services",
        priority: 6,
        owner_role: "Pharmacy Manager",
        start_week: 17,
        duration_weeks: 10,
        tasks: [
          {
            task_id: "task-6-1",
            title: "Develop travel health packages",
            owner: "Accredited Pharmacist",
            est_hours: 10,
            acceptance_criteria: "3+ travel health packages ready to market",
          },
          {
            task_id: "task-6-2",
            title: "Launch weight management referral program",
            owner: "Pharmacy Manager",
            est_hours: 8,
            acceptance_criteria: "Partnership with 2+ weight management providers",
          },
        ],
        one_time_cost: 1500,
        recurring_annual_cost: 1280,
        expected_monthly_revenue_lift: 320,
        ROI: "(320 * 12 - 1280) / 1500 = 1.71x annual ROI",
        confidence: 60,
        risk_score: 4,
        mitigations: [
          "Focus on seasonal opportunities",
          "Partner with external specialists",
        ],
      },
      {
        id: "init-7",
        title: "Optimize Prescription Delivery & Home Medicine Reviews",
        priority: 7,
        owner_role: "Pharmacy Manager",
        start_week: 3,
        duration_weeks: 4,
        tasks: [
          {
            task_id: "task-7-1",
            title: "Set up prescription delivery logistics",
            owner: "Operations Lead",
            est_hours: 8,
            acceptance_criteria: "Delivery process documented and operational",
          },
          {
            task_id: "task-7-2",
            title: "Establish home medicine review protocols",
            owner: "Lead Pharmacist",
            est_hours: 12,
            acceptance_criteria: "HMR procedures aligned with CPA standards",
          },
        ],
        one_time_cost: 3000,
        recurring_annual_cost: 1600,
        expected_monthly_revenue_lift: 400,
        ROI: "(400 * 12 - 1600) / 3000 = 1.27x annual ROI",
        confidence: 75,
        risk_score: 2,
        mitigations: [
          "Use local delivery partners initially",
          "Prioritize high-value HMR candidates",
        ],
      },
    ],
    financial_breakdown: {
      total_one_time_costs: 21000,
      total_recurring_costs: 7000,
      total_monthly_revenue_lift: 4120,
      payback_period_months: 5.1,
      arithmetic:
        "One-time: $3,000 + $4,000 + $3,000 + $2,500 + $2,000 + $1,500 + $3,000 = $21,000 | Annual recurring: $2,400 + $1,200 + $1,800 + $1,400 + $1,280 + $1,600 = $7,000 | Monthly lift: $800 + $1,200 + $600 + $450 + $350 + $320 + $400 = $4,120 | Payback: $21,000 / $4,120 = 5.1 months",
    },
    validation: [
      "ROI calculations assume full service uptake within timeframes",
      "Cost estimates based on typical Australian pharmacy rates",
      "Revenue projections conservative compared to CPA benchmarks",
      "Phased implementation allows for cash flow management",
    ],
    notes:
      "This is a comprehensive fallback plan provided due to technical issues. It includes 7 initiatives covering multiple service categories. Consider it a starting template that should be customized based on your specific circumstances and local market conditions.",
  };
}
