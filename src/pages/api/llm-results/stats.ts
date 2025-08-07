// @ts-nocheck
import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'sessions.db');

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    
    // Query parameters
    const sessionId = searchParams.get('sessionId');
    const chatId = searchParams.get('chatId');
    const timeframe = searchParams.get('timeframe') || '24h'; // 1h, 24h, 7d, 30d, all
    const groupBy = searchParams.get('groupBy') || 'provider'; // provider, model, chat, hour, day

    const db = new Database(dbPath);
    
    try {
      // Calculate time filter based on timeframe
      let timeFilter = '';
      let timeParams: any[] = [];
      
      if (timeframe !== 'all') {
        const now = new Date();
        let startTime: Date;
        
        switch (timeframe) {
          case '1h':
            startTime = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case '24h':
            startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }
        
        timeFilter = 'AND lr.created_at >= ?';
        timeParams.push(startTime.toISOString());
      }

      // Base query conditions
      let baseConditions = 'WHERE 1=1';
      let baseParams: any[] = [];

      if (sessionId) {
        baseConditions += ' AND cs.session_id = ?';
        baseParams.push(sessionId);
      }

      if (chatId) {
        baseConditions += ' AND lr.chat_id = ?';
        baseParams.push(parseInt(chatId));
      }

      // Overall statistics
      const overallStatsQuery = `
        SELECT 
          COUNT(*) as total_results,
          COUNT(DISTINCT lr.chat_id) as unique_chats,
          COUNT(DISTINCT lr.user_id) as unique_users,
          COUNT(DISTINCT lr.llm_provider) as unique_providers,
          COUNT(DISTINCT lr.llm_model) as unique_models,
          AVG(lr.processing_time_ms) as avg_processing_time,
          MIN(lr.processing_time_ms) as min_processing_time,
          MAX(lr.processing_time_ms) as max_processing_time,
          SUM(lr.processing_time_ms) as total_processing_time,
          MIN(lr.created_at) as oldest_result,
          MAX(lr.created_at) as newest_result
        FROM llm_results lr
        LEFT JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
        ${baseConditions} ${timeFilter}
      `;

      const overallStats = db.prepare(overallStatsQuery).get(...baseParams, ...timeParams) as {
        total_results: number;
        unique_chats: number;
        unique_users: number;
        unique_providers: number;
        unique_models: number;
        avg_processing_time: number;
        min_processing_time: number;
        max_processing_time: number;
        total_processing_time: number;
        oldest_result: string;
        newest_result: string;
      };

      // Group by statistics
      let groupByQuery = '';
      let groupByData: any[] = [];

      switch (groupBy) {
        case 'provider':
          groupByQuery = `
            SELECT 
              lr.llm_provider as group_key,
              lr.llm_provider as provider,
              COUNT(*) as count,
              AVG(lr.processing_time_ms) as avg_processing_time,
              MIN(lr.created_at) as first_used,
              MAX(lr.created_at) as last_used
            FROM llm_results lr
            LEFT JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
            ${baseConditions} ${timeFilter}
            GROUP BY lr.llm_provider
            ORDER BY count DESC
          `;
          break;

        case 'model':
          groupByQuery = `
            SELECT 
              lr.llm_model as group_key,
              lr.llm_provider as provider,
              lr.llm_model as model,
              COUNT(*) as count,
              AVG(lr.processing_time_ms) as avg_processing_time,
              MIN(lr.created_at) as first_used,
              MAX(lr.created_at) as last_used
            FROM llm_results lr
            LEFT JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
            ${baseConditions} ${timeFilter}
            GROUP BY lr.llm_provider, lr.llm_model
            ORDER BY count DESC
          `;
          break;

        case 'chat':
          groupByQuery = `
            SELECT 
              CAST(lr.chat_id AS TEXT) as group_key,
              lr.chat_id,
              'Chat ' || lr.chat_id as chat_title,
              COUNT(*) as count,
              COUNT(DISTINCT lr.llm_provider) as unique_providers,
              AVG(lr.processing_time_ms) as avg_processing_time,
              MIN(lr.created_at) as first_used,
              MAX(lr.created_at) as last_used
            FROM llm_results lr
            LEFT JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
            ${baseConditions} ${timeFilter}
            GROUP BY lr.chat_id
            ORDER BY count DESC
          `;
          break;

        case 'hour':
          groupByQuery = `
            SELECT 
              strftime('%Y-%m-%d %H:00', lr.created_at) as group_key,
              strftime('%Y-%m-%d %H:00', lr.created_at) as hour,
              COUNT(*) as count,
              COUNT(DISTINCT lr.chat_id) as unique_chats,
              AVG(lr.processing_time_ms) as avg_processing_time
            FROM llm_results lr
            LEFT JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
            ${baseConditions} ${timeFilter}
            GROUP BY strftime('%Y-%m-%d %H:00', lr.created_at)
            ORDER BY hour DESC
            LIMIT 24
          `;
          break;

        case 'day':
          groupByQuery = `
            SELECT 
              strftime('%Y-%m-%d', lr.created_at) as group_key,
              strftime('%Y-%m-%d', lr.created_at) as day,
              COUNT(*) as count,
              COUNT(DISTINCT lr.chat_id) as unique_chats,
              COUNT(DISTINCT lr.llm_provider) as unique_providers,
              AVG(lr.processing_time_ms) as avg_processing_time
            FROM llm_results lr
            LEFT JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
            ${baseConditions} ${timeFilter}
            GROUP BY strftime('%Y-%m-%d', lr.created_at)
            ORDER BY day DESC
            LIMIT 30
          `;
          break;
      }

      if (groupByQuery) {
        groupByData = db.prepare(groupByQuery).all(...baseParams, ...timeParams);
      }

      // Top performing models by speed
      const topModelsQuery = `
        SELECT 
          lr.llm_provider as provider,
          lr.llm_model as model,
          COUNT(*) as usage_count,
          AVG(lr.processing_time_ms) as avg_processing_time,
          MIN(lr.processing_time_ms) as min_processing_time,
          MAX(lr.processing_time_ms) as max_processing_time
        FROM llm_results lr
        LEFT JOIN chat_settings cs ON cs.chat_id = CAST(lr.chat_id AS TEXT)
        ${baseConditions} ${timeFilter}
        GROUP BY lr.llm_provider, lr.llm_model
        HAVING COUNT(*) >= 3
        ORDER BY avg_processing_time ASC
        LIMIT 10
      `;

      const topModels = db.prepare(topModelsQuery).all(...baseParams, ...timeParams);

      return new Response(JSON.stringify({
        success: true,
        data: {
          timeframe,
          groupBy,
          overall: {
            totalResults: overallStats.total_results,
            uniqueChats: overallStats.unique_chats,
            uniqueUsers: overallStats.unique_users,
            uniqueProviders: overallStats.unique_providers,
            uniqueModels: overallStats.unique_models,
            averageProcessingTime: Math.round(overallStats.avg_processing_time || 0),
            minProcessingTime: overallStats.min_processing_time,
            maxProcessingTime: overallStats.max_processing_time,
            totalProcessingTime: overallStats.total_processing_time,
            oldestResult: overallStats.oldest_result,
            newestResult: overallStats.newest_result
          },
          groupedData: groupByData,
          topModels: topModels.map(model => ({
            provider: model.provider,
            model: model.model,
            usageCount: model.usage_count,
            averageProcessingTime: Math.round(model.avg_processing_time),
            minProcessingTime: model.min_processing_time,
            maxProcessingTime: model.max_processing_time
          })),
          filters: {
            sessionId,
            chatId,
            timeframe,
            groupBy
          }
        },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        }
      });

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('❌ Error fetching LLM statistics:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch LLM statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
