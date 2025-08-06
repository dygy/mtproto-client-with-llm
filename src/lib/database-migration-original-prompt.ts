// @ts-nocheck
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'sessions.db');

export function migrateOriginalPrompt() {
  const db = new Database(dbPath);
  
  try {
    console.log('🔄 Starting original_prompt column migration...');
    
    // Check if column already exists in llm_processing table
    const tableInfo = db.pragma('table_info(llm_processing)') as Array<{name: string}>;
    const columns = tableInfo.map((col: any) => col.name);
    
    const hasOriginalPromptColumn = columns.includes('original_prompt');
    
    if (hasOriginalPromptColumn) {
      console.log('✅ original_prompt column already exists, skipping migration');
      db.close();
      return;
    }
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    // Add original_prompt column to llm_processing table
    console.log('📝 Adding original_prompt column to llm_processing table...');
    db.exec(`
      ALTER TABLE llm_processing 
      ADD COLUMN original_prompt TEXT
    `);
    
    // Update existing records to copy prompt to original_prompt
    // This is a fallback - ideally we'd have the original templates
    console.log('📝 Updating existing records...');
    db.exec(`
      UPDATE llm_processing 
      SET original_prompt = prompt 
      WHERE original_prompt IS NULL
    `);
    
    // Commit transaction
    db.exec('COMMIT');
    
    console.log('✅ original_prompt column migration completed successfully');
    
  } catch (error) {
    console.error('❌ Error during original_prompt migration:', error);
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
  migrateOriginalPrompt();
}
