// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../../lib/session-store.js';

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { sessionId } = params;
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
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
    if (!sessionData || !sessionData.isAuthenticated) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not found or not authenticated'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Ensure client is connected
    const isConnected = await ensureClientConnected(sessionId);
    if (!isConnected) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to connect Telegram client'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { client } = sessionData;
    const messages: any[] = [];

    try {
      const dialogs = await client.getDialogs({ limit: 10 });
      
      for (const dialog of dialogs) {
        const chatMessages = await client.getMessages(dialog.entity, { limit: Math.min(limit, 10) });
        
        for (const message of chatMessages) {
          if (message.message) {
            messages.push({
              id: message.id,
              text: message.message,
              date: new Date(message.date * 1000).toISOString(),
              fromId: message.fromId?.userId?.toJSNumber(),
              chatId: dialog.entity.id?.toJSNumber() || 0,
              chatTitle: dialog.title,
              fromName: message.fromId ? await getFromName(client, message.fromId) : undefined
            });
          }
        }
      }

      const sortedMessages = messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);

      return new Response(JSON.stringify({
        success: true,
        messages: sortedMessages
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error('Error getting messages:', error);
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to get messages'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('Error in messages endpoint:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get messages'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

async function getFromName(client: any, fromId: any): Promise<string | undefined> {
  try {
    if (fromId?.userId) {
      const user = await client.getEntity(fromId.userId);
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
  } catch {
    // Ignore errors when getting user info
  }
  return undefined;
}
