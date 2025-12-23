#!/usr/bin/env node
/**
 * Generate a random salt for password hashing
 * Usage: node scripts/generate-salt.js
 */

import crypto from 'crypto';

console.log('\n🔐 Password Protection Setup\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Generate a random salt
const salt = crypto.randomBytes(32).toString('hex');

console.log('Generated PASSWORD_SALT:');
console.log('─────────────────────────────────────────────────────────');
console.log(salt);
console.log('─────────────────────────────────────────────────────────\n');

console.log('📋 Add these to your .env file:\n');
console.log('APP_PASSWORD=your_secure_password_here');
console.log(`PASSWORD_SALT=${salt}\n`);

console.log('⚠️  IMPORTANT:');
console.log('  • Keep the salt SECRET - never commit to git');
console.log('  • Choose a STRONG password (12+ characters)');
console.log('  • Use different salts for dev and production');
console.log('  • Add both variables to Vercel environment settings\n');

console.log('✅ Copy the salt above and add it to your .env file');
console.log('═══════════════════════════════════════════════════════════\n');

