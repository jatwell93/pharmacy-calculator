# Debugging Guide: JSON Parsing Error in AI Integration

## Problem Description
You're experiencing a JSON parsing error when the AI tries to generate a plan:
```
Real AI test failed: SyntaxError: JSON.parse: unexpected character at line 1 column 1 of the JSON data
```

This error occurs at line 117 in `aiIntegration.js` when trying to parse the response from the API.

## Common Causes & Solutions

### 1. **Running Locally Without Proper Server Setup**

**Issue:** If you're opening `index.html` directly in the browser or using a simple HTTP server, the `/api/generate-plan` endpoint won't work correctly.

**Solution:** Use the provided local development server:

```bash
# First, make sure you're in the project directory
cd C:\Users\josha\pharmacy-calculator

# Run the local development server
npm run dev
# or
node dev/local-server.js
```

Then open `http://localhost:8888` in your browser.

### 2. **Missing OpenRouter API Key**

**Issue:** The backend function requires an OpenRouter API key to work.

**Solution:** Set the environment variable before running the server:

```bash
# Windows Command Prompt
set OPENROUTER_API_KEY=your_api_key_here
npm run dev

# Windows PowerShell
$env:OPENROUTER_API_KEY="your_api_key_here"
npm run dev

# Mac/Linux
export OPENROUTER_API_KEY=your_api_key_here
npm run dev
```

To get an API key:
1. Go to https://openrouter.ai/
2. Sign up for an account
3. Get your API key from the dashboard
4. Add credits to your account

### 3. **Using Netlify Dev (Alternative)**

If you have Netlify CLI installed, you can use:

```bash
# Install Netlify CLI globally (if not already installed)
npm install -g netlify-cli

# Set your API key in a .env file
echo OPENROUTER_API_KEY=your_api_key_here > .env

# Run Netlify Dev
netlify dev
```

### 4. **Server Returning HTML Instead of JSON**

**Issue:** The server might be returning an error page (HTML) instead of JSON.

**How to Check:** 
1. Open browser Developer Tools (F12)
2. Go to Network tab
3. Click the "Test with Real Data" button
4. Look at the response for the `generate-plan` request
5. Check the Response tab - if it shows HTML, you'll see the issue

**Common HTML Responses:**
- **404 Page Not Found**: The API endpoint isn't set up correctly
- **500 Internal Server Error**: The backend function is crashing
- **502 Bad Gateway**: The AI service is temporarily down

### 5. **AI Returning Invalid JSON**

**Issue:** The AI model might return text that isn't valid JSON or includes markdown formatting.

**How to Debug:**
1. Check the browser console for detailed error messages
2. Look for "Raw response text:" in the console
3. The improved error handling will show you exactly what was returned

**Common AI Response Issues:**
- Response wrapped in markdown code blocks (```json ... ```)
- Single quotes instead of double quotes
- Trailing commas in JSON
- Text explanation before or after the JSON

## Step-by-Step Debugging Process

### Step 1: Check Your Setup
```bash
# Test if API key is set
npm run test-api

# Should output: "OPENROUTER_API_KEY is SET ✓"
# If not, set the API key first
```

### Step 2: Start Local Server with Debugging
```bash
# Run the local development server
npm run dev
```

### Step 3: Open Browser Console
1. Open `http://localhost:8888` in your browser
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Clear the console

### Step 4: Test with Sample Data First
1. Click "Test AI with Sample Data" button
2. Watch the console for detailed output
3. If this works, the API connection is good

### Step 5: Test with Real Data
1. Enter some values in the calculator
2. Increase "Potential Volume" for at least one service
3. Click "Test with Real Data"
4. Watch the console for:
   - Request being sent
   - Response status
   - Response headers
   - Raw response text
   - Parsing attempts

### Step 6: Analyze the Error

Based on what you see in the console:

**If you see "Server returned HTML instead of JSON":**
- You're not using the proper development server
- Use `npm run dev` instead of opening the HTML file directly

**If you see "OpenRouter Error (401)":**
- Your API key is invalid or not set
- Check your API key and credits

**If you see "OpenRouter Error (404)":**
- The model name might be outdated
- Check the current model name at https://openrouter.ai/models

**If you see "Invalid JSON received from server":**
- The AI returned malformed JSON
- Check the raw response in the console
- The system will try to use a fallback plan

## Testing the Fix

After implementing the improved error handling:

1. The system now provides detailed error messages
2. It shows exactly what was received from the server
3. It attempts to parse and clean up AI responses
4. It provides a fallback plan if AI fails

## Need More Help?

If you're still experiencing issues:

1. **Check the Console Output**: The improved error handling logs extensive debugging information
2. **Check Network Tab**: Look at the actual HTTP requests and responses
3. **Check Server Logs**: If using the local server, check the terminal output
4. **Test the API Directly**: Try making a curl request to test the API:

```bash
curl -X POST http://localhost:8888/api/generate-plan \
  -H "Content-Type: application/json" \
  -d '{"analysisData":[{"name":"Test","currentValue":1000,"potentialValue":2000,"additionalValue":1000,"growthPercentage":100}],"userPreferences":{"timelineMonths":6,"focusAreas":["test"],"riskTolerance":"medium"}}'
```

## Prevention

To prevent this issue in the future:

1. Always use the proper development server (`npm run dev`)
2. Set up environment variables before starting
3. Test with sample data first
4. Monitor the console for warnings
5. Keep your API key secure and active

## Summary

The JSON parsing error is most commonly caused by:
1. Not using a proper server (opening HTML file directly)
2. Missing API key configuration
3. The AI service being temporarily unavailable

The improved error handling now provides:
- Detailed error messages
- Response content logging
- Fallback plans when AI fails
- Better debugging information

Follow the steps above to identify and fix the specific issue you're facing.