// netlify/functions/lib/firebaseDb.js
//
// Shared database initializer for the Netlify functions.
//
// Production/staging use the Firebase ADMIN SDK (service account), which bypasses
// Realtime Database Security Rules entirely — so the database can be locked down to
// `{ "rules": { ".read": false, ".write": false } }` and only these server functions
// can read/write it. The browser never touches the database directly.
//
// Local development (or an explicit FORCE_LOCAL_DB=true) uses the file-backed
// dev/localDatabase.js so you can run without any Firebase project at all.
//
// All three call signatures below match the modular Firebase client SDK the handlers
// were written against, so handler code does not change:
//   dbRef(database, path) -> ref
//   dbSet(ref, value)     -> Promise
//   dbGet(ref)            -> Promise<DataSnapshot> with .exists() / .val()

function initLocalDb() {
  const localDb = require("../../../dev/localDatabase");
  const app = localDb.initializeApp({});
  const database = localDb.getDatabase(app);
  return {
    database,
    dbRef: localDb.ref,
    dbSet: localDb.set,
    dbGet: localDb.get,
    driver: "local",
  };
}

function initAdminDb() {
  // Modular Admin SDK API (firebase-admin v11+); the legacy `admin.apps` /
  // `admin.database()` namespace was removed in v14.
  const { initializeApp, getApps, cert } = require("firebase-admin/app");
  const { getDatabase } = require("firebase-admin/database");

  if (getApps().length === 0) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (parseError) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON: " + parseError.message,
      );
    }

    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }

  const database = getDatabase();

  // Adapt the Admin SDK's chained API to the modular client-SDK signatures
  // the handlers were written against.
  const dbRef = (db, path) => db.ref(path);
  const dbSet = (ref, value) => ref.set(value);
  const dbGet = (ref) => ref.get(); // Admin ref.get() -> Promise<DataSnapshot>

  return { database, dbRef, dbSet, dbGet, driver: "admin" };
}

// Decide which backend to use based on the runtime environment.
function initializeDatabase() {
  const isProduction =
    process.env.NETLIFY === "true" || process.env.CONTEXT === "production";
  const forceLocalDb = process.env.FORCE_LOCAL_DB === "true";

  if (forceLocalDb) {
    console.log("⚙️ FORCE_LOCAL_DB=true: using local file-backed database");
    return initLocalDb();
  }

  const hasAdminCreds =
    !!process.env.FIREBASE_SERVICE_ACCOUNT && !!process.env.FIREBASE_DATABASE_URL;

  if (hasAdminCreds) {
    console.log("🔐 Using Firebase Admin SDK (server-side, rules-bypassing)");
    return initAdminDb();
  }

  // No admin credentials configured.
  if (!isProduction) {
    console.log(
      "⚙️ No FIREBASE_SERVICE_ACCOUNT configured; falling back to local file-backed database",
    );
    return initLocalDb();
  }

  console.error(
    "❌ PRODUCTION ERROR: Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT and FIREBASE_DATABASE_URL in the Netlify dashboard.",
  );
  throw new Error(
    "Missing Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT / FIREBASE_DATABASE_URL) for production deployment.",
  );
}

module.exports = { initializeDatabase };
