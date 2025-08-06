// @ts-nocheck
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database file path
const DB_PATH = path.join(process.cwd(), 'data', 'sessions.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function runMigrations() {
  const db = new Database(DB_PATH);
  
  try {
    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    
    // Get current schema version
    let schemaVersion = 0;
    try {
      const result = db.prepare('PRAGMA user_version').get() as { user_version: number };
      schemaVersion = result.user_version;
    } catch (error) {
      console.log('📊 No schema version found, starting from 0');
    }
    
    console.log(`📊 Current database schema version: ${schemaVersion}`);
    
    // Migration 1: Create sessions table
    if (schemaVersion < 1) {
      console.log('🔄 Running migration 1: Create sessions table');
      
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

        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_phone ON sessions(phone_number);
        CREATE INDEX IF NOT EXISTS idx_sessions_authenticated ON sessions(is_authenticated);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      `);
      
      db.pragma('user_version = 1');
      console.log('✅ Migration 1 completed');
    }
    
    // Migration 2: Create chat_settings table
    if (schemaVersion < 2) {
      console.log('🔄 Running migration 2: Create chat_settings table');
      
      db.exec(`
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

        CREATE INDEX IF NOT EXISTS idx_chat_settings_session ON chat_settings(session_id);
        CREATE INDEX IF NOT EXISTS idx_chat_settings_chat ON chat_settings(chat_id);
        CREATE INDEX IF NOT EXISTS idx_chat_settings_llm_enabled ON chat_settings(llm_enabled);
      `);
      
      db.pragma('user_version = 2');
      console.log('✅ Migration 2 completed');
    }
    
    // Migration 3: Create LLM processing logs table (for future analytics)
    if (schemaVersion < 3) {
      console.log('🔄 Running migration 3: Create LLM processing logs table');
      
      db.exec(`
        CREATE TABLE IF NOT EXISTS llm_processing_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          chat_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          original_message TEXT NOT NULL,
          llm_prompt TEXT NOT NULL,
          llm_response TEXT,
          processing_time_ms INTEGER DEFAULT 0,
          success BOOLEAN DEFAULT FALSE,
          error_message TEXT,
          auto_replied BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_llm_logs_session ON llm_processing_logs(session_id);
        CREATE INDEX IF NOT EXISTS idx_llm_logs_chat ON llm_processing_logs(chat_id);
        CREATE INDEX IF NOT EXISTS idx_llm_logs_success ON llm_processing_logs(success);
        CREATE INDEX IF NOT EXISTS idx_llm_logs_created ON llm_processing_logs(created_at);
      `);
      
      db.pragma('user_version = 3');
      console.log('✅ Migration 3 completed');
    }
    
    const finalVersion = db.prepare('PRAGMA user_version').get() as { user_version: number };
    console.log(`📊 Database migrations completed. Final schema version: ${finalVersion.user_version}`);
    
  } catch (error) {
    console.error('❌ Error running database migrations:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run migrations automatically when this module is imported
runMigrations();
