// @ts-nocheck
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import './init-database.js';

// Database file path
const DB_PATH = path.join(process.cwd(), 'data', 'sessions.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_authenticated BOOLEAN DEFAULT FALSE,
    user_id INTEGER,
    phone_number TEXT
  );

  CREATE TABLE IF NOT EXISTS chat_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    llm_enabled BOOLEAN DEFAULT FALSE,
    llm_prompt TEXT DEFAULT '',
    auto_reply BOOLEAN DEFAULT FALSE,
    keywords TEXT DEFAULT '',
    notifications BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, chat_id)
  );

  CREATE TABLE IF NOT EXISTS llm_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    chat_id INTEGER NOT NULL,
    prompt_used TEXT NOT NULL,
    llm_provider TEXT NOT NULL,
    llm_model TEXT NOT NULL,
    llm_response TEXT NOT NULL,
    processing_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, message_id, chat_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_phone ON sessions(phone_number);
  CREATE INDEX IF NOT EXISTS idx_sessions_authenticated ON sessions(is_authenticated);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_chat_settings_session ON chat_settings(session_id);
  CREATE INDEX IF NOT EXISTS idx_chat_settings_chat ON chat_settings(chat_id);
  CREATE INDEX IF NOT EXISTS idx_chat_settings_llm_enabled ON chat_settings(llm_enabled);
