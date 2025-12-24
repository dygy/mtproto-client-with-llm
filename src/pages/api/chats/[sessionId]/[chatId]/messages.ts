// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../../../../lib/session-store.js';

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { sessionId, chatId } = params;
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offsetId = parseInt(url.searchParams.get('offsetId') || '0');

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

      const mockMessages = generateMockMessages(parseInt(chatId), limit);
      const mockChatInfo = getMockChatInfo(parseInt(chatId));

      return new Response(JSON.stringify({
        success: true,
        messages: mockMessages,
        chatInfo: mockChatInfo,
        hasMore: false
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
      // Get the chat entity
      let chatEntity;
      try {
        chatEntity = await client.getEntity(parseInt(chatId));
      } catch (entityError) {
        console.error(`Failed to get entity for chat ${chatId}:`, entityError);

        // Try alternative methods for channels
        try {
          // For channels, try with negative ID
          chatEntity = await client.getEntity(-Math.abs(parseInt(chatId)));
        } catch (altError) {
          try {
            // For supergroups, try with -100 prefix
            chatEntity = await client.getEntity(-1000000000000 - Math.abs(parseInt(chatId)));
          } catch (finalError) {
            console.error(`All entity resolution methods failed for chat ${chatId}`);
            throw new Error(`Cannot access chat ${chatId}. This might be a private channel or you may not have permission to read messages.`);
          }
        }
      }



      // Get the dialog to access readOutboxMaxId for read status
      let readOutboxMaxId = 0;
      try {
        const dialogs = await client.getDialogs({ limit: 100 });
        const targetDialog = dialogs.find((d: any) => {
          const entityId = d.entity?.id?.toJSNumber?.() || d.entity?.id;
          return entityId?.toString() === chatId;
        });

        if (targetDialog && targetDialog.dialog) {
          readOutboxMaxId = targetDialog.dialog.readOutboxMaxId || 0;
          console.log(`📖 Chat ${chatId} readOutboxMaxId: ${readOutboxMaxId}`);
        }
      } catch (dialogError) {
        console.warn(`⚠️ Could not get dialog info for read status:`, dialogError);
      }

      // Get messages from the specific chat
      const options: any = { limit };
      if (offsetId > 0) {
        options.offsetId = offsetId;
      }

      let messages;
      try {
        messages = await client.getMessages(chatEntity, options);

      } catch (messagesError) {
        console.error(`❌ Failed to get messages from chat ${chatId}:`, messagesError);

        // For channels, try using the direct MTProto API
        if (chatEntity.className === 'Channel') {

          try {
            const { Api } = await import('telegram');

            // Use messages.GetHistory for channels
            const result = await client.invoke(
              new Api.messages.GetHistory({
                peer: chatEntity,
                limit: options.limit,
                offsetId: options.offsetId || 0,
                offsetDate: 0,
                addOffset: 0,
                maxId: 0,
                minId: 0,
                hash: 0 as any
              })
            );

            if (result.messages) {
              messages = result.messages;

            } else {
              throw new Error('No messages returned from MTProto API');
            }
          } catch (mtprotoError) {
            console.error(`❌ MTProto API also failed for channel ${chatId}:`, mtprotoError);
            throw new Error(`Cannot read messages from this channel. You may not be a member, the channel may be private, or you may not have permission to view message history.`);
          }
        } else {
          throw messagesError;
        }
      }

      const formattedMessages = await Promise.all(messages.map(async (message: any) => {
        if (!message.message && !message.media) {
          return null; // Skip empty messages
        }

        let messageText = message.message || '';
        let mediaType = null;

        // Handle media messages
        if (message.media) {
          if (message.media.className === 'MessageMediaPhoto') {
            mediaType = 'photo';
            messageText = messageText || '[Photo]';
          } else if (message.media.className === 'MessageMediaDocument') {
            mediaType = 'document';

            // Extract document information
            const document = message.media.document;
            let documentInfo = '[Document]';

            if (document) {
              let fileName = 'Unknown file';
              let fileSize = '';

              // Extract filename from attributes
              if (document.attributes) {
                for (const attr of document.attributes) {
                  if (attr.className === 'DocumentAttributeFilename') {
                    fileName = attr.fileName;
                  } else if (attr.className === 'DocumentAttributeVideo') {
                    mediaType = 'video';
                    fileName = `Video (${attr.duration}s)`;
                  } else if (attr.className === 'DocumentAttributeAudio') {
                    mediaType = 'audio';
                    const duration = attr.duration ? `${Math.floor(attr.duration / 60)}:${(attr.duration % 60).toString().padStart(2, '0')}` : '';
                    fileName = attr.title || attr.performer ? `${attr.performer || 'Unknown'} - ${attr.title || 'Unknown'}` : `Audio ${duration}`;
                  } else if (attr.className === 'DocumentAttributeSticker') {
                    mediaType = 'sticker';
                    fileName = 'Sticker';
                  } else if (attr.className === 'DocumentAttributeAnimated') {
                    mediaType = 'gif';
                    fileName = 'GIF';
                  }
                }
              }

              // Format file size
              if (document.size) {
                const size = document.size.toJSNumber ? document.size.toJSNumber() : document.size;
                if (size < 1024) {
                  fileSize = `${size} B`;
                } else if (size < 1024 * 1024) {
                  fileSize = `${(size / 1024).toFixed(1)} KB`;
                } else if (size < 1024 * 1024 * 1024) {
                  fileSize = `${(size / (1024 * 1024)).toFixed(1)} MB`;
                } else {
                  fileSize = `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
                }
              }



              // Format document info
              documentInfo = fileName;
              if (fileSize) {
                documentInfo += ` (${fileSize})`;
              }
            }

            messageText = messageText || documentInfo;
          } else if (message.media.className === 'MessageMediaContact') {
            mediaType = 'contact';
            messageText = messageText || '[Contact]';
          } else if (message.media.className === 'MessageMediaGeo') {
            mediaType = 'location';
            messageText = messageText || '[Location]';
          } else {
            mediaType = 'other';
            messageText = messageText || '[Media]';
          }
        }

        // Extract media metadata
        let mediaInfo: any = undefined;
        if (message.media) {
          if (message.media.className === 'MessageMediaPhoto') {
            const photo = message.media.photo;
            if (photo && photo.sizes && photo.sizes.length > 0) {
              const largestSize = photo.sizes[photo.sizes.length - 1];
              mediaInfo = {
                width: largestSize.w,
                height: largestSize.h,
                mimeType: 'image/jpeg'
              };
            }
          } else if (message.media.className === 'MessageMediaDocument') {
            const document = message.media.document;
            if (document) {
              mediaInfo = {
                fileName: document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeFilename')?.fileName,
                fileSize: document.size,
                mimeType: document.mimeType,
                width: undefined as number | undefined,
                height: undefined as number | undefined,
                duration: undefined as number | undefined
              };

              // Add video/audio specific metadata
              const videoAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeVideo');
              const audioAttr = document.attributes?.find((attr: any) => attr.className === 'DocumentAttributeAudio');

              if (videoAttr) {
                mediaInfo.width = videoAttr.w;
                mediaInfo.height = videoAttr.h;
                mediaInfo.duration = videoAttr.duration;
              } else if (audioAttr) {
                mediaInfo.duration = audioAttr.duration;
              }
            }
          }
        }

        const fromId = message.fromId?.userId?.toJSNumber();
        const isOutgoing = message.out || false;
        let fromName = undefined;

        if (message.fromId) {
          fromName = await getFromName(client, message.fromId);
        }

        // If we still don't have a name and it's not outgoing, try to get it from the message sender
        if (!fromName && !isOutgoing && fromId) {
          if (message.sender) {
            const firstName = message.sender.firstName || '';
            const lastName = message.sender.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim();
            fromName = fullName || message.sender.username || `User ${fromId}`;
            console.log(`👤 Got sender from message.sender: "${fromName}"`);
          }
        }

        // Determine message status for outgoing messages
        let status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' = 'sent';
        if (isOutgoing) {
          if (readOutboxMaxId > 0) {
            if (message.id <= readOutboxMaxId) {
              status = 'read';
              console.log(`✓✓ Message ${message.id} is READ (≤ ${readOutboxMaxId})`);
            } else {
              status = 'delivered';
              console.log(`✓✓ Message ${message.id} is DELIVERED (> ${readOutboxMaxId})`);
            }
          } else {
            console.log(`⚠️ Message ${message.id} - no readOutboxMaxId, defaulting to 'sent'`);
          }
        }

        return {
          id: message.id,
          text: messageText,
          date: new Date(message.date * 1000).toISOString(),
          fromId: fromId,
          chatId: parseInt(chatId),
          fromName: fromName,
          mediaType,
          hasMedia: !!message.media,
          mediaInfo,
          isOutgoing: isOutgoing,
          status: status,
          replyToMsgId: message.replyTo?.replyToMsgId
        };
      }));

      // Filter out null messages and sort by date (oldest first for chat display)
      const validMessages = formattedMessages
        .filter(msg => msg !== null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Get chat info
      const chatInfo = await getChatInfo(chatEntity);

      return new Response(JSON.stringify({
        success: true,
        messages: validMessages,
        chatInfo,
        hasMore: messages.length === limit
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error('Error getting chat messages:', error);

      // Handle Telegram authentication errors
      const { handleTelegramError, broadcastAuthError } = await import('../../../../../lib/telegram-error-handler.js');
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
    console.error('Error in chat messages endpoint:', error);

    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get chat messages'
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

      const firstName = user.firstName || '';
      const lastName = user.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const finalName = fullName || user.username || `User ${fromId.userId}`;

      return finalName;
    } else {
      console.log(`👤 getFromName: No userId in fromId:`, fromId);
    }
  } catch (error) {
    console.error(`👤 getFromName: Error getting user info for ${fromId?.userId}:`, error);
    // Return a fallback name with the user ID if available
    if (fromId?.userId) {
      return `User ${fromId.userId}`;
    }
  }
  return undefined;
}

async function getChatInfo(entity: any) {
  const info: any = {
    id: entity.id?.toJSNumber() || 0,
    title: '',
    type: 'unknown'
  };

  if (entity.className === 'User') {
    info.type = entity.bot ? 'bot' : 'private';
    info.title = `${entity.firstName || ''} ${entity.lastName || ''}`.trim();
    info.username = entity.username;
    info.isBot = entity.bot;
  } else if (entity.className === 'Chat') {
    info.type = 'group';
    info.title = entity.title;
    info.participantsCount = entity.participantsCount;
  } else if (entity.className === 'Channel') {
    info.type = entity.megagroup ? 'supergroup' : 'channel';
    info.title = entity.title;
    info.username = entity.username;
    info.participantsCount = entity.participantsCount;
    info.isMegagroup = entity.megagroup;
    info.isBroadcast = entity.broadcast;
  }

  return info;
}

function generateMockMessages(chatId: number, limit: number) {
  const baseTime = Date.now();
  const messages = [];

  // Generate different message patterns based on chat ID
  switch (chatId) {
    case 1: // John Doe - private chat
      messages.push(
        {
          id: 101,
          text: "Hey, how are you doing?",
          date: new Date(baseTime - 1000 * 60 * 5).toISOString(),
          fromId: 1,
          chatId: 1,
          fromName: "John Doe",
          mediaType: null,
          isOutgoing: false,
          replyToMsgId: undefined
        },
        {
          id: 102,
          text: "I'm doing great! Thanks for asking 😊",
          date: new Date(baseTime - 1000 * 60 * 3).toISOString(),
          fromId: 999, // Current user
          chatId: 1,
          fromName: "You",
          mediaType: null,
          isOutgoing: true,
          replyToMsgId: undefined
        },
        {
          id: 103,
          text: "That's awesome! Want to grab coffee later?",
          date: new Date(baseTime - 1000 * 60 * 1).toISOString(),
          fromId: 1,
          chatId: 1,
          fromName: "John Doe",
          mediaType: null,
          isOutgoing: false,
          replyToMsgId: undefined
        }
      );
      break;

    case 2: // Work Group
      messages.push(
        {
          id: 201,
          text: "Good morning everyone!",
          date: new Date(baseTime - 1000 * 60 * 60 * 2).toISOString(),
          fromId: 2,
          chatId: 2,
          fromName: "Alice Smith",
          mediaType: null,
          isOutgoing: false,
          replyToMsgId: undefined
        },
        {
          id: 202,
          text: "Morning Alice! Ready for the big presentation?",
          date: new Date(baseTime - 1000 * 60 * 60 * 1.5).toISOString(),
          fromId: 3,
          chatId: 2,
          fromName: "Bob Johnson",
          mediaType: null,
          isOutgoing: false,
          replyToMsgId: undefined
        },
        {
          id: 203,
          text: "Yes! I've prepared all the slides. Meeting at 3 PM today",
          date: new Date(baseTime - 1000 * 60 * 30).toISOString(),
          fromId: 2,
          chatId: 2,
          fromName: "Alice Smith",
          mediaType: null,
          isOutgoing: false,
          replyToMsgId: undefined
        },
        {
          id: 204,
          text: "Perfect! I'll be there",
          date: new Date(baseTime - 1000 * 60 * 25).toISOString(),
          fromId: 999, // Current user
          chatId: 2,
          fromName: "You",
          mediaType: null,
          isOutgoing: true,
          replyToMsgId: undefined
        }
      );
      break;

    case 3: // Tech News - channel
      messages.push(
        {
          id: 301,
          text: "🚀 New JavaScript framework released! Check out the amazing features...",
          date: new Date(baseTime - 1000 * 60 * 60 * 2).toISOString(),
          fromId: 3,
          chatId: 3,
          fromName: "Tech News",
          mediaType: null,
          isOutgoing: false,
          replyToMsgId: undefined
        },
        {
          id: 302,
          text: "📱 Mobile development trends for 2025",
          date: new Date(baseTime - 1000 * 60 * 60 * 4).toISOString(),
          fromId: 3,
          chatId: 3,
          fromName: "Tech News",
          mediaType: null,
          isOutgoing: false,
          replyToMsgId: undefined
        }
      );
      break;

    case 4: // Bot Assistant
      messages.push(
        {
          id: 401,
          text: "Hello! I'm your AI assistant. How can I help you today?",
          date: new Date(baseTime - 1000 * 60 * 60 * 24).toISOString(),
          fromId: 4,
          chatId: 4,
          fromName: "Bot Assistant",
          mediaType: null,
          isOutgoing: false,
          replyToMsgId: undefined
        },
        {
          id: 402,
          text: "/help",
          date: new Date(baseTime - 1000 * 60 * 60 * 23).toISOString(),
          fromId: 999, // Current user
          chatId: 4,
          fromName: "You",
          mediaType: null,
          isOutgoing: true,
          replyToMsgId: undefined
        },
        {
          id: 403,
          text: "Here are the available commands:\n/help - Show this help\n/weather - Get weather info\n/joke - Tell a joke",
          date: new Date(baseTime - 1000 * 60 * 60 * 23).toISOString(),
          fromId: 4,
          chatId: 4,
          fromName: "Bot Assistant",
          mediaType: null,
          isOutgoing: false,
          replyToMsgId: undefined
        }
      );
      break;

    default:
      // Empty chat
      break;
  }

  return messages.slice(0, limit);
}

function getMockChatInfo(chatId: number) {
  switch (chatId) {
    case 1:
      return {
        id: 1,
        title: "John Doe",
        type: "private",
        username: "johndoe",
        isBot: false
      };
    case 2:
      return {
        id: 2,
        title: "Work Group",
        type: "group",
        participantsCount: 15
      };
    case 3:
      return {
        id: 3,
        title: "Tech News",
        type: "channel",
        username: "technews",
        participantsCount: 1250,
        isMegagroup: false,
        isBroadcast: true
      };
    case 4:
      return {
        id: 4,
        title: "Bot Assistant",
        type: "bot",
        username: "botassistant",
        isBot: true
      };
    default:
      return {
        id: chatId,
        title: "Unknown Chat",
        type: "unknown"
      };
  }
}
