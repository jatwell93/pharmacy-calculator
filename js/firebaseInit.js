// Firebase Initialization Module
// Handles Firebase setup and anonymous authentication for the application
// Uses the Firebase npm package (already installed in package.json)

// Import Firebase functions
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

// Firebase configuration - loaded from environment variables
// In vanilla JS served statically, we need to embed these at build time
// For now, they will be set to null if not available
const firebaseConfig = {
  apiKey: window.FIREBASE_API_KEY || null,
  authDomain: window.FIREBASE_AUTH_DOMAIN || null,
  databaseURL: window.FIREBASE_DATABASE_URL || null,
  projectId: window.FIREBASE_PROJECT_ID || null,
  storageBucket: window.FIREBASE_STORAGE_BUCKET || null,
  messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID || null,
  appId: window.FIREBASE_APP_ID || null,
};

// Initialize Firebase
let app = null;
let auth = null;
let db = null;
let initError = null;

/**
 * Initialize Firebase
 */
export function initializeFirebase() {
  try {
    // Check if Firebase config is properly set
    const hasConfig = Object.values(firebaseConfig).some(val => val !== null);
    
    if (!hasConfig) {
      throw new Error('Firebase configuration not found in window object');
    }

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    console.log("✓ Firebase initialized successfully");
    return { app, auth, db };
  } catch (error) {
    initError = error;
    console.error("✗ Firebase initialization error:", error.message);
    console.warn("⚠ Firebase features will not be available");
    return { app: null, auth: null, db: null };
  }
}


/**
 * Sign in the user anonymously
 * This should be called when the app loads to ensure the user is authenticated
 * before attempting to save/load data from the database
 */
export async function initializeAnonymousAuth() {
  // First, ensure Firebase is initialized
  const { auth: authInstance } = initializeFirebase();

  // If Firebase failed to initialize, skip authentication gracefully
  if (initError) {
    console.warn(
      "⚠ Skipping Firebase authentication due to initialization error:",
      initError.message
    );
    return null;
  }

  if (!authInstance) {
    console.warn("⚠ Firebase authentication not available");
    return null;
  }

  try {
    const result = await signInAnonymously(authInstance);
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
  initializeFirebase,
  initializeAnonymousAuth,
  getCurrentUser,
};
