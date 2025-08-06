// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../../lib/session-store.js';
import { broadcastToSession } from '../../../lib/update-manager.js';

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

  const sessionData = await getSession(sessionId);
  if (!sessionData || !sessionData.isAuthenticated) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Session not found or not authenticated'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  console.log(`🧪 Testing updates for session ${sessionId}`);

  // Ensure client is connected
  const isConnected = await ensureClientConnected(sessionId);
  if (!isConnected) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to connect Telegram client'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { client } = sessionData;
    
    // Try to get some basic info to test the connection
    const me = await client.getMe();
    console.log(`👤 Current user:`, {
      id: me.id,
      firstName: me.firstName,
      username: me.username
    });

    // Try to get recent dialogs to see if we can fetch data
    const dialogs = await client.getDialogs({ limit: 5 });

    dialogs.forEach((dialog: any, index: number) => {
      console.log(`  ${index + 1}. ${dialog.title} (ID: ${dialog.id})`);
    });

    // Send a test update to the frontend
    broadcastToSession(sessionId, {
      type: 'test',
      data: {
        message: 'Test update from server',
        userInfo: {
          id: me.id,
          firstName: me.firstName,
          username: me.username
        },
        dialogsCount: dialogs.length
      },
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Test completed',
      data: {
        connected: client.connected,
        userId: me.id,
        dialogsCount: dialogs.length,
        testUpdateSent: true
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ Error testing updates:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Test failed',
      error: error
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
