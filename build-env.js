#!/usr/bin/env node

/**
 * Build script for environment variable injection
 * This script creates the env-config.js file with Firebase configuration
 */

const fs = require('fs');
const path = require('path');

// Environment variables to inject
const envVars = {
  'FIREBASE_API_KEY': process.env.FIREBASE_API_KEY || '',
  'FIREBASE_AUTH_DOMAIN': process.env.FIREBASE_AUTH_DOMAIN || '',
  'FIREBASE_DATABASE_URL': process.env.FIREBASE_DATABASE_URL || '',
  'FIREBASE_PROJECT_ID': process.env.FIREBASE_PROJECT_ID || '',
  'FIREBASE_STORAGE_BUCKET': process.env.FIREBASE_STORAGE_BUCKET || '',
  'FIREBASE_MESSAGING_SENDER_ID': process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  'FIREBASE_APP_ID': process.env.FIREBASE_APP_ID || ''
};

// Generate env-config.js content
const envConfigContent = `
// Auto-generated environment configuration
// This file is created during build process and contains Firebase configuration

window.ENV_CONFIG = ${JSON.stringify(envVars, null, 2)};

// Expose individual Firebase config variables
window.FIREBASE_API_KEY = window.ENV_CONFIG.FIREBASE_API_KEY;
window.FIREBASE_AUTH_DOMAIN = window.ENV_CONFIG.FIREBASE_AUTH_DOMAIN;
window.FIREBASE_DATABASE_URL = window.ENV_CONFIG.FIREBASE_DATABASE_URL;
window.FIREBASE_PROJECT_ID = window.ENV_CONFIG.FIREBASE_PROJECT_ID;
window.FIREBASE_STORAGE_BUCKET = window.ENV_CONFIG.FIREBASE_STORAGE_BUCKET;
window.FIREBASE_MESSAGING_SENDER_ID = window.ENV_CONFIG.FIREBASE_MESSAGING_SENDER_ID;
window.FIREBASE_APP_ID = window.ENV_CONFIG.FIREBASE_APP_ID;

console.log('✓ Environment configuration loaded');
`;

try {
  // Write the env-config.js file
  const outputPath = path.join(process.cwd(), 'env-config.js');
  fs.writeFileSync(outputPath, envConfigContent, 'utf8');
  console.log('✓ Created env-config.js with environment variables');
} catch (error) {
  console.error('✗ Failed to create env-config.js:', error.message);
  process.exit(1);
}