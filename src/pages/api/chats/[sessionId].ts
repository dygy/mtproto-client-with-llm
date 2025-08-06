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

    // For demo purposes, return mock data if not authenticated OR if no real client
    if (!sessionData.isAuthenticated || !sessionData.client) {
      console.log(`📋 Returning mock chat data for demo session ${sessionId}`);

      const mockChats = [
        {
          id: 1,
          title: "John Doe",
          type: "private",
          unreadCount: 2,
          lastMessage: {
            id: 101,
            text: "Hey, how are you doing?",
            date: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
            fromId: 1,
            fromName: "John Doe"
          },
          info: {
            firstName: "John",
            lastName: "Doe",
            username: "johndoe",
            isBot: false
          },
          isArchived: false,
          isPinned: false
        },
        {
          id: 2,
          title: "Work Group",
          type: "group",
          unreadCount: 5,
          lastMessage: {
            id: 201,
            text: "Meeting at 3 PM today",
            date: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
            fromId: 2,
            fromName: "Alice Smith"
          },
          info: {
            title: "Work Group",
            participantsCount: 15
          },
          isArchived: false,
          isPinned: true
        },
        {
          id: 3,
          title: "Tech News",
          type: "channel",
          unreadCount: 0,
          lastMessage: {
            id: 301,
            text: "New JavaScript framework released!",
            date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
            fromId: 3,
            fromName: "Tech News"
          },
          info: {
            title: "Tech News",
            username: "technews",
            participantsCount: 1250,
            isMegagroup: false,
            isBroadcast: true
          },
          isArchived: false,
          isPinned: false
        },
        {
          id: 4,
          title: "Bot Assistant",
          type: "bot",
          unreadCount: 0,
          lastMessage: {
            id: 401,
            text: "How can I help you today?",
            date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
            fromId: 4,
            fromName: "Bot Assistant"
          },
          info: {
            firstName: "Bot",
            lastName: "Assistant",
            username: "botassistant",
            isBot: true
          },
          isArchived: false,
          isPinned: false
        }
      ];

      return new Response(JSON.stringify({
        success: true,
        chats: mockChats
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Ensure client is connected (only for real authenticated sessions)
    if (sessionData.isAuthenticated && sessionData.client) {
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
    }

    const { client } = sessionData;

    try {
      const dialogs = await client.getDialogs({ limit });
      
      const chats = await Promise.all(dialogs.map(async (dialog: any) => {
        // Get the last message for preview
        let lastMessage = null;
        try {
          const messages = await client.getMessages(dialog.entity, { limit: 1 });
          if (messages.length > 0) {
            const msg = messages[0];
            lastMessage = {
              id: msg.id,
              text: msg.message || '[Media]',
              date: new Date(msg.date * 1000).toISOString(),
              fromId: msg.fromId?.userId?.toJSNumber(),
              fromName: msg.fromId ? await getFromName(client, msg.fromId) : undefined
            };
          }
        } catch (error) {
          console.error('Error getting last message for dialog:', error);
        }

        // Determine chat type and info
        const entity = dialog.entity;
        let chatType = 'unknown';
        let chatInfo: any = {};

        if (entity.className === 'User') {
          chatType = entity.bot ? 'bot' : 'private';
          chatInfo = {
            firstName: entity.firstName,
            lastName: entity.lastName,
            username: entity.username,
            phone: entity.phone,
            isBot: entity.bot
          };
        } else if (entity.className === 'Chat') {
          chatType = 'group';
          chatInfo = {
            title: entity.title,
            participantsCount: entity.participantsCount
          };
        } else if (entity.className === 'Channel') {
          chatType = entity.megagroup ? 'supergroup' : 'channel';
          chatInfo = {
            title: entity.title,
            username: entity.username,
            participantsCount: entity.participantsCount,
            isMegagroup: entity.megagroup,
            isBroadcast: entity.broadcast
          };
        }

        return {
          id: entity.id?.toJSNumber() || 0,
          title: dialog.title,
          type: chatType,
          unreadCount: dialog.unreadCount || 0,
          lastMessage,
          info: chatInfo,
          isArchived: dialog.archived || false,
          isPinned: dialog.pinned || false
        };
      }));

      return new Response(JSON.stringify({
        success: true,
        chats: chats.sort((a, b) => {
          // Sort by pinned first, then by last message date
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          
          const aDate = a.lastMessage ? new Date(a.lastMessage.date).getTime() : 0;
          const bDate = b.lastMessage ? new Date(b.lastMessage.date).getTime() : 0;
          return bDate - aDate;
        })
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error('Error getting chats:', error);

      // Handle Telegram authentication errors
      const { handleTelegramError, broadcastAuthError } = await import('../../../lib/telegram-error-handler.js');
      const errorResponse = await handleTelegramError(error, sessionId);

      if (errorResponse.shouldLogout) {
        console.log(`🚪 Chats API: Session ${sessionId} requires logout due to: ${errorResponse.errorCode}`);

        // Broadcast auth error to frontend
        broadcastAuthError(sessionId, errorResponse);

        return new Response(JSON.stringify({
          success: false,
          shouldLogout: true,
          message: errorResponse.message,
          errorCode: errorResponse.errorCode
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      return new Response(JSON.stringify({
        success: false,
        shouldLogout: false,
        message: errorResponse.message,
        errorCode: errorResponse.errorCode
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('Error in chats endpoint:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get chats'
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
