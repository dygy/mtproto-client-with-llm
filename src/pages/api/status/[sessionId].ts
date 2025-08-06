// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/session-store.js';

export const GET: APIRoute = async ({ params }) => {
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
    if (!sessionData) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const status = {
      sessionId,
      isAuthenticated: sessionData.isAuthenticated,
      hasClient: !!sessionData.client,
      clientConnected: sessionData.client?.connected || false,
      hasUpdateHandler: !!sessionData.updateHandler,
      userInfo: sessionData.userInfo
    };

    return new Response(JSON.stringify({
      success: true,
      data: status
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting session status:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get session status'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
