// @ts-nocheck
import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'sessions.db');

export const GET: APIRoute = async ({ params }) => {
  const { sessionId, chatId } = params;

  if (!sessionId || !chatId) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Session ID and Chat ID are required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const db = new Database(dbPath);
    
    try {
      // Check if llm_processing table exists, if not create it
      const tableExists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='llm_processing'
      `).get();

      if (!tableExists) {
        // Create the table if it doesn't exist
        db.exec(`
          CREATE TABLE llm_processing (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            chat_id TEXT NOT NULL,
            message_id INTEGER NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            prompt TEXT NOT NULL,
            original_prompt TEXT,
            response TEXT,
            error TEXT,
            processing_time INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(session_id, chat_id, message_id, provider, model)
          )
        `);
        
        console.log('✅ Created llm_processing table');
      }

      // Get LLM processing results from both tables
      // 1. Auto-processing results from llm_processing_log
      // Join with chat_settings to get actual provider/model info
      const autoResults = db.prepare(`
        SELECT
          lpl.message_id,
          COALESCE(cs.llm_provider, 'unknown') as provider,
          COALESCE(cs.llm_model, 'unknown') as model,
          lpl.llm_prompt as prompt,
          lpl.llm_response as response,
          lpl.error_message as error,
          lpl.processing_time_ms as processing_time,
          lpl.created_at
        FROM llm_processing_log lpl
        LEFT JOIN chat_settings cs ON cs.session_id = lpl.session_id AND cs.chat_id = lpl.chat_id
        WHERE lpl.session_id = ? AND lpl.chat_id = ? AND lpl.success = 1
        ORDER BY lpl.created_at DESC
      `).all(sessionId, chatId) as Array<{
        message_id: string;
        provider: string;
        model: string;
        prompt: string;
        response: string | null;
        error: string | null;
        processing_time: number | null;
        created_at: string;
      }>;

      // 2. Manual test results from llm_processing
      const testResults = db.prepare(`
        SELECT
          message_id,
          provider,
          model,
          prompt,
          response,
          error,
          processing_time,
          created_at
        FROM llm_processing
        WHERE session_id = ? AND chat_id = ? AND response IS NOT NULL
        ORDER BY created_at DESC
      `).all(sessionId, chatId) as Array<{
        message_id: string;
        provider: string;
        model: string;
        prompt: string;
        response: string | null;
        error: string | null;
        processing_time: number | null;
        created_at: string;
      }>;

      // Combine both result sets
      const results = [...autoResults, ...testResults];

      console.log(`📊 Found ${autoResults.length} auto-processing + ${testResults.length} test results = ${results.length} total for chat ${chatId}`);

      // Group results by message_id (in case there are multiple LLM tests per message)
      const groupedResults: { [messageId: number]: any } = {};

      for (const result of results) {
        // Extract numeric message ID from the message_id field
        // message_id can be either a number or a timestamp_senderId format
        let numericMessageId: number;

        // Convert to string first to safely check format
        const messageIdStr = String(result.message_id);

        if (messageIdStr.includes('_')) {
          // This is a timestamp_senderId format, skip it for now
          // as we can't match it to actual message IDs
          console.log(`⏭️ Skipping timestamp-based message ID: ${messageIdStr}`);
          continue;
        } else {
          // This should be a numeric message ID
          numericMessageId = parseInt(messageIdStr, 10);
          if (isNaN(numericMessageId)) {
            console.log(`⚠️ Invalid message ID format: ${messageIdStr}`);
            continue;
          }
        }

        if (!groupedResults[numericMessageId]) {
          groupedResults[numericMessageId] = {
            messageId: numericMessageId,
            tests: []
          };
        }

        groupedResults[numericMessageId].tests.push({
          provider: result.provider,
          model: result.model,
          prompt: result.prompt,
          content: result.response,
          error: result.error,
          processingTime: result.processing_time,
          timestamp: result.created_at
        });

        // Set the latest successful result as the main result
        if (result.response && !groupedResults[numericMessageId].content) {
          groupedResults[numericMessageId].content = result.response;
          groupedResults[numericMessageId].provider = result.provider;
          groupedResults[numericMessageId].model = result.model;
          groupedResults[numericMessageId].timestamp = result.created_at;
        }
      }



      return new Response(JSON.stringify({
        success: true,
        results: groupedResults
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('Error fetching LLM results:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to fetch LLM results'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
