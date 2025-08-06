// @ts-nocheck
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { migrateOriginalPrompt } from './database-migration-original-prompt.js';

// Database file path
const DB_PATH = path.join(process.cwd(), 'data', 'sessions.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function initializeDatabase() {
  const db = new Database(DB_PATH);
  
  try {
    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    

    
    // Create sessions table
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
    
    // Create chat_settings table
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
    


  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    db.close();
  }

  // Run migrations
  try {
    migrateOriginalPrompt();
  } catch (error) {
    console.error('Error running original_prompt migration:', error);
  }
}

// Initialize database when this module is imported
initializeDatabase();
