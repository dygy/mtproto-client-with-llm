// @ts-nocheck
import * as Database from 'better-sqlite3';
import * as path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'sessions.db');

export function migrateLLMProviders() {
  const db = new (Database as any)(dbPath);
  
  try {
    console.log('🔄 Starting LLM providers migration...');
    
    // Check if columns already exist
    const tableInfo = db.pragma('table_info(chat_settings)');
    const columns = tableInfo.map((col: any) => col.name);
    
    const hasProviderColumn = columns.includes('llm_provider');
    const hasModelColumn = columns.includes('llm_model');
    
    if (hasProviderColumn && hasModelColumn) {
      console.log('✅ LLM provider columns already exist, skipping migration');
      db.close();
      return;
    }
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    // Add new columns if they don't exist
    if (!hasProviderColumn) {
      console.log('📝 Adding llm_provider column...');
      db.exec(`
        ALTER TABLE chat_settings 
        ADD COLUMN llm_provider TEXT DEFAULT 'openai'
      `);
    }
    
    if (!hasModelColumn) {
      console.log('📝 Adding llm_model column...');
      db.exec(`
        ALTER TABLE chat_settings 
        ADD COLUMN llm_model TEXT DEFAULT 'gpt-4o-mini'
      `);
    }
    
    // Update existing records with default values
    console.log('📝 Updating existing records with default provider/model...');
    db.exec(`
      UPDATE chat_settings 
      SET llm_provider = 'openai', llm_model = 'gpt-4o-mini' 
      WHERE llm_provider IS NULL OR llm_model IS NULL
    `);
    
    // Commit transaction
    db.exec('COMMIT');
    
    console.log('✅ LLM providers migration completed successfully');
    
  } catch (error) {
    console.error('❌ Error during LLM providers migration:', error);
    try {
      db.exec('ROLLBACK');
    } catch (rollbackError) {
      console.error('❌ Error during rollback:', rollbackError);
    }
    throw error;
  } finally {
    db.close();
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateLLMProviders();
}
