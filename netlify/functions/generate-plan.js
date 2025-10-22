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
  //filter for only growth services
  const growthServices = analysisData.filter(
    (service) => service.additionalValue > 0 && service.growthPercentage > 0,
  );
  //Sort by biggest opportunities
  const topOpportunities = analysisData
    .sort((a, b) => b.additionalValue - a.additionalValue)
    .slice(0, 5);

  return `You are an expert Australian pharmacy business consultant with 20+ years experience.
Create a DETAILED 6-month action plan specifically tailored to this pharmacy's unique opportunity profile.

CRITICAL DATA ANALYSIS:
The pharmacy has ${growthServices.length} services with growth potential.
Top ${topOpportunities.length} revenue opportunities:

${topOpportunities
  .map(
    (service, index) =>
      `${index + 1}. ${service.name}:
   - Current: $${service.currentValue.toLocaleString()}/year
   - Potential: $${service.potentialValue.toLocaleString()}/year
   - Opportunity: $${service.additionalValue.toLocaleString()} (${service.growthPercentage}% growth)
   - PRIORITY: ${service.additionalValue > 50000 ? "HIGH" : service.additionalValue > 20000 ? "MEDIUM" : "LOW"}`,
  )
  .join("\n\n")}
TOTAL IDENTIFIED OPPORTUNITY: $${analysisData.reduce((sum, s) => sum + s.additionalValue, 0).toLocaleString()}

CREATE A HIGHLY DETAILED PLAN WITH THIS EXACT JSON STRUCTURE:
{
  "timeline": {
    "ganttChart": "detailed mermaid gantt syntax with specific tasks for each major service",
    "milestones": ["Month 1: Specific milestone", "Month 2: Specific milestone", ...]
  },
  "actions": {
    "staffing": ["Specific staffing action 1", "Specific staffing action 2", ...],
    "marketing": ["Specific marketing action 1", "Specific marketing action 2", ...],
    "operations": ["Specific operations action 1", "Specific operations action 2", ...],
    "compliance": ["Specific compliance action 1", "Specific compliance action 2", ...]
  },
  "financials": {
    "investmentRequired": 15000,
    "projectedROI": 3.2,
    "breakdown": "Detailed breakdown of costs and expected returns"
  }
}

PHARMACY CONTEXT:
- Timeline: 6 months
- Focus: High-ROI professional services
- Location: Australian community pharmacy

CREATE A PLAN WITH THIS EXACT JSON STRUCTURE:
{
  "timeline": {
    "ganttChart": "gantt\ntitle Pharmacy Growth Plan\ndateFormat YYYY-MM-DD\naxisFormat %b %Y\nsection Staff & Training\nPharmacist Training :crit, training, 2024-01-01, 30d\nSystem Setup :after training, 14d\n\nsection Service Launch\nDAA Program Launch :milestone, m1, 2024-02-15, 1d\nVaccination Services :after m1, 60d\n\nsection Marketing\nGP Engagement :2024-01-15, 45d\nPatient Outreach :2024-03-01, 90d",
    "milestones": ["Month 1: Complete staff training", "Month 2: Launch marketing campaign"]
  },
  "actions": {
    "staffing": ["Hire additional pharmacist", "Train staff on DAA services"],
    "marketing": ["Local GP engagement", "Patient education campaign"],
    "operations": ["Update software systems", "Create patient follow-up process"],
    "compliance": ["Review CPA guidelines", "Ensure documentation standards"]
  },
  "financials": {
    "investmentRequired": 15000,
    "projectedROI": 3.2,
    "breakdown": "Text description of costs and returns"
  }
}

IMPORTANT: Respond ONLY with valid JSON matching this structure. Do not include any markdown, extra text, or explanations.

REQUIREMENTS:
- Focus on the HIGH and MEDIUM priority services first
- Include specific Australian pharmacy regulations (CPA, accreditation)
- Provide measurable targets and timelines
- Consider staff training requirements for each service
- Include patient acquisition strategies
- Address operational changes needed
- Be realistic about implementation complexity`;
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
    // Extract the JSON object from the response using regex
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in response");
    }
    const plan = JSON.parse(jsonMatch[0]);

    // Validate we got the basic structure
    if (!plan.timeline || !plan.actions || !plan.financials) {
      throw new Error("AI response missing required sections");
    }

    return plan;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    console.log("Raw AI response:", aiResponse);
    throw new Error("AI returned an invalid format. Please try again.");
  }
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
