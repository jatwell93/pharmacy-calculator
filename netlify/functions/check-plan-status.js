// netlify/functions/check-plan-status.js
// FIXED: Moved Firebase initialization to use the same pattern as generate-plan.js
// to ensure environment variables are available at runtime and avoid local DB in production.

// Database initializer: Admin SDK server-side (bypasses Security Rules) in
// production, file-backed local DB in dev / FORCE_LOCAL_DB. See lib/firebaseDb.js.
const { initializeDatabase } = require("./lib/firebaseDb");

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
