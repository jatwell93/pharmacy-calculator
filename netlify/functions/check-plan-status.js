// netlify/functions/check-plan-status.js
// Support local development with a file-backed DB helper when Firebase env vars are not set.
let initializeApp, getDatabase, ref, get;
if (!process.env.FIREBASE_DATABASE_URL) {
  console.log("Local dev: using file-backed local database for status checks");
  const localDb = require("../../dev/localDatabase");
  initializeApp = localDb.initializeApp;
  getDatabase = localDb.getDatabase;
  ref = localDb.ref;
  get = localDb.get;
} else {
  const firebaseAppModule = require("firebase/app");
  const firebaseDbModule = require("firebase/database");
  initializeApp = firebaseAppModule.initializeApp;
  getDatabase = firebaseDbModule.getDatabase;
  ref = firebaseDbModule.ref;
  get = firebaseDbModule.get;
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
    // Initialize Firebase (replace with your config or use env vars)
    // For local development when FIREBASE_DATABASE_URL is not set we use the file-backed helper
    let database;
    if (process.env.FIREBASE_DATABASE_URL) {
      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
      };

      const app = initializeApp(firebaseConfig);
      database = getDatabase(app);
    } else {
      const localDb = require("../../dev/localDatabase");
      const app = localDb.initializeApp({});
      database = localDb.getDatabase(app);
      console.log("Using local dev database for status checks");
    }

    const jobRef = ref(database, `plans/${jobId}`);
    const snapshot = await get(jobRef);

    if (!snapshot.exists()) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ status: "not_found" }),
      };
    }

    const data = snapshot.val();
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
