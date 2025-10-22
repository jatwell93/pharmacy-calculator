// netlify/functions/generate-plan.js
exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { analysisData, userPreferences } = JSON.parse(event.body);

    console.log("Generating AI plan for:", analysisData.length, "services");

    // 1. Create the AI prompt
    const prompt = createPharmacyPrompt(analysisData, userPreferences);

    // 2. Call OpenRouter AI
    const aiResponse = await callOpenRouterAI(prompt);

    // 3. Parse and return the plan
    const plan = parseAIResponse(aiResponse);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        plan: plan,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: "Failed to generate plan: " + error.message,
        // Provide fallback plan so user still gets something useful
        fallbackPlan: generateFallbackPlan(),
      }),
    };
  }
};

// ==================== AI PROMPT ENGINEERING ====================

function createPharmacyPrompt(analysisData, userPreferences) {
  const growthServices = analysisData.filter(
    (service) => service.additionalValue > 0 && service.growthPercentage > 0,
  );

  const topOpportunities = growthServices
    .sort((a, b) => b.additionalValue - a.additionalValue)
    .slice(0, 10); // Increased to top 10

  return `CRITICAL: You are an expert Australian pharmacy business consultant creating a DETAILED 6-month implementation plan.

DATA ANALYSIS - ${growthServices.length} GROWTH OPPORTUNITIES:

${topOpportunities
  .map(
    (service, index) =>
      `## ${index + 1}. ${service.name}
   - CURRENT: $${service.currentValue.toLocaleString()}/year
   - TARGET: $${service.potentialValue.toLocaleString()}/year
   - OPPORTUNITY: $${service.additionalValue.toLocaleString()} (${service.growthPercentage}% growth)
   - PRIORITY: ${service.additionalValue > 50000 ? "🔥 HIGH" : service.additionalValue > 20000 ? "🟡 MEDIUM" : "🟢 LOW"}`,
  )
  .join("\n\n")}

TOTAL OPPORTUNITY: $${analysisData.reduce((sum, s) => sum + s.additionalValue, 0).toLocaleString()}

CREATE AN EXTREMELY DETAILED PLAN WITH THIS EXACT JSON STRUCTURE:

{
  "timeline": {
    "ganttChart": "gantt\\n    title Pharmacy Growth Implementation Timeline\\n    dateFormat YYYY-MM-DD\\n    axisFormat %b %Y\\n    \\n    section High Priority Services\\n    [Service Name] Implementation :[crit/milestone/active/done], [id], [start_date], [duration]\\n    \\n    section Medium Priority Services\\n    [Service Name] Rollout :[crit/milestone/active/done], [id], [start_date], [duration]\\n    \\n    section Staff & Training\\n    [Training Topic] :[crit/milestone/active/done], [id], [start_date], [duration]",
    "milestones": ["Week 2: Complete [specific training]", "Month 1: Launch [specific service]", ...]
  },
  "actions": {
    "staffing": ["Hire [role] for [specific service] - [hours/week] - $[salary]", "Train [number] staff on [specific skill] - [duration] - $[cost]", ...],
    "marketing": ["[Channel]: [specific campaign] targeting [audience] - $[budget]", "[Activity]: [specific action] with [expected results]", ...],
    "operations": ["Implement [system/process] for [specific service] - [timeline]", "Purchase [equipment/software] - $[cost] - [ROI timeframe]", ...],
    "compliance": ["[Accreditation]: [specific requirement] - [deadline]", "[Documentation]: [specific system] - [compliance standard]", ...]
  },
  "financials": {
    "investmentRequired": [detailed calculation based on services],
    "projectedROI": [realistic calculation],
    "breakdown": "Detailed line-item breakdown:\\n- Staff: $[amount] for [details]\\n- Marketing: $[amount] for [details]\\n- Equipment: $[amount] for [details]\\n- Training: $[amount] for [details]\\n- Total: $[total]"
  }
}

NON-NEGOTIABLE REQUIREMENTS:
1. MUST reference specific services from the data above (DAA, HMRs, Vaccinations, etc.)
2. MUST include dollar amounts, timelines, and specific actions
3. MUST create detailed Gantt chart with at least 15 tasks across multiple sections
4. MUST include at least 8 staffing actions, 6 marketing actions, 5 operations actions
5. MUST calculate investment based on actual service implementation costs
6. MUST provide month-by-month milestones with specific deliverables
7. MUST consider Australian pharmacy regulations and CPA requirements
8. MUST be realistic about implementation complexity and timelines

FAILURE TO FOLLOW THESE REQUIREMENTS WILL RESULT IN POOR PHARMACY OUTCOMES.`;
}

