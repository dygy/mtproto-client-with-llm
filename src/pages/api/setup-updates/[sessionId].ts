// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/session-store.js';
import { setupUpdateHandlers } from '../../../lib/update-manager.js';

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

    console.log(`\n🔧 MANUAL UPDATE HANDLER SETUP REQUESTED`);
    console.log(`📱 Session: ${sessionId}`);
    console.log(`👤 User: ${sessionData.userInfo?.firstName || 'Unknown'}`);

    // Setup update handlers
    try {
      await setupUpdateHandlers(sessionId);
      
      console.log(`✅ Update handlers manually setup for session ${sessionId}`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Update handlers setup successfully',
        sessionId,
        userInfo: sessionData.userInfo
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
    } catch (setupError) {
      console.error(`❌ Error setting up update handlers:`, setupError);
      
      return new Response(JSON.stringify({
        success: false,
        message: `Failed to setup update handlers: ${setupError instanceof Error ? setupError.message : 'Unknown error'}`,
        sessionId
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('❌ Error in setup-updates endpoint:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
