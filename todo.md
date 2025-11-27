You are correct that on the free plan, environment variables are typically available to all scopes by default. However, since the logs explicitly say "Missing Firebase configuration" inside the function (Node.js environment), and the frontend (browser environment) sees them fine, we have a specific disconnect in how the **function runtime** is receiving these variables.

The issue is almost certainly that **Netlify Functions are separate runtime environments** from your main build, and sometimes they don't automatically inherit variables if the function is bundled or deployed in a specific way.

Here is the definitive fix for the "Missing Firebase configuration" error in your serverless function.

### The Root Cause
Your error log shows:
`Error: Firebase configuration missing for production deployment.`

This error comes from **your own code**. Look at your `netlify/functions/generate-plan.js` file around line 49. It likely has a check like this:

```javascript
if (!process.env.FIREBASE_API_KEY) {
  throw new Error("Firebase configuration missing...");
}
```

The fact that it throws this error means `process.env.FIREBASE_API_KEY` is `undefined` inside the function, even though it works in the browser.

### Solution: Manually Pass Variables via `netlify.toml`
To force these variables into the function's environment, you need to explicitly map them in your `netlify.toml` file.

1.  Open (or create) your `netlify.toml` file.
2.  Add an `[environment]` block (or add to the existing one) to explicitly verify they are set for the build.
3.  **Crucially**, use the `[functions]` block to ensure they are passed to the function runtime.

Update your `netlify.toml` to look like this:

```toml
[build]
  command = "npm run build"
  publish = "."
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"
  # This section forces variables into the function environment
  [functions.environment]
    FIREBASE_API_KEY = "LEAVE_EMPTY_TO_INHERIT"
    # ... (see below)
```

**Better Approach (Inheritance):**
Since you don't want to commit secrets to `netlify.toml`, you can rely on the UI settings but **ensure your function initialization code is correct**.

### Most Likely Fix: Update `firebaseInit.js` / `generate-plan.js`
The issue is often how you import/initialize Firebase inside the function. The serverless environment is different from the browser.

**1. Check your imports:**
In `netlify/functions/generate-plan.js`, ensure you are NOT importing the same `firebaseInit.js` file used by your frontend. The frontend file likely uses `import.meta.env` or `window.env`, which **do not exist** in Node.js functions.

**2. Create a dedicated Admin SDK setup (Recommended):**
For serverless functions, it is best practice to use `firebase-admin` instead of the client SDK, but if you want to stick to the client SDK (easier), create a **server-specific** initialization block at the top of your function file:

```javascript
// netlify/functions/generate-plan.js

// 1. Standardize Env Var Access
// Netlify Functions use process.env, NOT window.env or import.meta.env
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  // ... add other fields
};

// 2. Debugging Log (view this in Netlify Function Logs)
console.log("Function Config Check:", {
  hasApiKey: !!firebaseConfig.apiKey,
  hasDbUrl: !!firebaseConfig.databaseURL,
  nodeEnv: process.env.NODE_ENV
});

// 3. Initialize ONLY if not already initialized
const { initializeApp, getApps, getApp } = require("firebase/app");
const { getDatabase } = require("firebase/database");

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db = getDatabase(app);
```

### Summary of Actions
1.  **Do not** use `window.env` or your frontend `firebaseInit.js` inside your Netlify Function.
2.  Use `process.env.VARIABLE_NAME` directly in the function file.
3.  Add the `console.log` above to your function, deploy, and check the logs.
    *   If it says `hasApiKey: false`, then the variables truly aren't there (rare on free plan, but fixed by redeploying or checking the "Scopes" again).
    *   If it says `hasApiKey: true`, then your previous code was just checking the wrong object (e.g., checking `window` instead of `process`).

### CONTEXT
```netlify logs
    Nov 27, 10:57:22 PM: ERROR ❌ PRODUCTION ERROR: Missing Firebase configuration. Please set Firebase environment variables.
    Nov 27, 10:57:22 PM: ERROR Required variables: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_DATABASE_URL, FIREBASE_PROJECT_ID
    Nov 27, 10:57:22 PM: ERROR Uncaught Exception {"errorType":"Error","errorMessage":"Firebase configuration missing for production deployment. Please set environment variables in Netlify dashboard.","stack":["Error: Firebase configuration missing for production deployment. Please set environment variables in Netlify dashboard."," at Object.<anonymous> (/var/task/netlify/functions/generate-plan.js:49:9)"," at Module._compile (node:internal/modules/cjs/loader:1364:14)"," at Module._extensions..js (node:internal/modules/cjs/loader:1422:10)"," at Module.load (node:internal/modules/cjs/loader:1203:32)"," at Module._load (node:internal/modules/cjs/loader:1019:12)"," at Module.require (node:internal/modules/cjs/loader:1231:19)"," at require (node:internal/modules/helpers:177:18)"," at Object.<anonymous> (/var/task/generate-plan.js:1:18)"," at Module._compile (node:internal/modules/cjs/loader:1364:14)"," at Module._extensions..js (node:internal/modules/cjs/loader:1422:10)"]}
    Nov 27, 10:57:22 PM: INIT_REPORT Init Duration: 208.31 ms Phase: invoke Status: error Error Type: Runtime.Unknown
    Nov 27, 10:57:22 PM: 4a674cd7 Duration: 258.3 ms Memory Usage: 84 MB
```
```console log
    ✓ Environment configuration loaded env-config.js:25:9
    Firebase Config Available: true env-config.js:26:9
    OpenRouter API Key Available: true env-config.js:27:9
```