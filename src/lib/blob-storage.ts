// @ts-nocheck
/**
 * Vercel Blob Storage adapter for session and data persistence
 * Replaces SQLite for serverless compatibility
 */
import './env.js'; // Load environment variables from .env file
import { put, del, list, head } from '@vercel/blob';

export interface SessionData {
  client?: any;
  phoneNumber?: string;
  phoneCodeHash?: string;
  isAuthenticated: boolean;
  sessionString?: string;
  telegramSession?: string;
  userInfo?: {
    id: number;
    firstName?: string;
    lastName?: string;
    username?: string;
    phone?: string;
  };
  loginTokenBase64?: string;
  qrGenerated?: boolean;
  expires?: number;
  timestamp?: string;
  [key: string]: any;
}

export interface SessionRecord {
  id: string;
  data: SessionData;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  is_authenticated: boolean;
  user_id?: number;
  phone_number?: string;
}

export interface ChatSettings {
  id?: number;
  session_id: string;
  chat_id: string;
  llm_enabled: boolean;
  llm_provider: string;
  llm_model: string;
  llm_prompt: string;
  auto_reply: boolean;
  keywords: string;
  notifications: boolean;
  custom_llm_config?: any;
  created_at?: string;
  updated_at?: string;
}

// Helper to generate blob paths
const getBlobPath = (type: 'session' | 'chat-settings' | 'llm-results', id: string) => {
  return `${type}/${id}.json`;
};

const getIndexPath = (type: 'session' | 'chat-settings' | 'llm-results') => {
  return `${type}/index.json`;
};

// Check if Vercel Blob is configured
const isBlobConfigured = () => {
  const isConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (!isConfigured) {
    console.error('❌ BLOB_READ_WRITE_TOKEN is not configured!');
    console.error('📝 Please set BLOB_READ_WRITE_TOKEN in your environment variables.');
    console.error('🔗 Get it from: https://vercel.com/dashboard/stores');
  }
  return isConfigured;
};

export class BlobStorage {
  // ============ SESSION METHODS ============

