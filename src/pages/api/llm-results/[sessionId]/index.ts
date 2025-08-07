// @ts-nocheck
import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'sessions.db');

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { sessionId } = params;
    const searchParams = new URL(url).searchParams;
    
    if (!sessionId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Query parameters
    const chatId = searchParams.get('chatId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const provider = searchParams.get('provider');
    const model = searchParams.get('model');
    const since = searchParams.get('since'); // ISO date string
    const includePrompt = searchParams.get('includePrompt') === 'true';

    // Validate parameters
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
      // Build query to get LLM results for the session
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
        INNER JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
        WHERE cs.session_id = ?
      `;

      const params: any[] = [sessionId];

      // Add additional filters
      if (chatId) {
        query += ` AND lr.chat_id = ?`;
        params.push(parseInt(chatId));
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

      query += ` ORDER BY lr.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      console.log('🔍 Session LLM Results Query:', query);
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

      // Format results
      const formattedResults = results.map(result => {
        const formattedResult: any = {
          id: result.id,
          messageId: result.message_id,
          chatId: result.chat_id,
          chatTitle: result.chat_title,
          provider: result.llm_provider,
          model: result.llm_model,
          response: result.llm_response,
          processingTime: result.processing_time_ms,
          createdAt: result.created_at,
          userId: result.user_id
        };

        if (includePrompt && result.prompt_used) {
          formattedResult.prompt = result.prompt_used;
        }

        return formattedResult;
      });

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM llm_results lr
        INNER JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
        WHERE cs.session_id = ?
      `;

      const countParams = [sessionId];
      let countParamIndex = 1;

      if (chatId) {
        countQuery += ` AND lr.chat_id = ?`;
        countParams.push(parseInt(chatId));
      }

      if (provider) {
        countQuery += ` AND lr.llm_provider = ?`;
        countParams.push(provider);
      }

      if (model) {
        countQuery += ` AND lr.llm_model = ?`;
        countParams.push(model);
      }

      if (since) {
        countQuery += ` AND lr.created_at >= ?`;
        countParams.push(since);
      }

      const totalCount = db.prepare(countQuery).get(...countParams) as { total: number };

      // Get session statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_results,
          COUNT(DISTINCT lr.chat_id) as unique_chats,
          COUNT(DISTINCT lr.llm_provider) as unique_providers,
          AVG(lr.processing_time_ms) as avg_processing_time,
          MIN(lr.created_at) as oldest_result,
          MAX(lr.created_at) as newest_result
        FROM llm_results lr
        INNER JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
        WHERE cs.session_id = ?
      `;

      const stats = db.prepare(statsQuery).get(sessionId) as {
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
          sessionId,
          results: formattedResults,
          pagination: {
            limit,
            offset,
            count: formattedResults.length,
            total: totalCount.total,
            hasMore: offset + formattedResults.length < totalCount.total
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
            chatId,
            provider,
            model,
            since,
            includePrompt
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
    console.error('❌ Error fetching session LLM results:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch session LLM results',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
