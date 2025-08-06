// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, deleteSession } from '../../../lib/session-store.js';
import { cleanupSession } from '../../../lib/update-manager.js';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { sessionId } = params;
    
    if (!sessionId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const sessionInfo = {
      phoneNumber: sessionData.phoneNumber,
      userId: sessionData.userInfo?.id,
      firstName: sessionData.userInfo?.firstName,
      lastName: sessionData.userInfo?.lastName,
      username: sessionData.userInfo?.username,
      isActive: sessionData.isAuthenticated,
      createdAt: new Date().toISOString()
    };

    return new Response(JSON.stringify({
      success: true,
      sessionInfo
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error getting session info:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to get session info'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { sessionId } = params;
    
    if (!sessionId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const sessionData = await getSession(sessionId);
    if (sessionData && sessionData.client) {
      try {
        await sessionData.client.disconnect();
      } catch (error) {
        console.error('Error disconnecting client:', error);
      }
    }

    deleteSession(sessionId);

    // Cleanup update handlers and SSE connections
    cleanupSession(sessionId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Session deleted successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error deleting session:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to delete session'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