`);

// Prepared statements for better performance
const statements = {
  // Session statements
  insert: db.prepare(`
    INSERT OR REPLACE INTO sessions (id, data, is_authenticated, user_id, phone_number, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `),

  get: db.prepare('SELECT * FROM sessions WHERE id = ?'),

  delete: db.prepare('DELETE FROM sessions WHERE id = ?'),

  list: db.prepare('SELECT id, is_authenticated, user_id, phone_number, created_at, updated_at FROM sessions ORDER BY updated_at DESC'),

  cleanup: db.prepare('DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP'),

  getByUserId: db.prepare('SELECT * FROM sessions WHERE user_id = ? AND is_authenticated = TRUE ORDER BY updated_at DESC LIMIT 1'),

  getByPhone: db.prepare('SELECT * FROM sessions WHERE phone_number = ? ORDER BY updated_at DESC LIMIT 1'),

  // Chat settings statements
  insertChatSettings: db.prepare(`
    INSERT OR REPLACE INTO chat_settings
    (session_id, chat_id, llm_enabled, llm_provider, llm_model, llm_prompt, auto_reply, keywords, notifications, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `),

  getChatSettings: db.prepare('SELECT * FROM chat_settings WHERE session_id = ? AND chat_id = ?'),

  deleteChatSettings: db.prepare('DELETE FROM chat_settings WHERE session_id = ? AND chat_id = ?'),

  listChatSettings: db.prepare('SELECT * FROM chat_settings WHERE session_id = ? ORDER BY updated_at DESC'),

  getChatSettingsByLLMEnabled: db.prepare('SELECT * FROM chat_settings WHERE session_id = ? AND llm_enabled = TRUE'),

  // LLM Results statements
  insertLLMResult: db.prepare(`
    INSERT OR REPLACE INTO llm_results
    (user_id, message_id, chat_id, prompt_used, llm_provider, llm_model, llm_response, processing_time_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getLLMResult: db.prepare(`
    SELECT * FROM llm_results
    WHERE user_id = ? AND message_id = ? AND chat_id = ?
  `),

  getLLMResultsByUser: db.prepare(`
    SELECT * FROM llm_results
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `),

  deleteLLMResult: db.prepare(`
    DELETE FROM llm_results
    WHERE user_id = ? AND message_id = ? AND chat_id = ?
  `)
};

export interface SessionData {
  client?: any;
  phoneNumber?: string;
  isAuthenticated: boolean;
  sessionString?: string;
  userInfo?: {
    id: number;
    firstName?: string;
    lastName?: string;
    username?: string;
    phone?: string;
  };
  [key: string]: any;
}

export interface SessionRecord {
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  is_authenticated: boolean;
  user_id?: number;
  phone_number?: string;
}

export interface ChatSettings {
  llmEnabled: boolean;
  llmProvider: string;
  llmModel: string;
  llmPrompt: string;
  autoReply: boolean;
  keywords: string[];
  notifications: boolean;
}

export interface ChatSettingsRecord {
  id: number;
  session_id: string;
  chat_id: string;
  llm_enabled: boolean;
  llm_provider: string;
  llm_model: string;
  llm_prompt: string;
  auto_reply: boolean;
  keywords: string;
  notifications: boolean;
  created_at: string;
  updated_at: string;
}

export class SessionStore {
  // Save session data
  static async setSession(sessionId: string, sessionData: SessionData, expiresIn?: number): Promise<void> {
    try {
      // Create a clean copy of session data without the client object
      const cleanSessionData = {
        phoneNumber: sessionData.phoneNumber || null,
        phoneCodeHash: sessionData.phoneCodeHash || null,
        isAuthenticated: sessionData.isAuthenticated || false,
        userInfo: sessionData.userInfo || null,
        telegramSession: sessionData.telegramSession || null,
        // QR login fields
        loginTokenBase64: sessionData.loginTokenBase64 || null,
        qrGenerated: sessionData.qrGenerated || null,
        expires: sessionData.expires || null,
        timestamp: new Date().toISOString()
      };

      // Ensure all values are serializable
      const dataJson = JSON.stringify(cleanSessionData);
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn).toISOString() : null;
      const userId = sessionData.userInfo?.id || null;
      const phoneNumber = sessionData.phoneNumber || null;

      // Debug: Log what we're trying to save
      console.log(`🔍 Saving session ${sessionId} with parameters:`, {
        sessionId: typeof sessionId,
        dataJson: typeof dataJson,
        isAuthenticated: typeof (sessionData.isAuthenticated ? 1 : 0),
        userId: typeof userId,
        phoneNumber: typeof phoneNumber,
        expiresAt: expiresAt === null ? 'null' : typeof expiresAt
      });

      // Ensure all parameters are the correct types for SQLite
      const params = [
        String(sessionId),                                    // TEXT
        String(dataJson),                                     // TEXT
        sessionData.isAuthenticated ? 1 : 0,                 // INTEGER (boolean as 0/1)
        userId === null ? null : Number(userId),             // INTEGER or NULL
        phoneNumber === null ? null : String(phoneNumber),   // TEXT or NULL
        expiresAt === null ? null : String(expiresAt)        // TEXT or NULL
      ];

      statements.insert.run(...params);

      console.log(`💾 Session saved to database: ${sessionId} (authenticated: ${sessionData.isAuthenticated})`);
    } catch (error) {
      console.error(`❌ Error saving session ${sessionId}:`, error);
      console.error(`❌ Session data keys:`, Object.keys(sessionData));
      console.error(`❌ Session data types:`, Object.keys(sessionData).map(key => `${key}: ${typeof sessionData[key]}`));
      throw error;
    }
  }

  // Get session data
  static async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const record = statements.get.get(sessionId) as SessionRecord | undefined;
      
      if (!record) {
        return null;
      }

      return JSON.parse(record.data) as SessionData;
    } catch (error) {
      console.error(`❌ Error getting session ${sessionId}:`, error);
      return null;
    }
  }

  // Delete session
  static async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const result = statements.delete.run(sessionId);
      const deleted = result.changes > 0;
      
      if (deleted) {
        console.log(`🗑️ Session deleted from database: ${sessionId}`);
      } else {
        console.log(`⚠️ Session not found for deletion: ${sessionId}`);
      }
      
      return deleted;
    } catch (error) {
      console.error(`❌ Error deleting session ${sessionId}:`, error);
      return false;
    }
  }

  // List all sessions
  static async listSessions(): Promise<Omit<SessionRecord, 'data'>[]> {
    try {
      const records = statements.list.all() as Omit<SessionRecord, 'data'>[];

      return records;
    } catch (error) {
      console.error('❌ Error listing sessions:', error);
      return [];
    }
  }

  // Clean up expired sessions
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = statements.cleanup.run();
      const deletedCount = result.changes;
      

      
      return deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  // Get session by user ID
  static async getSessionByUserId(userId: number): Promise<SessionData | null> {
    try {
      const record = statements.getByUserId.get(userId) as SessionRecord | undefined;
      
      if (!record) {
        return null;
      }

      return JSON.parse(record.data) as SessionData;
    } catch (error) {
      console.error(`❌ Error getting session by user ID ${userId}:`, error);
      return null;
    }
  }

  // Get session by phone number
  static async getSessionByPhone(phoneNumber: string): Promise<SessionData | null> {
    try {
      const record = statements.getByPhone.get(phoneNumber) as SessionRecord | undefined;
      
      if (!record) {
        return null;
      }

      return JSON.parse(record.data) as SessionData;
    } catch (error) {
      console.error(`❌ Error getting session by phone ${phoneNumber}:`, error);
      return null;
    }
  }

  // Close database connection
  static close(): void {
    db.close();
  }
}

// Auto-cleanup expired sessions every hour
setInterval(() => {
  SessionStore.cleanupExpiredSessions();
}, 60 * 60 * 1000);

// Chat Settings Store
export class ChatSettingsStore {
  // Save chat settings
  static async setChatSettings(sessionId: string, chatId: string, settings: ChatSettings): Promise<void> {
    try {
      const keywordsString = settings.keywords.join(',');

      statements.insertChatSettings.run(
        sessionId,
        chatId,
        settings.llmEnabled ? 1 : 0,
        settings.llmProvider || 'openai',
        settings.llmModel || 'gpt-4o-mini',
        settings.llmPrompt,
        settings.autoReply ? 1 : 0,
        keywordsString,
        settings.notifications ? 1 : 0
      );

      console.log(`💾 Chat settings saved: ${sessionId}/${chatId} (LLM: ${settings.llmEnabled})`);
    } catch (error) {
      console.error(`❌ Error saving chat settings ${sessionId}/${chatId}:`, error);
      throw error;
    }
  }

