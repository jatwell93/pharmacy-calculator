// Firebase Initialization Module
// Handles Firebase setup and anonymous authentication for the application
// Uses Firebase CDN modules loaded in index.html

// Firebase configuration
// Loads from window.firebaseConfig which is set in index.html from environment variables
// Never hardcode credentials here - they should come from environment variables
const firebaseConfig = window.firebaseConfig || {
  apiKey: null,
  authDomain: null,
  databaseURL: null,
  projectId: null,
  storageBucket: null,
  messagingSenderId: null,
  appId: null,
};

// Initialize Firebase
let app = null;
let auth = null;
let db = null;
let initError = null;

// Initialize Firebase when CDN scripts have loaded
if (typeof firebase !== "undefined") {
  try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.database();
    console.log("✓ Firebase initialized successfully");
  } catch (error) {
    initError = error;
    console.error("✗ Firebase initialization error:", error.message);
    console.warn("⚠ Firebase features will not be available");
  }
} else {
  initError = new Error(
    "Firebase SDK not loaded. Make sure Firebase CDN scripts are loaded in index.html"
  );
  console.warn(
    "⚠ Firebase SDK not available. Continuing without Firebase features."
  );
}

/**
 * Sign in the user anonymously
 * This should be called when the app loads to ensure the user is authenticated
 * before attempting to save/load data from the database
 */
export async function initializeAnonymousAuth() {
  // If Firebase failed to initialize, skip authentication gracefully
  if (initError) {
    console.warn(
      "⚠ Skipping Firebase authentication due to initialization error:",
      initError.message
    );
    return null;
  }

  if (!auth) {
    throw new Error("Firebase authentication not initialized");
  }

  try {
    const result = await auth.signInAnonymously();
    console.log("✓ User signed in anonymously with UID:", result.user.uid);
    return result.user;
  } catch (error) {
    console.error("✗ Authentication error:", error.message);
    // Don't throw - let the app continue even if auth fails
    console.warn("⚠ Continuing without Firebase authentication");
    return null;
  }
}

/**
 * Get the current authenticated user
 * Returns the user object if authenticated, null otherwise
 */
export function getCurrentUser() {
  return auth ? auth.currentUser : null;
}

// Export Firebase instances
export { app, auth, db };

export default {
  app,
  auth,
  db,
  initializeAnonymousAuth,
  getCurrentUser,
};
