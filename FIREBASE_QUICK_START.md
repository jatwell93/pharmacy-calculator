# Quick Start: Using Firebase in Your App

## Files Added

Three new files have been added to your project:

1. **`js/firebaseInit.js`** - Initialization logic
2. **`js/firebaseDatabase.js`** - Database operations  
3. **`FIREBASE_AUTH_SETUP.md`** - Full documentation

Your **`js/main.js`** has been updated to initialize Firebase on app load.

## The Essentials

### Firebase automatically initializes and signs in users

```javascript
// This happens automatically when the app loads
// Users are signed in anonymously with a unique UID
// No action needed from you!
```

### Save a plan

```javascript
import { saveBusinessPlan } from "./firebaseDatabase.js";

// Call this when user wants to save their plan
const planId = await saveBusinessPlan({
  executive_summary: "...",
  plan: [...],
  // ... other plan data
});

console.log(`Saved with ID: ${planId}`);
```

### Load a plan

```javascript
import { loadBusinessPlan, loadAllPlans } from "./firebaseDatabase.js";

// Load a specific plan
const plan = await loadBusinessPlan("plan_1234567890");

// Or load all user's plans
const allPlans = await loadAllPlans();
```

### Get current user's UID

```javascript
import { getCurrentUser } from "./firebaseInit.js";

const user = getCurrentUser();
console.log("User ID:", user.uid);
```

## Storage Structure

Plans are stored under each user's unique ID:

```
Database
└── users
    └── {user_UID}
        └── plans
            ├── plan_1234567890
            ├── plan_9876543210
            └── ...
```

## Example: Adding a Save Button

In your HTML:
```html
<button onclick="saveCurrentPlan()">💾 Save Plan</button>
```

In your JavaScript:
```javascript
import { saveBusinessPlan } from "./firebaseDatabase.js";

export async function saveCurrentPlan() {
  try {
    // Collect your plan data
    const planData = {
      executive_summary: document.getElementById("summary").textContent,
      plan: window.currentPlan || [],
      financial_breakdown: window.financialData || {}
    };

    // Save to Firebase
    const planId = await saveBusinessPlan(planData);
    alert(`✓ Plan saved! ID: ${planId}`);
  } catch (error) {
    alert(`✗ Error: ${error.message}`);
  }
}

// Expose to global scope for inline onclick
window.saveCurrentPlan = saveCurrentPlan;
```

## Example: Adding a Load Plans Modal

```javascript
import { loadAllPlans, loadBusinessPlan } from "./firebaseDatabase.js";

export async function showLoadPlans() {
  try {
    const allPlans = await loadAllPlans();
    
    if (Object.keys(allPlans).length === 0) {
      alert("No saved plans found");
      return;
    }

    // Display plans to user and let them pick one
    const planIds = Object.keys(allPlans);
    const selectedId = prompt(`Available plans:\n\n${planIds.join('\n')}\n\nEnter plan ID to load:`);

    if (selectedId && allPlans[selectedId]) {
      const plan = await loadBusinessPlan(selectedId);
      // Apply plan data to your UI
      console.log("Loaded plan:", plan);
      alert("✓ Plan loaded!");
    }
  } catch (error) {
    alert(`✗ Error: ${error.message}`);
  }
}

window.showLoadPlans = showLoadPlans;
```

## Testing

Open your browser console and test:

```javascript
// Check if user is signed in
const { getCurrentUser } = await import('./js/firebaseInit.js');
const user = getCurrentUser();
console.log('Signed in as:', user.uid);

// Try saving a test plan
const { saveBusinessPlan } = await import('./js/firebaseDatabase.js');
await saveBusinessPlan({ test: "data" });

// Load all plans
const { loadAllPlans } = await import('./js/firebaseDatabase.js');
const plans = await loadAllPlans();
console.log('All plans:', plans);
```

## Common Tasks

### Delete a plan
```javascript
import { deleteBusinessPlan } from "./firebaseDatabase.js";

await deleteBusinessPlan("plan_1234567890");
```

### Update an existing plan
```javascript
import { updateBusinessPlan } from "./firebaseDatabase.js";

await updateBusinessPlan("plan_1234567890", {
  executive_summary: "New summary..."
});
```

### Handle errors gracefully
```javascript
try {
  await saveBusinessPlan(data);
} catch (error) {
  if (error.message.includes("not authenticated")) {
    console.log("User authentication issue");
  } else if (error.message.includes("not found")) {
    console.log("Plan doesn't exist");
  } else {
    console.log("Other error:", error.message);
  }
}
```

## Important Notes

1. **Each user session gets a unique ID** - Plans are isolated and private
2. **Authentication is automatic** - No login screen needed
3. **Check the console for logs** - Look for ✓ success messages and ✗ errors
4. **Update Firebase rules** - Make sure your database rules allow authenticated users

## Firebase Rules (Update these!)

Go to Firebase Console → Database → Rules and set:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

This ensures each user can only access their own plans.

## Full Documentation

See **FIREBASE_AUTH_SETUP.md** for complete documentation and advanced usage.
