// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../../../../lib/session-store.js';

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { sessionId, chatId } = params;
    
    if (!sessionId || !chatId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID and Chat ID are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const body = await request.json();
    const { maxId } = body;

    if (!maxId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'maxId is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    console.log(`📖 Marking messages as read in chat ${chatId} up to message ${maxId} for session ${sessionId}`);

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

    try {
      // Parse chat ID as number
      const numericChatId = parseInt(chatId);
      console.log(`📖 Attempting to mark messages as read for chat ID: ${numericChatId}`);

      // Try multiple methods to get the entity, similar to other endpoints
      let entity;
      try {
        entity = await client.getEntity(numericChatId);
        console.log(`📖 Found entity for chat ${numericChatId}:`, entity.className);
      } catch (error) {
        console.warn(`⚠️ Direct entity lookup failed for ${numericChatId}, trying alternatives:`, error);

        // Try alternative methods similar to avatar and messages endpoints
        try {
          entity = await client.getEntity(-Math.abs(numericChatId));
          console.log(`📖 Found entity with negative ID: ${entity.className}`);
        } catch (error2) {
          try {
            entity = await client.getEntity(-1000000000000 - Math.abs(numericChatId));
            console.log(`📖 Found entity with supergroup ID: ${entity.className}`);
          } catch (error3) {
            // Last resort: try to find in dialogs
            console.warn(`⚠️ Trying to find chat in dialogs...`);
            try {
              const dialogs = await client.getDialogs({ limit: 100 });
              const targetDialog = dialogs.find((dialog: any) =>
                dialog.entity.id?.toJSNumber()?.toString() === chatId
              );

              if (targetDialog) {
                entity = targetDialog.entity;
                console.log(`📖 Found entity in dialogs: ${entity.className}`);
              } else {
                throw new Error(`Chat ${numericChatId} not found in dialogs`);
              }
            } catch (error4) {
              console.error(`❌ All entity resolution methods failed for chat ${numericChatId}`);
              throw new Error(`Cannot access chat ${numericChatId}. This might be a private channel or you may not have permission.`);
            }
          }
        }
      }

      // Import the proper MTProto request class
      const { Api } = await import('telegram');

      // Use the entity directly as peer - this is what works in other endpoints
      console.log(`📖 Using entity directly as peer for ReadHistory: ${entity.className}`);

      let result;
      try {
        // Use the proper MTProto request to mark messages as read
        result = await client.invoke(
          new Api.messages.ReadHistory({
            peer: entity, // Use entity directly instead of creating InputPeer
            maxId: parseInt(maxId)
          })
        );
        console.log(`✅ Marked messages as read in chat ${chatId} up to message ${maxId}`, result);
      } catch (readError) {
        console.warn(`⚠️ ReadHistory failed, trying alternative approach:`, readError);

        // For channels, try using ReadChannelHistory
        if (entity.className === 'Channel') {
          try {
            result = await client.invoke(
              new Api.channels.ReadHistory({
                channel: entity,
                maxId: parseInt(maxId)
              })
            );
            console.log(`✅ Marked channel messages as read using channels.ReadHistory`, result);
          } catch (channelError: any) {
            console.error(`❌ Both ReadHistory methods failed:`, channelError);
            throw new Error(`Failed to mark messages as read: ${channelError.message}`);
          }
        } else {
          // For other chat types, re-throw the original error
          throw readError;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Messages marked as read',
        data: {
          chatId: parseInt(chatId),
          maxId: parseInt(maxId)
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error(`❌ Error marking messages as read in chat ${chatId}:`, error);
      return new Response(JSON.stringify({
        success: false,
        message: `Failed to mark messages as read: ${error instanceof Error ? error.message : 'Unknown error'}`
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('❌ Error in read messages endpoint:', error);
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
