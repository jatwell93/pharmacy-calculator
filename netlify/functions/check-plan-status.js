// netlify/functions/check-plan-status.js
// FIXED: Moved Firebase initialization to use the same pattern as generate-plan.js
// to ensure environment variables are available at runtime and avoid local DB in production.

// Helper function to initialize database based on environment
function initializeDatabase() {
  // Log environment variable status for debugging
  console.log("🔍 Environment Check (check-plan-status):", {
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

  let database, dbRef, dbGet;

  if (hasFirebaseConfig && !forceLocalDb) {
    // Use Firebase when config is available (production or development with Firebase)
    console.log("🔐 Using Firebase Realtime Database for status checks");
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
      dbGet = firebaseDbModule.get;
      console.log("✅ Firebase initialized successfully for status checks");
    } catch (firebaseError) {
      console.error("❌ Firebase initialization failed:", firebaseError.message);
      throw new Error(`Firebase initialization failed: ${firebaseError.message}`);
    }
  } else if (forceLocalDb || !isProduction) {
    // Development mode: use local file-backed database
    console.log("⚙️ Development mode: using local file-backed database for status checks");
    try {
      const localDb = require("../../dev/localDatabase");
      const app = localDb.initializeApp({});
      database = localDb.getDatabase(app);
      dbRef = localDb.ref;
      dbGet = localDb.get;
      console.log("✅ Local database initialized successfully for status checks");
    } catch (localDbError) {
      console.error("❌ Local database initialization failed:", localDbError.message);
      throw new Error(`Local database initialization failed: ${localDbError.message}`);
    }
  } else {
    // Production but missing Firebase config - this is an error state
    console.error("❌ PRODUCTION ERROR: Missing Firebase configuration for status checks.");
    console.error("Required variables: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_DATABASE_URL, FIREBASE_PROJECT_ID");
    console.error("Current values:", {
      FIREBASE_API_KEY: process.env.FIREBASE_API_KEY ? "SET" : "NOT SET",
      FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN ? "SET" : "NOT SET",
      FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL ? "SET" : "NOT SET",
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? "SET" : "NOT SET",
    });
    throw new Error("Firebase configuration missing for production deployment. Please set environment variables in Netlify dashboard.");
  }

  return { database, dbRef, dbGet };
}

exports.handler = async function (event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // Extract jobId from path (e.g., /check-plan-status/{jobId})
  const pathParts = event.path.split("/");
  const jobId = pathParts[pathParts.length - 1];

  if (!jobId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing jobId" }),
    };
  }

  try {
    // Initialize database - this is now done inside the handler to ensure
    // environment variables are available at runtime
    const { database, dbRef, dbGet } = initializeDatabase();
    console.log("📱 Database initialized for status check, jobId:", jobId);

    const jobRef = dbRef(database, `plans/${jobId}`);
    const snapshot = await dbGet(jobRef);

    if (!snapshot.exists()) {
      console.log("Job not found:", jobId);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ status: "not_found", jobId }),
      };
    }

    const data = snapshot.val();
    console.log("🔍 DEBUG: Found job data for", jobId, "Status:", data.status);
    console.log("🔍 DEBUG: Data keys:", Object.keys(data));
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (error) {
    console.error("Error checking status:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: "error", message: error.message }),
    };
  }
};
