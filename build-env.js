#!/usr/bin/env node

/**
 * Build script for environment variable injection
 * This script creates the env-config.js file with Firebase configuration
 * and logs which variables are available during the build process
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
  'FIREBASE_APP_ID': process.env.FIREBASE_APP_ID || '',
  'OPENROUTER_API_KEY': process.env.OPENROUTER_API_KEY || ''
};

// Log environment variable status for debugging
console.log('🔍 Environment Variables Status:');
console.log('FIREBASE_API_KEY:', envVars.FIREBASE_API_KEY ? 'SET ✓' : 'NOT SET ✗');
console.log('FIREBASE_AUTH_DOMAIN:', envVars.FIREBASE_AUTH_DOMAIN ? 'SET ✓' : 'NOT SET ✗');
console.log('FIREBASE_DATABASE_URL:', envVars.FIREBASE_DATABASE_URL ? 'SET ✓' : 'NOT SET ✗');
console.log('FIREBASE_PROJECT_ID:', envVars.FIREBASE_PROJECT_ID ? 'SET ✓' : 'NOT SET ✗');
console.log('FIREBASE_STORAGE_BUCKET:', envVars.FIREBASE_STORAGE_BUCKET ? 'SET ✓' : 'NOT SET ✗');
console.log('FIREBASE_MESSAGING_SENDER_ID:', envVars.FIREBASE_MESSAGING_SENDER_ID ? 'SET ✓' : 'NOT SET ✗');
console.log('FIREBASE_APP_ID:', envVars.FIREBASE_APP_ID ? 'SET ✓' : 'NOT SET ✗');
console.log('OPENROUTER_API_KEY:', envVars.OPENROUTER_API_KEY ? 'SET ✓' : 'NOT SET ✗');

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
console.log('Firebase Config Available:', !!window.FIREBASE_API_KEY);
console.log('OpenRouter API Key Available:', !!window.ENV_CONFIG.OPENROUTER_API_KEY);
`;

try {
  // Write the env-config.js file
  const outputPath = path.join(process.cwd(), 'env-config.js');
  fs.writeFileSync(outputPath, envConfigContent, 'utf8');
  console.log('✅ Successfully created env-config.js with environment variables');
  
  // Verify the file was written correctly
  const stats = fs.statSync(outputPath);
  console.log(`📄 File size: ${stats.size} bytes`);
  
} catch (error) {
  console.error('❌ Failed to create env-config.js:', error.message);
  process.exit(1);
}