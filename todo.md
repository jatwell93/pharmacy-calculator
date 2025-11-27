3. Test Firebase Connection Locally

Add this temporary test to your aiIntegration.js (or create a test file):

```javascript
// Test Firebase connection
import { getDatabase, ref, set } from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";

async function testFirebase() {
  try {
    const auth = getAuth();
    await signInAnonymously(auth);
    console.log("✅ Firebase Auth: Connected");
    
    const db = getDatabase();
    const testRef = ref(db, 'test-connection');
    await set(testRef, { timestamp: Date.now() });
    console.log("✅ Firebase Database: Write successful");
  } catch (error) {
    console.error("❌ Firebase Error:", error.code, error.message);
  }
}

testFirebase();
```
Run this locally first. If it fails, your Firebase config is wrong.
Add Error Logging to Your Function

Your Netlify Function needs better error handling so you can see what's failing. Update your function (e.g., netlify/functions/generate-plan.js) to include:

```javascript
exports.handler = async (event) => {
  try {
    // Log incoming request
    console.log("Request received:", JSON.parse(event.body));
    
    // Your existing code...
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log("OpenRouter status:", response.status);
    const data = await response.json();
    console.log("OpenRouter response:", data);
    
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
    
  } catch (error) {
    // Log the FULL error
    console.error("Function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      })
    };
  }
};
```

Verify Environment Variables Are Loaded

Add this temporary diagnostic endpoint to test if Netlify is reading your env vars:

```javascript
// netlify/functions/test-config.js
exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      hasFirebaseKey: !!process.env.FIREBASE_API_KEY,
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      firebaseKeyPrefix: process.env.FIREBASE_API_KEY?.substring(0, 10) + "...",
    })
  };
};
```
