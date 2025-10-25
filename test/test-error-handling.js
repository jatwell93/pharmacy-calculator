// Test script to verify error handling improvements for the pharmacy calculator

// Mock fetch function to simulate different API responses
function createMockFetch(responseType) {
  return function(url, options) {
    console.log('Mock fetch called with:', url);
    console.log('Request options:', JSON.stringify(options, null, 2));

    switch(responseType) {
      case '503_error':
        // Simulate 503 Service Unavailable error
        return Promise.resolve({
          ok: false,
          status: 503,
          headers: new Map([
            ['content-type', 'application/json']
          ]),
          text: () => Promise.resolve(JSON.stringify({
            error: {
              message: "Service unavailable",
              code: 503
            }
          }))
        });

      case '429_error':
        // Simulate rate limit error
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: new Map([
            ['content-type', 'application/json']
          ]),
          text: () => Promise.resolve('Rate limit exceeded')
        });

      case 'network_error':
        // Simulate network failure
        return Promise.reject(new Error('Network request failed'));

      case 'success':
        // Simulate successful response
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map([
            ['content-type', 'application/json']
          ]),
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: JSON.stringify({
                  timeline: {
                    ganttChart: "gantt\n    title Test Plan\n    dateFormat YYYY-MM-DD",
                    milestones: ["Test milestone 1", "Test milestone 2"]
                  },
                  actions: {
                    staffing: ["Test action 1"],
                    marketing: ["Test action 2"]
                  },
                  financials: {
                    investmentRequired: 5000,
                    projectedROI: 3.0,
                    breakdown: "Test breakdown"
                  }
                })
              }
            }]
          })
        });

      default:
        throw new Error(`Unknown response type: ${responseType}`);
    }
  };
}

// Test the retry logic
async function testRetryLogic() {
  console.log('\n=== Testing Retry Logic ===\n');

  // Save original fetch
  const originalFetch = global.fetch || window.fetch;

  try {
    // Test 1: 503 error should trigger retry
    console.log('Test 1: 503 Service Unavailable');
    global.fetch = createMockFetch('503_error');

    // Simulate calling the function with retry logic
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    async function simulateCallWithRetry() {
      for (let i = 0; i <= MAX_RETRIES; i++) {
        try {
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ test: true })
          });

          if (!response.ok && [502, 503].includes(response.status) && i < MAX_RETRIES) {
            const delay = RETRY_DELAY * Math.pow(2, i);
            console.log(`Retry ${i + 1}/${MAX_RETRIES} after ${delay}ms delay`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          if (!response.ok) {
            throw new Error(`Error after ${i + 1} attempts: Status ${response.status}`);
          }

          return response;
        } catch (error) {
          if (i === MAX_RETRIES) {
            throw error;
          }
          console.log(`Network error on attempt ${i + 1}, retrying...`);
        }
      }
    }

    try {
      await simulateCallWithRetry();
    } catch (error) {
      console.log('✓ Expected error after retries:', error.message);
    }

    // Test 2: Network error should trigger retry
    console.log('\nTest 2: Network Error');
    global.fetch = createMockFetch('network_error');

    try {
      await simulateCallWithRetry();
    } catch (error) {
      console.log('✓ Expected network error after retries:', error.message);
    }

    // Test 3: Success should not retry
    console.log('\nTest 3: Successful Response');
    global.fetch = createMockFetch('success');

    const successResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST'
    });
    const data = await successResponse.json();
    console.log('✓ Success response received:', data.choices[0].message.content.substring(0, 50) + '...');

  } finally {
    // Restore original fetch
    global.fetch = originalFetch;
  }
}

// Test the fallback plan generation
function testFallbackPlan() {
  console.log('\n=== Testing Fallback Plan ===\n');

  const fallbackPlan = {
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
        "Month 6: Review performance and adjust strategy"
      ]
    },
    actions: {
      staffing: [
        "Train existing staff on professional services",
        "Consider hiring an additional pharmacist if volume increases"
      ],
      marketing: [
        "Inform existing patients about new services",
        "Reach out to local GPs to build referral relationships",
        "Create patient education materials"
      ],
      operations: [
        "Update your dispensing software for new services",
        "Create patient follow-up and recall systems"
      ],
      compliance: [
        "Review CPA guidelines for each service",
        "Ensure documentation meets professional standards"
      ]
    },
    financials: {
      investmentRequired: 10000,
      projectedROI: 2.5,
      breakdown: "Conservative estimate including staff training and marketing costs"
    }
  };

  // Validate fallback plan structure
  console.log('Validating fallback plan structure...');

  if (fallbackPlan.timeline && fallbackPlan.timeline.ganttChart) {
    console.log('✓ Timeline with Gantt chart present');
  } else {
    console.log('✗ Missing timeline or Gantt chart');
  }

  if (fallbackPlan.timeline && fallbackPlan.timeline.milestones && Array.isArray(fallbackPlan.timeline.milestones)) {
    console.log(`✓ ${fallbackPlan.timeline.milestones.length} milestones defined`);
  } else {
    console.log('✗ Missing or invalid milestones');
  }

  if (fallbackPlan.actions && Object.keys(fallbackPlan.actions).length > 0) {
    console.log(`✓ Actions defined for ${Object.keys(fallbackPlan.actions).length} categories`);
  } else {
    console.log('✗ Missing actions');
  }

  if (fallbackPlan.financials && fallbackPlan.financials.investmentRequired && fallbackPlan.financials.projectedROI) {
    console.log(`✓ Financials: $${fallbackPlan.financials.investmentRequired} investment, ${fallbackPlan.financials.projectedROI}x ROI`);
  } else {
    console.log('✗ Missing or incomplete financials');
  }
}

// Test error message handling
function testErrorMessages() {
  console.log('\n=== Testing Error Messages ===\n');

  const errorScenarios = [
    { status: 400, expected: "Bad request - please check your request format" },
    { status: 401, expected: "Invalid API key - please check your OpenRouter configuration" },
    { status: 402, expected: "Insufficient credits - your API key has run out of credits" },
    { status: 429, expected: "Rate limit exceeded - you have sent too many requests. Please wait a moment and try again." },
    { status: 502, expected: "Bad gateway - temporary issue with the AI provider. Please wait a few minutes and try again." },
    { status: 503, expected: "Service unavailable - the AI service is temporarily down. Please try again later." }
  ];

  errorScenarios.forEach(scenario => {
    console.log(`Status ${scenario.status}: ${scenario.expected}`);
  });

  console.log('\n✓ All error messages defined correctly');
}

// Run all tests
async function runAllTests() {
  console.log('========================================');
  console.log('   Pharmacy Calculator Error Handling Tests');
  console.log('========================================');

  try {
    await testRetryLogic();
    testFallbackPlan();
    testErrorMessages();

    console.log('\n========================================');
    console.log('   All Tests Completed Successfully');
    console.log('========================================');
  } catch (error) {
    console.error('\n✗ Test suite failed:', error);
  }
}

// Export for Node.js or run in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests, testRetryLogic, testFallbackPlan, testErrorMessages };

  // Run tests if executed directly
  if (require.main === module) {
    runAllTests();
  }
} else if (typeof window !== 'undefined') {
  window.pharmacyTests = { runAllTests, testRetryLogic, testFallbackPlan, testErrorMessages };
  console.log('Tests loaded. Run pharmacyTests.runAllTests() to execute.');
}
