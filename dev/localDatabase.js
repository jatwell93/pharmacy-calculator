/**
 * dev/localDatabase.js
 *
 * Simple file-backed "Firebase-like" Database helper for local development.
 * Exports a tiny subset of the Firebase Realtime Database API used by this project:
 * - initializeApp(config) -> returns an app-like object (ignored, kept for compatibility)
 * - getDatabase(app) -> returns a database object (ignored, kept for compatibility)
 * - ref(database, path) -> returns a ref object used by set/get
 * - set(ref, value) -> writes value at path
 * - get(ref) -> reads value and returns a Snapshot-like object { exists(), val() }
 * - remove(ref) -> deletes the data at path
 *
 * Behaviour:
 * - Stores data in a JSON file at ./dev/local-db.json (created automatically).
 * - Serializes concurrent writes using a simple in-memory queue.
 * - Intentionally minimal and synchronous-compatible via async/await.
 *
 * Use this helper in development when Firebase environment variables are not present.
 *
 * Example:
 *   const { initializeApp, getDatabase, ref, set, get } = require('./dev/localDatabase');
 *   const app = initializeApp({ /* optional config *\/ });
 *   const db = getDatabase(app);
 *   await set(ref(db, 'plans/abc'), { status: 'pending' });
 *   const snap = await get(ref(db, 'plans/abc'));
 *   if (snap.exists()) console.log(snap.val());
 */

const fs = require('fs');
const path = require('path');

// Location of the local DB file
const DB_DIR = path.join(process.cwd(), 'dev');
const DB_FILE = path.join(DB_DIR, 'local-db.json');

// In-memory queue to serialize write operations
let writeQueue = Promise.resolve();

// Ensure DB directory exists and file is present
function ensureDbFile() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}), 'utf8');
  }
}

// Read DB (returns parsed object)
async function readDb() {
  ensureDbFile();
  try {
    const raw = await fs.promises.readFile(DB_FILE, 'utf8');
    if (!raw || raw.trim() === '') return {};
    return JSON.parse(raw);
  } catch (err) {
    // If the file becomes corrupt, recover to empty DB
    console.error('localDatabase: failed to read DB file, resetting to {}', err);
    await writeDb({});
    return {};
  }
}

// Write DB safely by queueing writes to avoid races
async function writeDb(obj) {
  ensureDbFile();
  // Serialize writes by appending to the queue
  writeQueue = writeQueue.then(async () => {
    const tmpPath = DB_FILE + '.tmp';
    const data = JSON.stringify(obj, null, 2);
    await fs.promises.writeFile(tmpPath, data, 'utf8');
    // replace original file
    await fs.promises.rename(tmpPath, DB_FILE);
  }).catch((err) => {
    // Log errors but don't break the chain
    console.error('localDatabase: write error', err);
  });
  return writeQueue;
}

// Helper: get nested value by slash-separated path
function getAtPath(root, pathStr) {
  if (!pathStr) return root;
  const parts = pathStr.split('/').filter(Boolean);
  let cur = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) {
      return undefined;
    }
    cur = cur[p];
  }
  return cur;
}

// Helper: set nested value by slash-separated path (mutates root)
function setAtPath(root, pathStr, value) {
  if (!pathStr) {
    // replace root
    return value;
  }
  const parts = pathStr.split('/').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (i === parts.length - 1) {
      cur[p] = value;
    } else {
      if (!cur[p] || typeof cur[p] !== 'object') {
        cur[p] = {};
      }
      cur = cur[p];
    }
  }
  return root;
}

// Helper: remove nested key by path
function removeAtPath(root, pathStr) {
  if (!pathStr) {
    // clear root
    return {};
  }
  const parts = pathStr.split('/').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object') return root;
    cur = cur[p];
  }
  delete cur[parts[parts.length - 1]];
  return root;
}

// Snapshot-like object returned from get()
function createSnapshot(value) {
  return {
    exists() {
      return value !== undefined && value !== null;
    },
    val() {
      return value;
    },
  };
}

// API: initializeApp(config) - no-op but kept for compatibility
function initializeApp(config) {
  // We accept a config and return a trivial app-object to mimic Firebase API
  return { __local: true, config: config || {} };
}

// API: getDatabase(app) - returns a trivial database object
function getDatabase(app) {
  // app currently unused, but kept for compatibility
  ensureDbFile();
  return { __localDb: true, app: app || null, _file: DB_FILE };
}

// API: ref(database, path) - return a small ref object
function ref(database, pathStr) {
  if (typeof pathStr !== 'string') {
    throw new Error('localDatabase.ref expects path string as second argument');
  }
  return { __localRef: true, path: pathStr.replace(/^\/+/, '') };
}

// API: set(refObj, value) - writes value at path
async function set(refObj, value) {
  if (!refObj || !refObj.path) {
    throw new Error('localDatabase.set expects a ref created by ref()');
  }
  const db = await readDb();
  // if null/undefined, initialize as {}
  const root = db || {};
  // When value is an object, clone to avoid accidental mutation
  const toWrite = (value && typeof value === 'object') ? JSON.parse(JSON.stringify(value)) : value;
  const newRoot = setAtPath(root, refObj.path, toWrite);
  await writeDb(newRoot);
  return { success: true };
}

// API: get(refObj) - reads value at path and returns snapshot-like object
async function get(refObj) {
  if (!refObj || !refObj.path) {
    throw new Error('localDatabase.get expects a ref created by ref()');
  }
  const db = await readDb();
  const value = getAtPath(db, refObj.path);
  return createSnapshot(value);
}

// API: remove(refObj) - deletes the entry at path
async function remove(refObj) {
  if (!refObj || !refObj.path) {
    throw new Error('localDatabase.remove expects a ref created by ref()');
  }
  const db = await readDb();
  const newRoot = removeAtPath(db, refObj.path);
  await writeDb(newRoot);
  return { success: true };
}

// Export functions to mirror Firebase Database API surface used in this project
module.exports = {
  initializeApp,
  getDatabase,
  ref,
  set,
  get,
  remove,
  // For debugging/testing:
  __internal: {
    DB_FILE,
    readDb,
    writeDb,
  },
};
