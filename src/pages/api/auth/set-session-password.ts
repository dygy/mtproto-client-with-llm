// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/session-store.js';
import { setSessionPassword } from '../../../lib/session-password.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { sessionId, sessionPassword } = await request.json();

    if (!sessionId || !sessionPassword) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID and password are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Get session data to verify it exists and is authenticated
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

    if (!sessionData.isAuthenticated) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not authenticated yet'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Set session password
    console.log(`🔒 Setting password for session ${sessionId}`);
    await setSessionPassword(sessionId, sessionPassword);

    return new Response(JSON.stringify({
      success: true,
      sessionId,
      userInfo: sessionData.userInfo,
      message: 'Session password set successfully'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error setting session password:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to set session password'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

