// @ts-nocheck
/**
 * Database compatibility layer - now uses Vercel Blob Storage
 * This file maintains the same API as the old SQLite database for backward compatibility
 */
import BlobStorage, { type ChatSettings } from './blob-storage';

export type { ChatSettings };

// Chat Settings Store - compatible with old SQLite API
export class ChatSettingsStore {
  static async setChatSettings(sessionId: string, chatId: string, settings: ChatSettings): Promise<void> {
    return BlobStorage.setChatSettings(sessionId, chatId, settings);
  }

  static async getChatSettings(sessionId: string, chatId: string): Promise<ChatSettings | null> {
    return BlobStorage.getChatSettings(sessionId, chatId);
  }

  static async deleteChatSettings(sessionId: string, chatId: string): Promise<boolean> {
    return BlobStorage.deleteChatSettings(sessionId, chatId);
  }

  static async listChatSettings(sessionId: string): Promise<ChatSettings[]> {
    return BlobStorage.listChatSettings(sessionId);
  }

  static async getAllChatSettings(sessionId: string): Promise<ChatSettings[]> {
    return BlobStorage.listChatSettings(sessionId);
  }
}

// LLM Results Store - stub for now (can be implemented later if needed)
export class LLMResultsStore {
  static async saveLLMResult(data: any): Promise<void> {
    console.warn('⚠️ LLM Results storage not yet implemented in Blob storage');
    // TODO: Implement if needed
  }

  static async getLLMResults(sessionId: string, options?: any): Promise<any[]> {
    console.warn('⚠️ LLM Results retrieval not yet implemented in Blob storage');
    return [];
  }
}

// Session Store - redirect to storage adapter
export { StorageAdapter as SessionStore } from './storage-adapter';

export default BlobStorage;

