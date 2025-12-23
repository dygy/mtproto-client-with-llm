#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Fix the runtime version in Vercel config
const configPath = join(process.cwd(), '.vercel/output/functions/_render.func/.vc-config.json');

try {
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  
  // Update runtime to nodejs20.x
  config.runtime = 'nodejs20.x';
  
  writeFileSync(configPath, JSON.stringify(config, null, '\t'));
  console.log('✅ Updated Vercel runtime to nodejs20.x');
} catch (error) {
  console.error('❌ Failed to update Vercel runtime:', error.message);
  process.exit(1);
}

