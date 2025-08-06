// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../../../../lib/session-store.js';

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const { sessionId, chatId, messageId } = params;
    
    if (!sessionId || !chatId || !messageId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID, Chat ID, and Message ID are required'
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

    // For demo purposes, return mock success if not authenticated
    if (!sessionData.isAuthenticated || !sessionData.client) {
      console.log(`🗑️ Mock deleting message ${messageId} from chat ${chatId}`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Message deleted successfully (mock)'
      }), {
        status: 200,
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

    try {
      // Get the chat entity
      const dialogs = await client.getDialogs({ limit: 100 });
      const targetDialog = dialogs.find((dialog: any) =>
        dialog.entity.id?.toJSNumber()?.toString() === chatId
      );

      if (!targetDialog) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Chat not found'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Delete the message
      await client.deleteMessages(targetDialog.entity, [parseInt(messageId)], { revoke: true });

      console.log(`✅ Message ${messageId} deleted from chat ${targetDialog.title}`);

      return new Response(JSON.stringify({
        success: true,
        message: 'Message deleted successfully'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error(`❌ Error deleting message ${messageId} from chat ${chatId}:`, error);
      return new Response(JSON.stringify({
        success: false,
        message: `Failed to delete message: ${error instanceof Error ? error.message : 'Unknown error'}`
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('❌ Error in delete message API:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { sessionId, chatId, messageId } = params;
    
    if (!sessionId || !chatId || !messageId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID, Chat ID, and Message ID are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const body = await request.json();
    const { text } = body;

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Message text is required'
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

    // For demo purposes, return mock success if not authenticated
    if (!sessionData.isAuthenticated || !sessionData.client) {
      console.log(`✏️ Mock editing message ${messageId} in chat ${chatId}: "${text}"`);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Message edited successfully (mock)'
      }), {
        status: 200,
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

    try {
      // Get the chat entity
      const dialogs = await client.getDialogs({ limit: 100 });
      const targetDialog = dialogs.find((dialog: any) =>
        dialog.entity.id?.toJSNumber()?.toString() === chatId
      );

      if (!targetDialog) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Chat not found'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Edit the message
      await client.editMessage(targetDialog.entity, {
        message: parseInt(messageId),
        text: text.trim()
      });

      console.log(`✅ Message ${messageId} edited in chat ${targetDialog.title}`);

      return new Response(JSON.stringify({
        success: true,
        message: 'Message edited successfully'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error(`❌ Error editing message ${messageId} in chat ${chatId}:`, error);
      return new Response(JSON.stringify({
        success: false,
        message: `Failed to edit message: ${error instanceof Error ? error.message : 'Unknown error'}`
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('❌ Error in edit message API:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
