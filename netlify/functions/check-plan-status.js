// netlify/functions/check-plan-status.js
// Support local development with a file-backed DB helper when Firebase env vars are not set.

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
    // Determine if we're in development or production
    const isDevelopment = process.env.NODE_ENV === "development" || process.env.NETLIFY === undefined;

    let database;
    let ref, get;

    if (!isDevelopment && process.env.FIREBASE_DATABASE_URL) {
      // Production: use Firebase
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

        const app = firebaseAppModule.initializeApp(firebaseConfig);
        database = firebaseDbModule.getDatabase(app);
        ref = firebaseDbModule.ref;
        get = firebaseDbModule.get;
        console.log("✅ Using Firebase Realtime Database for status checks");
      } catch (firebaseError) {
        console.warn("Firebase initialization failed, falling back to local database:", firebaseError.message);
        const localDb = require("../../dev/localDatabase");
        const app = localDb.initializeApp({});
        database = localDb.getDatabase(app);
        ref = localDb.ref;
        get = localDb.get;
        console.log("✅ Using local dev database for status checks (Firebase fallback)");
      }
    } else {
      // Development: use local file-backed database
      const localDb = require("../../dev/localDatabase");
      const app = localDb.initializeApp({});
      database = localDb.getDatabase(app);
      ref = localDb.ref;
      get = localDb.get;
      console.log("✅ Using local dev database for status checks");
    }

    const jobRef = ref(database, `plans/${jobId}`);
    const snapshot = await get(jobRef);

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
