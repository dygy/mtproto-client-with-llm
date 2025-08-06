// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, deleteSession } from '../../lib/session-store.js';
import { cleanupSession } from '../../lib/update-manager.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.formData();
    const sessionId = data.get('sessionId') as string;

    if (!sessionId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`🚪 Logging out session: ${sessionId}`);

    // Get session data to disconnect client if needed
    const sessionData = await getSession(sessionId);
    if (sessionData && sessionData.client) {
      try {
        console.log(`🔌 Disconnecting Telegram client for session: ${sessionId}`);
        await sessionData.client.disconnect();
      } catch (error) {
        console.error('❌ Error disconnecting client:', error);
      }
    }

    // Remove session from memory and database
    const success = await deleteSession(sessionId);

    // Cleanup update handlers and SSE connections
    cleanupSession(sessionId);

    if (success) {
      console.log(`✅ Session ${sessionId} logged out successfully`);
      
      // Redirect to home page
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/'
        }
      });
    } else {
      console.log(`❌ Failed to logout session ${sessionId}`);
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to logout session'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Error during logout:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error during logout'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  // Handle GET requests by redirecting to POST with session from query params
  const sessionId = url.searchParams.get('session');
  
  if (!sessionId) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/?error=missing-session'
      }
    });
  }

  console.log(`🚪 GET logout request for session: ${sessionId}`);

  // Get session data to disconnect client if needed
  const sessionData = await getSession(sessionId);
  if (sessionData && sessionData.client) {
    try {
      console.log(`🔌 Disconnecting Telegram client for session: ${sessionId}`);
      await sessionData.client.disconnect();
    } catch (error) {
      console.error('❌ Error disconnecting client:', error);
    }
  }

  // Remove session from memory and database
  const success = await deleteSession(sessionId);

  // Cleanup update handlers and SSE connections
  cleanupSession(sessionId);

  if (success) {
    console.log(`✅ Session ${sessionId} logged out successfully via GET`);
  } else {
    console.log(`❌ Failed to logout session ${sessionId} via GET`);
  }

  // Always redirect to home page
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/'
    }
  });
};
