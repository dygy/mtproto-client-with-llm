// @ts-nocheck
/**
 * Per-Session Password Protection
 * Each Telegram session has its own password
 */
import { createHash, timingSafeEqual } from 'crypto';
import BlobStorage from './blob-storage.js';

const PASSWORD_SALT = process.env.PASSWORD_SALT || import.meta.env.PASSWORD_SALT || 'default-salt-change-me';

/**
 * Hash a password with salt
 */
export function hashPassword(password: string): string {
  const hash = createHash('sha256');
  hash.update(password + PASSWORD_SALT);
  return hash.digest('hex');
}

/**
 * Set password for a session
 */
export async function setSessionPassword(sessionId: string, password: string): Promise<void> {
  const hashedPassword = hashPassword(password);
  
  // Store in blob storage
  await BlobStorage.put(`session-password/${sessionId}.json`, JSON.stringify({
    sessionId,
    passwordHash: hashedPassword,
    createdAt: new Date().toISOString()
  }), {
    addRandomSuffix: false
  });
}

/**
 * Verify password for a session
 */
export async function verifySessionPassword(sessionId: string, password: string): Promise<boolean> {
  try {
    // Get stored password hash
    const blob = await BlobStorage.head(`session-password/${sessionId}.json`);
    if (!blob) {
      // No password set for this session
      return false;
    }

    const response = await fetch(blob.url);
    const data = await response.json();
    
    const storedHash = data.passwordHash;
    const providedHash = hashPassword(password);

    // Timing-safe comparison
    const storedBuffer = Buffer.from(storedHash, 'hex');
    const providedBuffer = Buffer.from(providedHash, 'hex');

    if (storedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(storedBuffer, providedBuffer);
  } catch (error) {
    console.error('Error verifying session password:', error);
    return false;
  }
}

/**
 * Check if session has a password set
 */
export async function hasSessionPassword(sessionId: string): Promise<boolean> {
  try {
    const blob = await BlobStorage.head(`session-password/${sessionId}.json`);
    return !!blob;
  } catch (error) {
    return false;
  }
}

/**
 * Delete session password
 */
export async function deleteSessionPassword(sessionId: string): Promise<void> {
  try {
    await BlobStorage.del(`session-password/${sessionId}.json`);
  } catch (error) {
    console.error('Error deleting session password:', error);
  }
}

/**
 * Generate session unlock token (stored in localStorage after password verification)
 */
export function generateUnlockToken(sessionId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const hash = createHash('sha256');
  hash.update(`${sessionId}${timestamp}${random}${PASSWORD_SALT}`);
  return hash.digest('hex');
}

