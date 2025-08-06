// @ts-nocheck
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  try {
    console.log('📋 Listing all available sessions from database...');

    // We need to create a new method to get full session data
    // For now, let's use a direct database query
    const Database = (await import('better-sqlite3')).default;
    const path = (await import('path')).default;

    const DB_PATH = path.join(process.cwd(), 'data', 'sessions.db');
    const db = new Database(DB_PATH);

    try {
      // Get all authenticated sessions with full data
      const records = db.prepare(`
        SELECT id, data, created_at, updated_at, phone_number
        FROM sessions
        WHERE is_authenticated = TRUE
        ORDER BY updated_at DESC
      `).all() as any[];

      // Filter and format the response
      const availableSessions = records
        .map(record => {
          try {
            const sessionData = JSON.parse(record.data);

            // Only return sessions with user info
            if (sessionData.userInfo) {
              return {
                sessionId: record.id,
                phoneNumber: record.phone_number || sessionData.phoneNumber,
                userInfo: sessionData.userInfo,
                lastActive: record.updated_at,
                createdAt: record.created_at
              };
            }
            return null;
          } catch (error) {
            console.error(`❌ Error parsing session data for ${record.id}:`, error);
            return null;
          }
        })
        .filter(session => session !== null);

      db.close();

      console.log(`✅ Found ${availableSessions.length} authenticated sessions`);

      return new Response(JSON.stringify({
        success: true,
        sessions: availableSessions,
        count: availableSessions.length
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (dbError) {
      db.close();
      throw dbError;
    }

  } catch (error) {
    console.error('❌ Error listing sessions:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to list sessions',
      sessions: [],
      count: 0
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
