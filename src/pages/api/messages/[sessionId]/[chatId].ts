// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../../../lib/session-store.js';

// Helper function to convert Telegram media to frontend media type
function getMediaType(media: any): string | null {
  if (!media) return null;

  if (media.className === 'MessageMediaPhoto') {
    return 'photo';
  }

  if (media.className === 'MessageMediaDocument' && media.document) {
    const doc = media.document;
    const mimeType = doc.mimeType || '';
    const attributes = doc.attributes || [];

    // Check for video
    const isVideo = attributes.some((attr: any) =>
      attr.className === 'DocumentAttributeVideo'
    );
    if (isVideo) {
      // Check if it's a GIF (round video message or animated)
      const isRound = attributes.some((attr: any) =>
        attr.className === 'DocumentAttributeVideo' && attr.roundMessage
      );
      const isAnimated = attributes.some((attr: any) =>
        attr.className === 'DocumentAttributeAnimated'
      );

      if (isAnimated || mimeType === 'image/gif') {
        return 'gif';
      }
      return 'video';
    }

    // Check for audio
    const isAudio = attributes.some((attr: any) =>
      attr.className === 'DocumentAttributeAudio'
    );
    if (isAudio || mimeType.startsWith('audio/')) {
      return 'audio';
    }

    // Check for sticker
    const isSticker = attributes.some((attr: any) =>
      attr.className === 'DocumentAttributeSticker'
    );
    if (isSticker) {
      return 'sticker';
    }

    // Default to document
    return 'document';
  }

  return null;
}

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { sessionId, chatId } = params;
    const limit = parseInt(url.searchParams.get('limit') || '50');

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

    console.log(`📨 Getting messages for chat ${chatId} in session ${sessionId}`);

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
      // Get the specific chat entity
      const dialogs = await client.getDialogs({ limit: 100 });
      const targetDialog = dialogs.find((dialog: any) =>
        dialog.entity.id?.toJSNumber()?.toString() === chatId
      );

      if (!targetDialog) {
        console.log(`❌ Chat with ID ${chatId} not found in dialogs. Trying direct entity access...`);

        // Try to get entity directly if not found in dialogs
        try {
          const directEntity = await client.getEntity(parseInt(chatId));
          console.log(`📨 Found chat via direct entity access: ${directEntity.title || directEntity.className}`);

          // Get messages from the direct entity
          const chatMessages = await client.getMessages(directEntity, { limit });

          const messages = [];
          for (const message of chatMessages) {
            if (message.message || message.media) {
              messages.push({
                id: message.id,
                text: message.message || '[Media message]',
                date: message.date,
                fromId: message.fromId?.userId?.toJSNumber(),
                out: message.out,
                chatId: directEntity.id?.toJSNumber(),
                chatTitle: directEntity.title || `${directEntity.className} ${directEntity.id}`,
                media: message.media ? {
                  type: message.media.className,
                  hasFile: !!message.media.document || !!message.media.photo
                } : null
              });
            }
          }

          return new Response(JSON.stringify({
            success: true,
            messages: messages,
            chatInfo: {
              id: directEntity.id?.toJSNumber(),
              title: directEntity.title || `${directEntity.className} ${directEntity.id}`,
              type: directEntity.className
            }
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          });

        } catch (directError) {
          console.error(`❌ Direct entity access also failed for chat ${chatId}:`, directError);
          return new Response(JSON.stringify({
            success: false,
            message: `Chat with ID ${chatId} not found or not accessible`
          }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }
      }

      console.log(`📨 Found chat: ${targetDialog.title} (${targetDialog.entity.className})`);

      // Get messages from the specific chat
      let chatMessages;
      try {
        chatMessages = await client.getMessages(targetDialog.entity, { limit });
        console.log(`📨 Retrieved ${chatMessages.length} messages from ${targetDialog.entity.className}`);
      } catch (messagesError) {
        console.error(`❌ Failed to get messages from ${targetDialog.title}:`, messagesError);

        if (targetDialog.entity.className === 'Channel') {
          throw new Error(`Cannot read messages from channel "${targetDialog.title}". You may not be a member or the channel may be private.`);
        } else {
          throw messagesError;
        }
      }

      const messages = [];
      for (const message of chatMessages) {
        if (message.message || message.media) {
          const fromId = message.fromId?.userId?.toJSNumber();

          // Get current user ID for proper ownership detection
          const currentUserId = sessionData.userInfo?.id;

          // Determine if message is outgoing by comparing fromId with current user ID
          let isOutgoing = false;
          if (currentUserId && fromId) {
            // Convert both to strings for reliable comparison
            isOutgoing = currentUserId.toString() === fromId.toString();
          } else {
            // Fallback to Telegram's 'out' property if user ID comparison fails
            isOutgoing = message.out || false;
          }

          // Try to get sender name
          let fromName = undefined;
          if (!isOutgoing && fromId) {
            // For incoming messages, try to get sender info
            try {
              // In group chats, we might have sender info in the message
              if (message.sender) {
                const firstName = message.sender.firstName || '';
                const lastName = message.sender.lastName || '';
                const fullName = `${firstName} ${lastName}`.trim();
                fromName = fullName || message.sender.username || `User ${fromId}`;
                console.log(`👤 Got sender from message.sender: "${fromName}"`);
              } else {
                // Try to get user entity from client
                try {
                  const userEntity = await client.getEntity(fromId);
                  const firstName = userEntity.firstName || '';
                  const lastName = userEntity.lastName || '';
                  const fullName = `${firstName} ${lastName}`.trim();
                  fromName = fullName || userEntity.username || `User ${fromId}`;
                  console.log(`👤 Got sender from client.getEntity: "${fromName}"`);
                } catch (entityError) {
                  fromName = `User ${fromId}`;
                }
              }
            } catch (error) {
              console.log(`👤 Error getting sender name: ${error}`);
              fromName = `User ${fromId}`;
            }
          } else if (isOutgoing) {
            // For outgoing messages, use current user's name
            fromName = sessionData.userInfo?.firstName || 'You';
          }

          console.log(`📨 Message ${message.id}: fromId=${fromId}, currentUserId=${currentUserId}, isOutgoing=${isOutgoing}, fromName=${fromName}`);

          const mediaType = getMediaType(message.media);

          // Determine message status for outgoing messages
          let status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' = 'sent';
          if (isOutgoing) {
            // Check if message has been read by checking dialog's read_outbox_max_id
            if (targetDialog.dialog && targetDialog.dialog.readOutboxMaxId) {
              if (message.id <= targetDialog.dialog.readOutboxMaxId) {
                status = 'read';
              } else {
                status = 'delivered';
              }
            }
          }

          messages.push({
            id: message.id,
            text: message.message || (mediaType ? `[${mediaType} message]` : ''),
            date: message.date,
            fromId: fromId,
            fromName: fromName,
            isOutgoing: isOutgoing, // Set the correct property name
            chatId: targetDialog.entity.id?.toJSNumber(),
            chatTitle: targetDialog.title,
            hasMedia: !!mediaType,
            mediaType: mediaType,
            status: status,
            reactions: [], // Initialize empty reactions array
            media: message.media ? {
              type: message.media.className,
              hasFile: !!message.media.document || !!message.media.photo
            } : null
          });
        }
      }

      console.log(`✅ Retrieved ${messages.length} messages from chat ${targetDialog.title}`);

      return new Response(JSON.stringify({
        success: true,
        messages: messages,
        chatInfo: {
          id: targetDialog.entity.id?.toJSNumber(),
          title: targetDialog.title,
          type: targetDialog.entity.className
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error(`❌ Error getting messages for chat ${chatId}:`, error);

      // Handle Telegram authentication errors
      const { handleTelegramError, broadcastAuthError } = await import('../../../../lib/telegram-error-handler.js');
      const errorResponse = await handleTelegramError(error, sessionId);

      if (errorResponse.shouldLogout) {
        console.log(`🚪 Messages API: Session ${sessionId} requires logout due to: ${errorResponse.errorCode}`);

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
    console.error('❌ Error in messages API:', error);
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
