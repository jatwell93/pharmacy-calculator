// This is our "mini-program" that talks to the AI
exports.handler = async function(event, context) {
  // Only allow POST requests (for security)
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get the data from your calculator
    const { analysisData, userPreferences } = JSON.parse(event.body);
    
    console.log('Received analysis data:', analysisData);
    
    // For now, let's just return a test response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        plan: {
          timeline: {
            ganttChart: "gantt\ntitle Test Timeline\ndateFormat YYYY-MM-DD\nsection Phase 1\nTest Task :2024-01-01, 30d",
            milestones: ["Month 1: Test milestone"]
          },
          actions: {
            staffing: ["Test staffing action"],
            marketing: ["Test marketing action"]
          },
          financials: {
            investmentRequired: 10000,
            projectedROI: 2.5
          }
        }
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Failed to generate plan: ' + error.message
      })
    };
  }
};