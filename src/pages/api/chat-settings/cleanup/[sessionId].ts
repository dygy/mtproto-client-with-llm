// @ts-nocheck
import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'sessions.db');

export const POST: APIRoute = async ({ params }) => {
  const { sessionId } = params;
  
  if (!sessionId) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Session ID required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const db = new Database(dbPath);
    
    console.log(`🧹 Cleaning up duplicate chat settings for session ${sessionId}`);
    
    // Find duplicate settings (same session_id and chat_id)
    const duplicates = db.prepare(`
      SELECT session_id, chat_id, COUNT(*) as count
      FROM chat_settings
      WHERE session_id = ?
      GROUP BY session_id, chat_id
      HAVING COUNT(*) > 1
    `).all(sessionId) as Array<{
      session_id: string;
      chat_id: string;
      count: number;
    }>;

    console.log(`🔍 Found ${duplicates.length} chats with duplicate settings`);

    let cleanedCount = 0;

    for (const duplicate of duplicates) {
      // Keep only the most recent setting for each chat
      const result = db.prepare(`
        DELETE FROM chat_settings
        WHERE session_id = ? AND chat_id = ? AND id NOT IN (
          SELECT id FROM chat_settings
          WHERE session_id = ? AND chat_id = ?
          ORDER BY updated_at DESC
          LIMIT 1
        )
      `).run(duplicate.session_id, duplicate.chat_id, duplicate.session_id, duplicate.chat_id);

      cleanedCount += result.changes;
      console.log(`🧹 Cleaned ${result.changes} duplicate settings for chat ${duplicate.chat_id}`);
    }
    
    db.close();
    
    return new Response(JSON.stringify({
      success: true,
      message: `Cleaned up ${cleanedCount} duplicate settings`,
      data: {
        duplicateChats: duplicates.length,
        cleanedSettings: cleanedCount
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error cleaning up chat settings:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to cleanup settings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