  // Get chat settings
  static async getChatSettings(sessionId: string, chatId: string): Promise<ChatSettings | null> {
    try {
      const record = statements.getChatSettings.get(sessionId, chatId) as ChatSettingsRecord | undefined;

      if (!record) {
        return {
          llmEnabled: false,
          llmProvider: 'openai',
          llmModel: 'gpt-4o-mini',
          llmPrompt: '',
          autoReply: false,
          keywords: [],
          notifications: true
        };
      }

      const settings: ChatSettings = {
        llmEnabled: Boolean(record.llm_enabled),
        llmProvider: record.llm_provider || 'openai',
        llmModel: record.llm_model || 'gpt-4o-mini',
        llmPrompt: record.llm_prompt,
        autoReply: Boolean(record.auto_reply),
        keywords: record.keywords ? record.keywords.split(',').filter(k => k.trim()) : [],
        notifications: Boolean(record.notifications)
      };

      return settings;
    } catch (error) {
      console.error(`❌ Error getting chat settings ${sessionId}/${chatId}:`, error);
      return null;
    }
  }

  // Delete chat settings
  static async deleteChatSettings(sessionId: string, chatId: string): Promise<boolean> {
    try {
      const result = statements.deleteChatSettings.run(sessionId, chatId);
      const deleted = result.changes > 0;

      if (deleted) {
        console.log(`🗑️ Chat settings deleted: ${sessionId}/${chatId}`);
      } else {
        console.log(`⚠️ Chat settings not found for deletion: ${sessionId}/${chatId}`);
      }

      return deleted;
    } catch (error) {
      console.error(`❌ Error deleting chat settings ${sessionId}/${chatId}:`, error);
      return false;
    }
  }

  // List all chat settings for a session
  static async listChatSettings(sessionId: string): Promise<ChatSettingsRecord[]> {
    try {
      const records = statements.listChatSettings.all(sessionId) as ChatSettingsRecord[];
      console.log(`📋 Listed ${records.length} chat settings for session ${sessionId}`);
      return records;
    } catch (error) {
      console.error(`❌ Error listing chat settings for session ${sessionId}:`, error);
      return [];
    }
  }

  // Get chats with LLM enabled for a session
  static async getChatSettingsWithLLMEnabled(sessionId: string): Promise<ChatSettingsRecord[]> {
    try {
      const records = statements.getChatSettingsByLLMEnabled.all(sessionId) as ChatSettingsRecord[];
      console.log(`📋 Found ${records.length} chats with LLM enabled for session ${sessionId}`);
      return records;
    } catch (error) {
      console.error(`❌ Error getting LLM-enabled chats for session ${sessionId}:`, error);
      return [];
    }
  }
}

// LLM Results Store
export class LLMResultsStore {
  // Save LLM result
  static async saveLLMResult(
    userId: number,
    messageId: number,
    chatId: number,
    promptUsed: string,
    llmProvider: string,
    llmModel: string,
    llmResponse: string,
    processingTimeMs?: number
  ): Promise<void> {
    try {
      statements.insertLLMResult.run(
        userId,
        messageId,
        chatId,
        promptUsed,
        llmProvider,
        llmModel,
        llmResponse,
        processingTimeMs || null
      );

      console.log(`💾 LLM result saved: user=${userId}, message=${messageId}, chat=${chatId}`);
    } catch (error) {
      console.error(`❌ Error saving LLM result:`, error);
      throw error;
    }
  }

  // Get LLM result for specific message
  static async getLLMResult(userId: number, messageId: number, chatId: number): Promise<any | null> {
    try {
      const result = statements.getLLMResult.get(userId, messageId, chatId);
      return result || null;
    } catch (error) {
      console.error(`❌ Error getting LLM result:`, error);
      return null;
    }
  }

  // Get recent LLM results for user
  static async getLLMResultsByUser(userId: number, limit: number = 50): Promise<any[]> {
    try {
      const results = statements.getLLMResultsByUser.all(userId, limit);
      return results || [];
    } catch (error) {
      console.error(`❌ Error getting LLM results for user:`, error);
      return [];
    }
  }

  // Delete LLM result
  static async deleteLLMResult(userId: number, messageId: number, chatId: number): Promise<void> {
    try {
      statements.deleteLLMResult.run(userId, messageId, chatId);
      console.log(`🗑️ LLM result deleted: user=${userId}, message=${messageId}, chat=${chatId}`);
    } catch (error) {
      console.error(`❌ Error deleting LLM result:`, error);
      throw error;
    }
  }
}

// Export the SessionStore as default
export default SessionStore;
