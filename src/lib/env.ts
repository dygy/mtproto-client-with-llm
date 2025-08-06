// @ts-nocheck
// Environment variable loader for server-side code
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file if they're not already set
function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            // Only set if not already set
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not load .env file:', error);
  }
}

// Load environment variables
loadEnvFile();

// Export environment variables with fallbacks
export const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
export const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || '';

// Validation
if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH) {
  const errorMsg = 'Missing Telegram API credentials in environment variables';
  console.error(errorMsg);

  // In production, this is critical
  if (process.env.NODE_ENV === 'production') {
    console.error('TELEGRAM_API_ID:', TELEGRAM_API_ID || 'not set');
    console.error('TELEGRAM_API_HASH:', TELEGRAM_API_HASH ? 'set' : 'not set');
    console.error('Please set these environment variables in your Render dashboard');
  }
}
