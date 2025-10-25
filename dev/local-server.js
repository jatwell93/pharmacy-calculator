// Local development server for testing without Netlify
// This server proxies API requests to the Netlify function locally

// Load environment variables from .env for local development
// This ensures FIREBASE_* and OPENROUTER_API_KEY are available to functions run via the local server.
require("dotenv").config();

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Import the Netlify function directly
const generatePlanFunction = require("../netlify/functions/generate-plan.js");

const PORT = 8888;
const ROOT_DIR = path.join(__dirname, "..");

// MIME types for common file extensions
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// Function to serve static files
function serveStaticFile(filePath, res) {
  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
      } else {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
}

// Function to handle API requests
async function handleApiRequest(req, res, pathname) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route to the generate-plan function
  if (pathname === "/api/generate-plan") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        console.log("📨 Received API request to /api/generate-plan");
        console.log("Request body length:", body.length);

        // Create a mock Netlify event object
        const event = {
          httpMethod: req.method,
          headers: req.headers,
          body: body,
        };

        // Create a mock context object
        const context = {};

        // Call the Netlify function
        console.log("🚀 Calling Netlify function handler...");
        const response = await generatePlanFunction.handler(event, context);

        console.log("📤 Function response status:", response.statusCode);

        // Send the response
        res.writeHead(response.statusCode, {
          "Content-Type": "application/json",
          ...response.headers,
        });
        res.end(response.body);
      } catch (error) {
        console.error("❌ Error handling API request:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: error.message,
            fallbackPlan: {
              timeline: {
                ganttChart: `gantt
    title Emergency Fallback Plan
    dateFormat YYYY-MM-DD
    section Quick Start
    Initial Setup :done, 2024-01-01, 7d`,
                milestones: ["Week 1: Get started"],
              },
              actions: {
                staffing: ["Review current staff capabilities"],
                marketing: ["Inform existing patients"],
                operations: ["Audit current systems"],
                compliance: ["Review requirements"],
              },
              financials: {
                investmentRequired: 5000,
                projectedROI: 2.0,
                breakdown: "Initial conservative estimate",
              },
            },
          }),
        );
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "API endpoint not found" }));
  }
}

// Create the server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  console.log(`${req.method} ${pathname}`);

  // Handle API requests
  if (pathname.startsWith("/api/")) {
    await handleApiRequest(req, res, pathname);
    return;
  }

  // Default to index.html for root
  if (pathname === "/") {
    pathname = "/index.html";
  }

  // Construct the file path
  const filePath = path.join(ROOT_DIR, pathname);

  // Security check: ensure the file path is within ROOT_DIR
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("403 Forbidden");
    return;
  }

  // Serve static files
  serveStaticFile(filePath, res);
});

// Start the server
server.listen(PORT, () => {
  console.log(
    `🚀 Local development server running at http://localhost:${PORT}`,
  );
  console.log(`📁 Serving files from: ${ROOT_DIR}`);
  console.log(
    "\n📌 Important: Make sure you have set the OPENROUTER_API_KEY environment variable!",
  );
  console.log("   Windows: set OPENROUTER_API_KEY=your_api_key_here");
  console.log("   Mac/Linux: export OPENROUTER_API_KEY=your_api_key_here");
  console.log("\n✨ Ready to test AI integration locally!");
});
