// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../lib/session-store.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const sessionId = formData.get('sessionId') as string;

    if (!sessionId) {
      return new Response('Session ID is required', { status: 400 });
    }

    console.log(`\n🔄 RESTORING SESSION: ${sessionId}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

    // Check session health directly
    try {
      const sessionData = await getSession(sessionId);

      if (!sessionData) {
        console.error(`❌ Session ${sessionId} not found in store`);
        return new Response(JSON.stringify({
          success: false,
          message: 'Session not found',
          redirect: '/'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!sessionData.isAuthenticated) {
        console.error(`❌ Session ${sessionId} exists but is not authenticated`);
        console.log(`📋 Session data: user=${sessionData.userInfo?.firstName || 'None'}, phone=${sessionData.userInfo?.phone || 'None'}`);
        return new Response(JSON.stringify({
          success: false,
          message: 'Session is not authenticated',
          redirect: '/'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ Session ${sessionId} found and authenticated`);
      console.log(`👤 User: ${sessionData.userInfo?.firstName || 'Unknown'} (${sessionData.userInfo?.phone || 'Unknown'})`);

      // Ensure client is connected
      console.log(`🔌 Checking client connection...`);
      const isConnected = await ensureClientConnected(sessionId);

      if (!isConnected) {
        console.error(`❌ Failed to connect session client for ${sessionId}`);
        return new Response(JSON.stringify({
          success: false,
          message: 'Failed to connect to Telegram. Please try logging in again.',
          redirect: '/'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ Session ${sessionId} is healthy, redirecting to chat`);
      console.log(`🎯 Redirect URL: /chat?session=${sessionId}`);

      // Create a response that redirects
      const response = new Response(null, {
        status: 302,
        headers: {
          'Location': `/chat?session=${sessionId}`
        }
      });

      return response;
    } catch (sessionError) {
      console.error('❌ Session health check failed:', sessionError);
      return new Response('Session validation failed', { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Error restoring session:', error);
    return new Response('Failed to restore session', { status: 500 });
  }
};