  static async setSession(sessionId: string, sessionData: SessionData, expiresIn?: number): Promise<void> {
    if (!isBlobConfigured()) {
      throw new Error('BLOB_READ_WRITE_TOKEN is required. Please configure Vercel Blob Storage.');
    }

    try {
      const cleanSessionData = {
        phoneNumber: sessionData.phoneNumber || null,
        phoneCodeHash: sessionData.phoneCodeHash || null,
        isAuthenticated: sessionData.isAuthenticated || false,
        userInfo: sessionData.userInfo || null,
        telegramSession: sessionData.telegramSession || null,
        loginTokenBase64: sessionData.loginTokenBase64 || null,
        qrGenerated: sessionData.qrGenerated || null,
        expires: sessionData.expires || null,
        timestamp: new Date().toISOString()
      };

      const record: SessionRecord = {
        id: sessionId,
        data: cleanSessionData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: expiresIn ? new Date(Date.now() + expiresIn).toISOString() : undefined,
        is_authenticated: sessionData.isAuthenticated || false,
        user_id: sessionData.userInfo?.id,
        phone_number: sessionData.phoneNumber
      };

      const blobPath = getBlobPath('session', sessionId);
      const blob = await put(blobPath, JSON.stringify(record), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        allowOverwrite: true  // Allow updating existing sessions
      });

      console.log(`💾 Session saved to Vercel Blob: ${sessionId}`);

      // Update index
      await this.updateIndex('session', sessionId, {
        id: sessionId,
        is_authenticated: record.is_authenticated,
        user_id: record.user_id,
        phone_number: record.phone_number,
        updated_at: record.updated_at
      });
    } catch (error) {
      console.error(`❌ Error saving session to blob: ${sessionId}`, error);
      throw error;
    }
  }

  static async getSession(sessionId: string): Promise<SessionData | null> {
    if (!isBlobConfigured()) {
      console.warn('⚠️ Vercel Blob not configured');
      return null;
    }

    try {
      const blobPath = getBlobPath('session', sessionId);

      // List blobs to find the session
      const { blobs } = await list({ prefix: blobPath });

      if (blobs.length === 0) {
        return null;
      }

      // Fetch the blob content
      const response = await fetch(blobs[0].url);

      if (!response.ok) {
        return null;
      }

      const record: SessionRecord = await response.json();
      return record.data;
    } catch (error) {
      console.error(`❌ Error getting session from blob: ${sessionId}`, error);
      return null;
    }
  }

  static async deleteSession(sessionId: string): Promise<boolean> {
    if (!isBlobConfigured()) {
      return false;
    }

    try {
      const blobPath = getBlobPath('session', sessionId);
      await del(blobPath);

      console.log(`🗑️ Session deleted from blob: ${sessionId}`);

      // Update index
      await this.removeFromIndex('session', sessionId);

      return true;
    } catch (error) {
      console.error(`❌ Error deleting session from blob: ${sessionId}`, error);
      return false;
    }
  }

  static async listSessions(): Promise<Omit<SessionRecord, 'data'>[]> {
    if (!isBlobConfigured()) {
      return [];
    }

    try {
      const indexPath = getIndexPath('session');
      const { blobs } = await list({ prefix: indexPath });

      if (blobs.length === 0) {
        return [];
      }

      const response = await fetch(blobs[0].url);
      const index = await response.json();

      return Object.values(index);
    } catch (error) {
      console.error('❌ Error listing sessions from blob:', error);
      return [];
    }
  }

  static async getSessionByUserId(userId: number): Promise<SessionData | null> {
    if (!isBlobConfigured()) {
      return null;
    }

    try {
      const sessions = await this.listSessions();
      const session = sessions.find(s => s.user_id === userId);

      if (!session) {
        return null;
      }

      return await this.getSession(session.id);
    } catch (error) {
      console.error(`❌ Error getting session by user ID ${userId}:`, error);
      return null;
    }
  }

  static async getSessionByPhone(phoneNumber: string): Promise<SessionData | null> {
    if (!isBlobConfigured()) {
      return null;
    }

    try {
      const sessions = await this.listSessions();
      const session = sessions.find(s => s.phone_number === phoneNumber);

      if (!session) {
        return null;
      }

      return await this.getSession(session.id);
    } catch (error) {
      console.error(`❌ Error getting session by phone ${phoneNumber}:`, error);
      return null;
    }
  }

  // ============ INDEX MANAGEMENT ============

  private static async updateIndex(type: string, id: string, metadata: any): Promise<void> {
    try {
      const indexPath = getIndexPath(type as any);
      let index: any = {};

      // Try to get existing index
      try {
        const { blobs } = await list({ prefix: indexPath });
        if (blobs.length > 0) {
          const response = await fetch(blobs[0].url);
          index = await response.json();
        }
      } catch {
        // Index doesn't exist yet
      }

      // Update index
      index[id] = metadata;

      // Save updated index
      await put(indexPath, JSON.stringify(index), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        allowOverwrite: true  // Allow updating index
      });
    } catch (error) {
      console.error('❌ Error updating index:', error);
    }
  }

  private static async removeFromIndex(type: string, id: string): Promise<void> {
    try {
      const indexPath = getIndexPath(type as any);
      let index: any = {};

      // Get existing index
      try {
        const { blobs } = await list({ prefix: indexPath });
        if (blobs.length > 0) {
          const response = await fetch(blobs[0].url);
          index = await response.json();
        }
      } catch {
        return; // Index doesn't exist
      }

      // Remove from index
      delete index[id];

      // Save updated index
      await put(indexPath, JSON.stringify(index), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        allowOverwrite: true  // Allow updating index
      });
    } catch (error) {
      console.error('❌ Error removing from index:', error);
    }
  }

  // ============ CHAT SETTINGS METHODS ============

  static async setChatSettings(sessionId: string, chatId: string, settings: ChatSettings): Promise<void> {
    if (!isBlobConfigured()) {
      throw new Error('BLOB_READ_WRITE_TOKEN is required');
    }

    try {
      const blobPath = getBlobPath('chat-settings', `${sessionId}_${chatId}`);
      const settingsData = {
        ...settings,
        session_id: sessionId,
        chat_id: chatId,
        updated_at: new Date().toISOString(),
        created_at: settings.created_at || new Date().toISOString()
      };

      await put(blobPath, JSON.stringify(settingsData), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        allowOverwrite: true  // Allow updating chat settings
      });

      console.log(`💾 Chat settings saved: ${sessionId}/${chatId}`);
    } catch (error) {
      console.error(`❌ Error saving chat settings:`, error);
      throw error;
    }
  }

  static async getChatSettings(sessionId: string, chatId: string): Promise<ChatSettings | null> {
    if (!isBlobConfigured()) {
      return null;
    }

    try {
      const blobPath = getBlobPath('chat-settings', `${sessionId}_${chatId}`);
      const { blobs } = await list({ prefix: blobPath });

      if (blobs.length === 0) {
        return null;
      }

      const response = await fetch(blobs[0].url);
      return await response.json();
    } catch (error) {
      console.error(`❌ Error getting chat settings:`, error);
      return null;
    }
  }

  static async deleteChatSettings(sessionId: string, chatId: string): Promise<boolean> {
    if (!isBlobConfigured()) {
      return false;
    }

    try {
      const blobPath = getBlobPath('chat-settings', `${sessionId}_${chatId}`);
      await del(blobPath);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting chat settings:`, error);
      return false;
    }
  }

  static async listChatSettings(sessionId: string): Promise<ChatSettings[]> {
    if (!isBlobConfigured()) {
      return [];
    }

    try {
      const { blobs } = await list({ prefix: `chat-settings/${sessionId}_` });
      const settings: ChatSettings[] = [];

      for (const blob of blobs) {
        const response = await fetch(blob.url);
        const data = await response.json();
        settings.push(data);
      }

      return settings;
    } catch (error) {
      console.error('❌ Error listing chat settings:', error);
      return [];
    }
  }
}

export default BlobStorage;

