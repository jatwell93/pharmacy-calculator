// State Management for Pharmacy Calculator
// This module provides a central source of truth for all service data

import { servicesData } from "./serviceData.js";
import { calculateAll } from "./calculations.js";
import { validateNumericInput } from "./validation.js";

/**
 * The central state object containing all user inputs and application data.
 * Initialized with default values from servicesData.
 */
export const state = {
  services: {},
  preferences: {
    maxInvestment: 15000,
    timeHorizon: 12,
    detailLevel: "detailed",
  },
  lastUpdate: null,
};

/**
 * Initialize the state from the default servicesData
 */
export function initializeState() {
  Object.keys(servicesData).forEach((partKey) => {
    servicesData[partKey].forEach((service) => {
      if (service.isCombined) {
        state.services[service.id] = {
          fields: {},
        };
        service.fields.forEach((field) => {
          state.services[service.id].fields[field.id] = {
            currentVol: field.currentVol,
            potentialVol: field.potentialVol,
          };
        });
      } else if (service.id === "staged-supply") {
        state.services[service.id] = {
          patientPickups: Array(15).fill(0),
        };
      } else if (service.id === "hmr") {
        state.services[service.id] = {
          currentVol: service.currentVol,
          potentialVol: service.potentialVol,
          thirdPartyPercent: 0,
        };
      } else if (service.id === "adalimumab" || service.id === "etanercept") {
        state.services[service.id] = {
          originator: 0,
          biosimilar: 0,
          program: 0,
        };
      } else if (service.id === "rmmr") {
        state.services[service.id] = {
            eligible: "No",
            beds: 0,
            currentVol: service.currentVol,
            potentialVol: service.potentialVol,
        };
      } else if (service.id === "qum") {
          state.services[service.id] = {
              eligible: "No",
              beds: 0,
          };
      } else {
        state.services[service.id] = {
          currentVol: service.currentVol,
          potentialVol: service.potentialVol,
          patientFeeCurrent: service.patientFeeCurrent,
          patientFeePotential: service.patientFeePotential,
        };
      }
    });
  });
  
  state.lastUpdate = Date.now();
  console.log("✓ Application state initialized");
}

/**
 * Update a specific value in the state and trigger re-calculation
 * @param {string} path - Dot-separated path to the value (e.g., 'services.daa-eligible.currentVol')
 * @param {any} value - The new value
 */
export function updateState(path, value) {
  const parts = path.split(".");
  let current = state;

  // Validate numeric values before storing
  const isNumericPath = [
    "currentVol",
    "potentialVol",
    "patientFeeCurrent",
    "patientFeePotential",
    "thirdPartyPercent",
    "originator",
    "biosimilar",
    "program",
    "beds",
  ];

  const lastKey = parts[parts.length - 1];
  if (isNumericPath.includes(lastKey) && typeof value === "string") {
    value = validateNumericInput(value);
  }

  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }

  current[parts[parts.length - 1]] = value;
  state.lastUpdate = Date.now();

  // Trigger calculation using the new state
  calculateAll();
}

/**
 * Get a value from the state by path
 * @param {string} path - Dot-separated path
 * @returns {any} The value at the path
 */
export function getState(path) {
  return path.split(".").reduce((prev, curr) => prev && prev[curr], state);
}
