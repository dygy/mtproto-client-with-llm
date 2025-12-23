// @ts-nocheck
import type { APIRoute } from 'astro';
import { StorageAdapter } from '../../lib/storage-adapter.js';

export const GET: APIRoute = async () => {
  try {
    console.log('📋 Listing all available sessions from Blob storage...');

    try {
      // Get all authenticated sessions
      const records = await StorageAdapter.listSessions();

      // Filter and format the response
      const availableSessions = records
        .map(record => {
          try {
            // Only return sessions with user info
            if (record.user_id) {
              return {
                sessionId: record.id,
                phoneNumber: record.phone_number,
                userInfo: {
                  id: record.user_id
                },
                lastActive: record.updated_at,
                createdAt: record.created_at
              };
            }
            return null;
          } catch (error) {
            console.error(`❌ Error processing session ${record.id}:`, error);
            return null;
          }
        })
        .filter(session => session !== null);

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

    } catch (storageError) {
      throw storageError;
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
