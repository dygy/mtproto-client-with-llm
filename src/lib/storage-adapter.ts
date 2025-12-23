// @ts-nocheck
/**
 * Storage Adapter - Uses Vercel Blob Storage exclusively
 */
import { BlobStorage } from './blob-storage';
import type { SessionData } from './blob-storage';

// Always use Vercel Blob Storage
const storage = BlobStorage;

export class StorageAdapter {
  static async setSession(sessionId: string, sessionData: SessionData, expiresIn?: number): Promise<void> {
    return storage.setSession(sessionId, sessionData, expiresIn);
  }

  static async getSession(sessionId: string): Promise<SessionData | null> {
    return storage.getSession(sessionId);
  }

  static async deleteSession(sessionId: string): Promise<boolean> {
    return storage.deleteSession(sessionId);
  }

  static async listSessions(): Promise<any[]> {
    return storage.listSessions();
  }

  static async getSessionByUserId(userId: number): Promise<SessionData | null> {
    return storage.getSessionByUserId(userId);
  }

  static async getSessionByPhone(phoneNumber: string): Promise<SessionData | null> {
    return storage.getSessionByPhone(phoneNumber);
  }

  static async cleanupExpiredSessions(): Promise<number> {
    // Blob storage doesn't need cleanup (handled by Vercel)
    return 0;
  }
}

export default StorageAdapter;

