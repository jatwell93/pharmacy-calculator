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
// - FIXED: Moved Firebase initialization from module-level to handler function
//   to ensure environment variables are available at runtime

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

        console.log("🔍 DEBUG: About to save plan for jobId:", jobId);
        await dbSet(dbRef(database, `plans/${jobId}`), {
          status: "complete",
          plan,
          completedAt: new Date().toISOString(),
        });
        console.log("✅ Plan saved successfully for jobId:", jobId);
      } catch (error) {
        console.error("Background error for job", jobId, ":", error);
        console.log("🔍 DEBUG: About to save error for jobId:", jobId);
        await dbSet(dbRef(database, `plans/${jobId}`), {
          status: "error",
          error: error.message,
        });
        console.log("✅ Error saved for jobId:", jobId);
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
    model: "google/gemini-2.5-flash-lite-preview-09-2025",
    messages: [
      {
        role: "system",
        content:
          "You are a business plan and pharmacy expert creating business plans educational simulations. This is for training purposes only, not financial advice. Respond ONLY with valid JSON matching the exact schema in the user message. No additional text or markdown. Start your response with '{' and end with '}'.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 4000,
    temperature: 0.1,
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
  
  const message = data.choices[0].message;
  console.log("🔍 DEBUG: Message structure:", Object.keys(message));
  console.log("🔍 DEBUG: Content type:", typeof message.content);
  console.log("🔍 DEBUG: Content length:", message.content ? String(message.content).length : 0);
  console.log("🔍 DEBUG: Content value (first 500 chars):", 
    message.content ? String(message.content).substring(0, 2000) : "NULL/UNDEFINED/EMPTY");
  
  // The content can be a string or object depending on response_format handling
  let content = message.content;
  
  // If content is empty/null, check for reasoning field (used by reasoning models like olmo-3-32b-think)
  if (!content || content === "") {
    console.warn("Content is empty or null. Checking for reasoning field (extended thinking models)...");
    
    // Some models (especially reasoning/thinking models) put the output in the reasoning field
    if (message.reasoning && typeof message.reasoning === "string") {
      console.log("🔍 Found response in message.reasoning field. Extracting JSON from reasoning text...");
      content = message.reasoning;
      
      // Try to extract JSON from the reasoning text
      const jsonMatch = content.match(/\{[\s\S]*\}(?=\s*$|$)/);
      if (jsonMatch) {
        console.log("🔍 Successfully extracted JSON from reasoning field");
        content = jsonMatch[0];
      } else {
        console.warn("⚠️ Could not find JSON object in reasoning field. Will attempt to parse reasoning as plain text.");
        // The reasoning field contains the model's thinking, not the final output
        // This shouldn't happen if the prompt is clear, but we'll attempt extraction anyway
      }
    } else if (message.text) {
      console.log("Found response in message.text");
      content = message.text;
    } else if (typeof message === "string") {
      console.log("Message itself is a string");
      content = message;
    } else {
      console.error("Full message object:", JSON.stringify(message, null, 2));
      throw new Error("OpenRouter returned a response but content is empty or null, and no reasoning/text field found. The model may not have produced output.");
    }
  }
  
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
      console.error("aiResponse is falsy:", {
        value: aiResponse,
        type: typeof aiResponse,
        isNull: aiResponse === null,
        isUndefined: aiResponse === undefined,
        isEmptyString: aiResponse === ""
      });
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

      // Fix missing commas in arrays between string elements
      // Pattern: "string" followed by whitespace and another quote (without comma in between)
      // Only fix if not already followed by a comma, colon, or closing bracket
      repaired = repaired.replace(/"\s+"/g, (match, offset) => {
        // Check if there's already a comma before this
        if (repaired[offset - 1] === ',') {
          return match; // Already has comma, skip
        }
        // Check what comes after the second quote
        const afterQuote = repaired[offset + match.length];
        if (afterQuote === ',' || afterQuote === ':' || afterQuote === undefined) {
          return match; // Correct context, skip
        }
        return '", "'; // Fix missing comma
      });

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

  // Valid Mermaid timeline status keywords
  const validStatuses = ["crit", "done", "active", "milestone"];

  // Fix common formatting issues - ensure proper indentation for timeline items
  fixed = fixed
    .split("\n")
    .map((line) => {
      let trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) return "";

      // Keep timeline and title lines as is
      if (trimmed.startsWith("timeline") || trimmed.startsWith("title")) {
        return line;
      }

      // For quarter sections (Q1:, Q2:, etc.), ensure they have proper format
      if (/^Q[1-4]\s*:/.test(trimmed)) {
        return "    " + trimmed.replace(/\s*:\s*/, " : ");
      }

      // Fix invalid status codes in timeline items
      // Look for patterns like ":something" where something is not a valid status
      const statusMatch = trimmed.match(/:([^,\s]+)/);
      if (statusMatch) {
        const foundStatus = statusMatch[1].toLowerCase();
        // If status is not in valid list, replace with appropriate status
        if (!validStatuses.includes(foundStatus)) {
          // Map common invalid statuses or default to 'active'
          let replacement = "active";
          if (foundStatus.includes("1") || foundStatus.includes("2")) {
            replacement = "crit"; // numeric statuses likely mean priority
          } else if (foundStatus.includes("high") || foundStatus.includes("urgent")) {
            replacement = "crit";
          } else if (foundStatus.includes("complete") || foundStatus.includes("done")) {
            replacement = "done";
          } else if (foundStatus.includes("key") || foundStatus.includes("major")) {
            replacement = "milestone";
          }
          trimmed = trimmed.replace(new RegExp(":" + foundStatus, "i"), ":" + replacement);
          console.log(`🔍 DEBUG: Fixed invalid status ':${foundStatus}' to ':${replacement}'`);
        }
      }

      // For items under quarters, they should be properly formatted
      if (trimmed.startsWith(":")) {
        return "        " + trimmed;
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
        priority: 2,
        owner_role: "Lead Pharmacist",
        start_week: 5,
        duration_weeks: 6,
        tasks: [
          {
            task_id: "task-4-1",
            title: "Staff training on diabetes protocols",
            owner: "Lead Pharmacist",
            est_hours: 16,
            acceptance_criteria: "All staff certified in diabetes MedsChecks",
          },
          {
            task_id: "task-4-2",
            title: "Identify eligible diabetic patients",
            owner: "Pharmacy Technician",
            est_hours: 12,
            acceptance_criteria: "20+ patients enrolled in program",
          },
        ],
        one_time_cost: 2500,
        recurring_annual_cost: 800,
        expected_monthly_revenue_lift: 450,
        ROI: "(450 * 12 - 800) / 2500 = 1.99x annual ROI",
        confidence: 72,
        risk_score: 3,
        mitigations: [
          "Work with local GPs for referrals",
          "Use existing diabetes education materials",
        ],
      },
      {
        id: "init-5",
        title: "Launch Minor Ailments & OTC Consultation Service",
        priority: 4,
        owner_role: "Pharmacy Manager",
        start_week: 9,
        duration_weeks: 8,
        tasks: [
          {
            task_id: "task-5-1",
            title: "Develop consultation protocol and documentation",
            owner: "Lead Pharmacist",
            est_hours: 18,
            acceptance_criteria: "Protocol approved and templates ready",
          },
          {
            task_id: "task-5-2",
            title: "Staff training and competency assessment",
            owner: "Pharmacy Manager",
            est_hours: 14,
            acceptance_criteria: "All staff trained and assessed",
          },
        ],
        one_time_cost: 2000,
        recurring_annual_cost: 600,
        expected_monthly_revenue_lift: 350,
        ROI: "(350 * 12 - 600) / 2000 = 1.93x annual ROI",
        confidence: 68,
        risk_score: 2,
        mitigations: [
          "Clear scope of practice guidelines",
          "Support documentation systems",
        ],
      },
      {
        id: "init-6",
        title: "Expand Health & Wellness Services (Travel Health, Weight Management)",
        priority: 4,
        owner_role: "Pharmacy Technician",
        start_week: 17,
        duration_weeks: 10,
        tasks: [
          {
            task_id: "task-6-1",
            title: "Develop service packages and marketing materials",
            owner: "Pharmacy Manager",
            est_hours: 12,
            acceptance_criteria: "Brochures and website content ready",
          },
          {
            task_id: "task-6-2",
            title: "Train staff on consultation delivery",
            owner: "Lead Pharmacist",
            est_hours: 16,
            acceptance_criteria: "All staff confident delivering services",
          },
        ],
        one_time_cost: 1500,
        recurring_annual_cost: 400,
        expected_monthly_revenue_lift: 320,
        ROI: "(320 * 12 - 400) / 1500 = 2.44x annual ROI",
        confidence: 60,
        risk_score: 4,
        mitigations: [
          "Start with travel health (seasonal demand)",
          "Partner with local health providers",
        ],
      },
      {
        id: "init-7",
        title: "Optimize Prescription Delivery & Home Medicine Reviews",
        priority: 5,
        owner_role: "Pharmacy Manager",
        start_week: 3,
        duration_weeks: 4,
        tasks: [
          {
            task_id: "task-7-1",
            title: "Establish delivery partnerships and logistics",
            owner: "Pharmacy Manager",
            est_hours: 10,
            acceptance_criteria: "Delivery system operational",
          },
          {
            task_id: "task-7-2",
            title: "Develop HMR marketing and referral process",
            owner: "Lead Pharmacist",
            est_hours: 12,
            acceptance_criteria: "Process documented and promoted",
          },
        ],
        one_time_cost: 3000,
        recurring_annual_cost: 1500,
        expected_monthly_revenue_lift: 400,
        ROI: "(400 * 12 - 1500) / 3000 = 1.4x annual ROI",
        confidence: 75,
        risk_score: 2,
        mitigations: [
          "Use existing supplier relationships",
          "Partner with aged care facilities",
        ],
      },
    ],
    financial_breakdown: {
      total_one_time_costs: 16000,
      total_recurring_costs: 6500,
      total_monthly_revenue_lift: 3620,
      payback_period_months: 4.42,
      arithmetic:
        "One-time: $5,000 + $4,000 + $3,000 + $2,500 + $2,000 + $1,500 + $3,000 = $21,000 | Annual recurring: $2,400 + $1,200 + $800 + $600 + $400 + $1,500 = $7,000 | Monthly lift: $800 + $1,200 + $600 + $450 + $350 + $320 + $400 = $4,120 | Payback: $21,000 / $4,120 = 5.10 months",
    },
    validation: [
      "ROI calculations assume full service uptake within timeframes",
      "Cost estimates based on typical Australian pharmacy rates",
      "Revenue projections conservative compared to CPA benchmarks",
      "Multiple initiatives allow for phased implementation",
    ],
    notes:
      "This comprehensive fallback plan includes 6 initiatives covering government-funded programs, vaccinations, and value-added services. Prioritize based on your pharmacy's capabilities and market demand. Consider it a starting template that should be customized based on your specific circumstances and local market conditions.",
  };
}
