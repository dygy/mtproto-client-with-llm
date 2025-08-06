// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../../../lib/session-store.js';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { sessionId } = params;
    
    if (!sessionId) {
      return new Response(JSON.stringify({
        success: false,
        healthy: false,
        message: 'Session ID is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    console.log(`🏥 Health check for session ${sessionId}`);

    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      console.log(`❌ Session ${sessionId} not found`);
      return new Response(JSON.stringify({
        success: false,
        healthy: false,
        message: 'Session not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!sessionData.isAuthenticated) {
      console.log(`❌ Session ${sessionId} not authenticated`);
      return new Response(JSON.stringify({
        success: false,
        healthy: false,
        message: 'Session not authenticated'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Check if this is a mock session (no real client)
    if (!sessionData.client) {
      console.log(`✅ Mock session ${sessionId} is healthy`);

      return new Response(JSON.stringify({
        success: true,
        healthy: true,
        message: 'Mock session is healthy',
        userInfo: sessionData.userInfo
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Try to ensure client is connected (only for real clients)
    const isConnected = await ensureClientConnected(sessionId);
    if (!isConnected) {
      console.log(`❌ Session ${sessionId} client connection failed`);
      return new Response(JSON.stringify({
        success: false,
        healthy: false,
        message: 'Client connection failed'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Try to make a simple API call to verify the session is working
    try {
      const { client } = sessionData;
      const me = await client.getMe();

      console.log(`✅ Session ${sessionId} is healthy - user: ${me.firstName}`);

      return new Response(JSON.stringify({
        success: true,
        healthy: true,
        message: 'Session is healthy',
        userInfo: {
          id: typeof me.id === 'bigint' ? Number(me.id) : me.id,
          firstName: me.firstName,
          lastName: me.lastName,
          username: me.username
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.log(`❌ Session ${sessionId} API call failed:`, error);

      // Handle Telegram authentication errors
      const { handleTelegramError, broadcastAuthError } = await import('../../../../lib/telegram-error-handler.js');
      const errorResponse = await handleTelegramError(error, sessionId);

      if (errorResponse.shouldLogout) {
        console.log(`🚪 Session ${sessionId} requires logout due to: ${errorResponse.errorCode}`);

        // Broadcast auth error to frontend
        broadcastAuthError(sessionId, errorResponse);

        return new Response(JSON.stringify({
          success: true,
          healthy: false,
          shouldLogout: true,
          message: errorResponse.message,
          errorCode: errorResponse.errorCode
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      return new Response(JSON.stringify({
        success: false,
        healthy: false,
        shouldLogout: false,
        message: errorResponse.message,
        errorCode: errorResponse.errorCode
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('Error in session health check:', error);
    
    return new Response(JSON.stringify({
      success: false,
      healthy: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
