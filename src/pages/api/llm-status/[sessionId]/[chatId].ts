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
      // Get chat settings
      const chatSettings = db.prepare(`
        SELECT * FROM chat_settings
        WHERE session_id = ? AND chat_id = ?
      `).get(sessionId, chatId) as any;

      // Get recent LLM processing logs
      const recentLogs = db.prepare(`
        SELECT * FROM llm_processing_log
        WHERE session_id = ? AND chat_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `).all(sessionId, chatId) as any[];

      // Get LLM processing statistics
      const stats = db.prepare(`
        SELECT
          COUNT(*) as total_processed,
          COUNT(CASE WHEN success = 1 THEN 1 END) as successful,
          COUNT(CASE WHEN success = 0 THEN 1 END) as failed,
          AVG(CASE WHEN success = 1 THEN processing_time_ms END) as avg_processing_time,
          MAX(created_at) as last_processed
        FROM llm_processing_log
        WHERE session_id = ? AND chat_id = ?
      `).get(sessionId, chatId) as any;

      // Check LLM service status
      const serviceStatus = {
        initialized: true,
        providers: {
          openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing_key',
          anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing_key',
          mistral: process.env.MISTRAL_API_KEY ? 'configured' : 'missing_key',
          gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing_key'
        }
      };

      console.log(`📊 LLM Status requested for chat ${chatId}`);
      console.log(`⚙️ Chat settings:`, chatSettings);
      console.log(`📈 Stats:`, stats);
      console.log(`🔧 Service status:`, serviceStatus);

      return new Response(JSON.stringify({
        success: true,
        data: {
          chatSettings: chatSettings ? {
            llmEnabled: Boolean(chatSettings.llm_enabled),
            llmProvider: chatSettings.llm_provider || 'openai',
            llmModel: chatSettings.llm_model || 'gpt-4o-mini',
            llmPrompt: chatSettings.llm_prompt || '',
            autoReply: Boolean(chatSettings.auto_reply),
            keywords: chatSettings.keywords ? chatSettings.keywords.split(',').map((k: string) => k.trim()) : [],
            notifications: Boolean(chatSettings.notifications)
          } : null,
          recentLogs: recentLogs.map((log: any) => ({
            messageId: log.message_id,
            message: log.original_message,
            prompt: log.llm_prompt,
            response: log.llm_response,
            success: Boolean(log.success),
            error: log.error_message,
            processingTime: log.processing_time_ms,
            timestamp: log.created_at
          })),
          statistics: stats ? {
            totalProcessed: stats.total_processed || 0,
            successful: stats.successful || 0,
            failed: stats.failed || 0,
            successRate: stats.total_processed ? ((stats.successful || 0) / stats.total_processed * 100).toFixed(1) : '0',
            avgProcessingTime: stats.avg_processing_time ? Math.round(stats.avg_processing_time) : 0,
            lastProcessed: stats.last_processed
          } : {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            successRate: '0',
            avgProcessingTime: 0,
            lastProcessed: null
          },
          serviceStatus
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('❌ Error getting LLM status:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get LLM status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
