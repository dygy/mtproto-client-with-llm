// @ts-nocheck
import type { APIRoute } from 'astro';
import { LLMResultsStore } from '../../../lib/database.js';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'sessions.db');

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    
    // Query parameters
    const sessionId = searchParams.get('sessionId');
    const chatId = searchParams.get('chatId');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10');
    const provider = searchParams.get('provider');
    const model = searchParams.get('model');
    const since = searchParams.get('since'); // ISO date string
    const includePrompt = searchParams.get('includePrompt') === 'true';
    const format = searchParams.get('format') || 'detailed'; // 'detailed' or 'summary'

    // Validate limit
    if (limit < 1 || limit > 100) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Limit must be between 1 and 100'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = new Database(dbPath);
    
    try {
      let query = `
        SELECT 
          lr.id,
          lr.user_id,
          lr.message_id,
          lr.chat_id,
          lr.llm_provider,
          lr.llm_model,
          lr.llm_response,
          lr.processing_time_ms,
          lr.created_at,
          ${includePrompt ? 'lr.prompt_used,' : ''}
          cs.session_id,
          -- Use fallback chat title since we don't have chat_title in llm_processing_log
          'Chat ' || lr.chat_id as chat_title
        FROM llm_results lr
        LEFT JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
        WHERE 1=1
      `;

      const params: any[] = [];

      // Add filters
      if (sessionId) {
        query += ` AND cs.session_id = ?`;
        params.push(sessionId);
      }

      if (chatId) {
        query += ` AND lr.chat_id = ?`;
        params.push(parseInt(chatId));
      }

      if (userId) {
        query += ` AND lr.user_id = ?`;
        params.push(parseInt(userId));
      }

      if (provider) {
        query += ` AND lr.llm_provider = ?`;
        params.push(provider);
      }

      if (model) {
        query += ` AND lr.llm_model = ?`;
        params.push(model);
      }

      if (since) {
        query += ` AND lr.created_at >= ?`;
        params.push(since);
      }

      query += ` ORDER BY lr.created_at DESC LIMIT ?`;
      params.push(limit);

      console.log('🔍 LLM Results Query:', query);
      console.log('🔍 Query Params:', params);

      const results = db.prepare(query).all(...params) as Array<{
        id: number;
        user_id: number;
        message_id: number;
        chat_id: number;
        llm_provider: string;
        llm_model: string;
        llm_response: string;
        processing_time_ms: number;
        created_at: string;
        prompt_used?: string;
        session_id: string;
        chat_title: string;
      }>;

      // Format results based on requested format
      const formattedResults = results.map(result => {
        const baseResult = {
          id: result.id,
          messageId: result.message_id,
          chatId: result.chat_id,
          chatTitle: result.chat_title,
          sessionId: result.session_id,
          provider: result.llm_provider,
          model: result.llm_model,
          response: result.llm_response,
          processingTime: result.processing_time_ms,
          createdAt: result.created_at,
          userId: result.user_id
        };

        if (format === 'summary') {
          return {
            id: result.id,
            messageId: result.message_id,
            chatId: result.chat_id,
            chatTitle: result.chat_title,
            provider: result.llm_provider,
            model: result.llm_model,
            responsePreview: result.llm_response?.substring(0, 100) + (result.llm_response?.length > 100 ? '...' : ''),
            createdAt: result.created_at
          };
        }

        if (includePrompt && result.prompt_used) {
          baseResult.prompt = result.prompt_used;
        }

        return baseResult;
      });

      // Get statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_results,
          COUNT(DISTINCT lr.chat_id) as unique_chats,
          COUNT(DISTINCT lr.llm_provider) as unique_providers,
          AVG(lr.processing_time_ms) as avg_processing_time,
          MIN(lr.created_at) as oldest_result,
          MAX(lr.created_at) as newest_result
        FROM llm_results lr
        LEFT JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
        WHERE 1=1
        ${sessionId ? 'AND cs.session_id = ?' : ''}
        ${chatId ? 'AND lr.chat_id = ?' : ''}
        ${userId ? 'AND lr.user_id = ?' : ''}
        ${provider ? 'AND lr.llm_provider = ?' : ''}
        ${model ? 'AND lr.llm_model = ?' : ''}
        ${since ? 'AND lr.created_at >= ?' : ''}
      `;

      const statsParams = params.slice(0, -1); // Remove limit parameter
      const stats = db.prepare(statsQuery).get(...statsParams) as {
        total_results: number;
        unique_chats: number;
        unique_providers: number;
        avg_processing_time: number;
        oldest_result: string;
        newest_result: string;
      };

      return new Response(JSON.stringify({
        success: true,
        data: {
          results: formattedResults,
          pagination: {
            limit,
            count: formattedResults.length,
            hasMore: formattedResults.length === limit
          },
          statistics: {
            totalResults: stats.total_results,
            uniqueChats: stats.unique_chats,
            uniqueProviders: stats.unique_providers,
            averageProcessingTime: Math.round(stats.avg_processing_time || 0),
            oldestResult: stats.oldest_result,
            newestResult: stats.newest_result
          },
          filters: {
            sessionId,
            chatId,
            userId,
            provider,
            model,
            since,
            includePrompt,
            format
          }
        },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('❌ Error fetching latest LLM results:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch LLM results',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
