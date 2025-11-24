// Firebase Database Operations Module
// Provides functions to save and load business plans using Firebase Realtime Database
// Uses Firebase CDN modules loaded in index.html

import { getCurrentUser, db } from "./firebaseInit.js";

/**
 * Save a business plan to Firebase under the current user's UID
 * @param {Object} planData - The business plan object to save
 * @param {string} planId - Optional: ID for the plan (defaults to timestamp-based ID)
 * @returns {Promise<void>}
 */
export async function saveBusinessPlan(planData, planId = null) {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error(
        "User not authenticated. Cannot save plan. Make sure Firebase is initialized and user is signed in."
      );
    }

    if (!db) {
      throw new Error(
        "Firebase database not initialized. Check console for details."
      );
    }

    const timestamp = Date.now();
    const id = planId || `plan_${timestamp}`;

    const planRef = firebase.database().ref(`users/${user.uid}/plans/${id}`);
    await planRef.set({
      ...planData,
      savedAt: new Date().toISOString(),
      planId: id,
    });

    console.log(`✓ Plan "${id}" saved successfully for user ${user.uid}`);
    return id;
  } catch (error) {
    console.error("✗ Error saving plan:", error.message);
    throw error;
  }
}

/**
 * Load a specific business plan from Firebase
 * @param {string} planId - The ID of the plan to load
 * @returns {Promise<Object>} The plan data
 */
export async function loadBusinessPlan(planId) {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated. Cannot load plan.");
    }

    if (!db) {
      throw new Error(
        "Firebase database not initialized. Check console for details."
      );
    }

    const planRef = firebase.database().ref(`users/${user.uid}/plans/${planId}`);
    const snapshot = await planRef.once("value");

    if (!snapshot.exists()) {
      throw new Error(`Plan "${planId}" not found.`);
    }

    console.log(`✓ Plan "${planId}" loaded successfully`);
    return snapshot.val();
  } catch (error) {
    console.error("✗ Error loading plan:", error.message);
    throw error;
  }
}

/**
 * Load all business plans for the current user
 * @returns {Promise<Object>} Object containing all plans keyed by planId
 */
export async function loadAllPlans() {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated. Cannot load plans.");
    }

    if (!db) {
      throw new Error(
        "Firebase database not initialized. Check console for details."
      );
    }

    const plansRef = firebase.database().ref(`users/${user.uid}/plans`);
    const snapshot = await plansRef.once("value");

    if (!snapshot.exists()) {
      console.log("No plans found for user");
      return {};
    }

    console.log(`✓ Loaded ${Object.keys(snapshot.val()).length} plans`);
    return snapshot.val();
  } catch (error) {
    console.error("✗ Error loading plans:", error.message);
    throw error;
  }
}

/**
 * Delete a business plan from Firebase
 * @param {string} planId - The ID of the plan to delete
 * @returns {Promise<void>}
 */
export async function deleteBusinessPlan(planId) {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated. Cannot delete plan.");
    }

    if (!db) {
      throw new Error(
        "Firebase database not initialized. Check console for details."
      );
    }

    const planRef = firebase.database().ref(`users/${user.uid}/plans/${planId}`);
    await planRef.remove();

    console.log(`✓ Plan "${planId}" deleted successfully`);
  } catch (error) {
    console.error("✗ Error deleting plan:", error.message);
    throw error;
  }
}

/**
 * Update a specific business plan in Firebase
 * @param {string} planId - The ID of the plan to update
 * @param {Object} updates - Object containing the fields to update
 * @returns {Promise<void>}
 */
export async function updateBusinessPlan(planId, updates) {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated. Cannot update plan.");
    }

    if (!db) {
      throw new Error(
        "Firebase database not initialized. Check console for details."
      );
    }

    const planRef = firebase.database().ref(`users/${user.uid}/plans/${planId}`);
    const snapshot = await planRef.once("value");

    if (!snapshot.exists()) {
      throw new Error(`Plan "${planId}" not found.`);
    }

    const updatedPlan = {
      ...snapshot.val(),
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await planRef.set(updatedPlan);

    console.log(`✓ Plan "${planId}" updated successfully`);
  } catch (error) {
    console.error("✗ Error updating plan:", error.message);
    throw error;
  }
}

export default {
  saveBusinessPlan,
  loadBusinessPlan,
  loadAllPlans,
  deleteBusinessPlan,
  updateBusinessPlan,
};
