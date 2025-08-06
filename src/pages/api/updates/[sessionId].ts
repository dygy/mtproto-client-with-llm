// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/session-store.js';
import { addSSEClient, removeSSEClient } from '../../../lib/update-manager.js';

export const GET: APIRoute = async ({ params, request }) => {
  const { sessionId } = params;
  
  if (!sessionId) {
    return new Response('Session ID required', { status: 400 });
  }

  // Verify session exists and is authenticated
  const sessionData = await getSession(sessionId);
  if (!sessionData || !sessionData.isAuthenticated) {
    return new Response('Session not found or not authenticated', { status: 404 });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      let heartbeatInterval: NodeJS.Timeout | null = null;
      let isControllerClosed = false;

      // Add client to update manager
      addSSEClient(sessionId, controller);

      // Send initial connection message
      try {
        const initialMessage = `data: ${JSON.stringify({
          type: 'connected',
          data: { sessionId, timestamp: new Date().toISOString() }
        })}\n\n`;

        controller.enqueue(new TextEncoder().encode(initialMessage));
      } catch (error) {
        console.error('Failed to send initial message:', error);
        isControllerClosed = true;
      }

      // Send periodic heartbeat
      heartbeatInterval = setInterval(() => {
        // Check if controller is still open
        if (isControllerClosed) {
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
          return;
        }

        try {
          // Check if controller is still valid before sending heartbeat
          if (!isControllerClosed) {
            const heartbeat = `data: ${JSON.stringify({
              type: 'heartbeat',
              data: { timestamp: new Date().toISOString() }
            })}\n\n`;

            controller.enqueue(new TextEncoder().encode(heartbeat));
          }
        } catch (error) {
          isControllerClosed = true;
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
        }
      }, 30000); // Every 30 seconds

      // Handle client disconnect
      request.signal?.addEventListener('abort', () => {
        isControllerClosed = true;

        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        removeSSEClient(sessionId, controller);

        try {
          controller.close();
        } catch (error) {
          // Controller might already be closed
        }
      });
    },

    cancel(controller) {
      removeSSEClient(sessionId, controller);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
};
