// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/session-store.js';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { sessionId } = params;
    
    if (!sessionId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    console.log(`🔍 Checking status for session: ${sessionId}`);

    const sessionData = await getSession(sessionId);
    
    if (!sessionData) {
      console.log(`❌ Session ${sessionId} not found`);
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not found',
        status: 'not_found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const status = {
      sessionId,
      exists: true,
      isAuthenticated: sessionData.isAuthenticated,
      hasClient: !!sessionData.client,
      clientConnected: sessionData.client?.connected || false,
      userInfo: sessionData.userInfo ? {
        firstName: sessionData.userInfo.firstName,
        lastName: sessionData.userInfo.lastName,
        username: sessionData.userInfo.username,
        phone: sessionData.userInfo.phone
      } : null,
      timestamp: new Date().toISOString()
    };

    console.log(`📊 Session ${sessionId} status:`, {
      authenticated: status.isAuthenticated,
      hasClient: status.hasClient,
      connected: status.clientConnected,
      user: status.userInfo?.firstName || 'Unknown'
    });

    return new Response(JSON.stringify({
      success: true,
      data: status
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Session status check error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