// ==================== AI API CALL ====================

async function callOpenRouterAI(prompt) {
  // Get API key from environment variables
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OpenRouter API key not configured");
  }

  console.log("🔍 DEBUG: Prompt length:", prompt.length);
  console.log("🔍 DEBUG: First 200 chars of prompt:", prompt.substring(0, 200));

  const requestBody = {
    model: "nousresearch/deephermes-3-llama-3-8b-preview:free",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.7,
  };

  console.log(
    "🔍 DEBUG: Request body size:",
    JSON.stringify(requestBody).length,
  );

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pharmacy-opportunity-analyser.netlify.app",
        "X-Title": "Pharmacy Opportunity Calculator",
      },
      body: JSON.stringify(requestBody),
    },
  );

  console.log("🔍 DEBUG: Response status:", response.status);

  // === IMPROVED ERROR HANDLING ===
  if (!response.ok) {
    const status = response.status;

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
      throw new Error(`OpenRouter Error (${status}): ${errorMessages[status]}`);
    } else {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${status} - ${errorText}`);
    }
  }

  const data = await response.json();
  console.log("🔍 DEBUG: AI response received");
  return data.choices[0].message.content;
}

// ==================== RESPONSE PARSING ====================

function parseAIResponse(aiResponse) {
  try {
    const cleanedResponse = aiResponse.replace(/```json\s*|\s*```/g, "");
    const plan = JSON.parse(cleanedResponse);

    // Validate we got the basic structure
    if (!plan.timeline || !plan.actions || !plan.financials) {
      throw new Error("AI response missing required sections");
    }

    // Fix Mermaid syntax if needed
    if (plan.timeline.ganttChart) {
      plan.timeline.ganttChart = fixMermaidSyntax(plan.timeline.ganttChart);
    }

    return plan;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.log("Raw AI response:", aiResponse);
    throw new Error("AI returned an invalid format. Please try again.");
  }
}

// New function to fix common Mermaid syntax issues
function fixMermaidSyntax(mermaidText) {
  let fixed = mermaidText;

  // Remove any markdown code blocks
  fixed = fixed.replace(/```mermaid\s*|\s*```/g, "");

  // Ensure it starts with proper gantt declaration
  if (!fixed.includes("gantt")) {
    fixed =
      "gantt\n    title Pharmacy Implementation Timeline\n    dateFormat YYYY-MM-DD\n" +
      fixed;
  }

  // Fix common formatting issues
  fixed = fixed.replace(/^\s*section\s+/gm, "    section ");
  fixed = fixed.replace(/^\s*task\s+/gm, "    ");
  fixed = fixed.replace(/:\s*(done|active|crit)/g, " :$1");

  // Ensure each line is properly indented
  fixed = fixed
    .split("\n")
    .map((line) => {
      if (line.trim().startsWith("section")) {
        return "    " + line.trim();
      } else if (
        line.trim().length > 0 &&
        !line.trim().startsWith("gantt") &&
        !line.trim().startsWith("title") &&
        !line.trim().startsWith("dateFormat")
      ) {
        return "        " + line.trim();
      }
      return line;
    })
    .join("\n");

  console.log("🔍 DEBUG: Fixed Mermaid syntax:", fixed);
  return fixed;
}

// ==================== FALLBACK PLAN ====================

function generateFallbackPlan() {
  return {
    timeline: {
      ganttChart: `gantt
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
      milestones: [
        "Month 1: Complete staff training and accreditation",
        "Month 2: Launch DAA and medication review services",
        "Month 3: Begin vaccination program marketing",
        "Month 6: Review performance and adjust strategy",
      ],
    },
    actions: {
      staffing: [
        "Train existing staff on professional services",
        "Consider hiring an additional pharmacist if volume increases",
      ],
      marketing: [
        "Inform existing patients about new services",
        "Reach out to local GPs to build referral relationships",
        "Create patient education materials",
      ],
      operations: [
        "Update your dispensing software for new services",
        "Create patient follow-up and recall systems",
      ],
      compliance: [
        "Review CPA guidelines for each service",
        "Ensure documentation meets professional standards",
      ],
    },
    financials: {
      investmentRequired: 10000,
      projectedROI: 2.5,
      breakdown:
        "Conservative estimate including staff training and marketing costs",
    },
  };
}
