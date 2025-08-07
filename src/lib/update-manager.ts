// @ts-nocheck
// Update manager for handling MTProto updates and broadcasting to clients
import { getSession } from './session-store.js';
import { llmService } from './llm-service.js';

// Type definitions
interface TelegramMessage {
  id: number;
  text: string;
  date: string;
  fromId?: number;
  chatId: number;
  chatTitle?: string;
  fromName?: string;
  mediaType?: string;
}

interface MTProtoUpdate {
  className?: string;
  message?: any;
  id?: number;
  date?: number;
  userId?: number;
  fromId?: any;
  peerId?: any;
  updates?: any[];
}

// Global error handler to suppress Telegram timeout errors
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Suppress timeout errors from Telegram client's update loop
  const errorMessage = args.join(' ');
  if (errorMessage.includes('TIMEOUT') && errorMessage.includes('updates.js')) {
    // Silently ignore these timeout errors as they're not critical
    return;
  }
  // Log all other errors normally
  originalConsoleError.apply(console, args);
};

interface SSEClient {
  sessionId: string;
  controller: ReadableStreamDefaultController;
  lastPing: Date;
  isClosed: boolean;
}

// Store SSE clients
const sseClients = new Map<string, SSEClient[]>();

// Auto-reply cache to prevent duplicate replies
const autoReplyCache = new Map<string, boolean>();

// Clean up auto-reply cache every 10 minutes to prevent memory leaks
setInterval(() => {
  autoReplyCache.clear();
  console.log('🧹 Auto-reply cache cleared');
}, 10 * 60 * 1000);

// Add SSE client for a session
export function addSSEClient(sessionId: string, controller: ReadableStreamDefaultController): SSEClient {
  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, []);
  }

  const client: SSEClient = {
    sessionId,
    controller,
    lastPing: new Date(),
    isClosed: false
  };

  sseClients.get(sessionId)!.push(client);



  return client;
}

// Remove SSE client
export function removeSSEClient(sessionId: string, controller: ReadableStreamDefaultController): void {
  const clients = sseClients.get(sessionId);
  if (clients) {
    const index = clients.findIndex(client => client.controller === controller);
    if (index !== -1) {
      // Mark as closed before removing
      clients[index].isClosed = true;
      clients.splice(index, 1);


      if (clients.length === 0) {
        sseClients.delete(sessionId);
      }
    }
  }
}

// Send auto-reply message to a chat
async function sendAutoReply(sessionId: string, chatId: number, message: string, replyToMsgId?: number): Promise<void> {
  const sessionData = await getSession(sessionId);
  if (!sessionData || !sessionData.client || !sessionData.isAuthenticated) {
    throw new Error('Session not found or not authenticated');
  }

  const { client } = sessionData;

  try {
    // Ensure client is connected
    if (!client.connected) {
      await client.connect();
    }

    // Get the chat entity
    let entity;
    try {
      entity = await client.getEntity(chatId);
    } catch (error) {
      console.warn(`⚠️ Direct entity lookup failed for ${chatId}, trying alternatives:`, error);

      // Try to find in dialogs
      const dialogs = await client.getDialogs({ limit: 100 });
      const targetDialog = dialogs.find((dialog: any) => {
        const dialogChatId = dialog.entity?.id ? Number(dialog.entity.id) : 0;
        return dialogChatId === chatId;
      });

      if (!targetDialog) {
        throw new Error(`Chat ${chatId} not found in dialogs`);
      }
      entity = targetDialog.entity;
    }

    // Send the message
    const { Api } = await import('telegram');
    const sentMessage = await client.sendMessage(entity, {
      message: message,
      replyTo: replyToMsgId
    });

    console.log(`✅ Auto-reply sent to chat ${chatId}: "${message.substring(0, 50)}..."`);

    // Broadcast the sent message to frontend
    const messageResponse = {
      id: sentMessage.id,
      text: message,
      date: new Date().toISOString(),
      fromId: sessionData.userInfo?.id,
      fromName: sessionData.userInfo?.firstName || 'You',
      chatId: chatId,
      isOutgoing: true,
      replyToMsgId: replyToMsgId || undefined,
      isAutoReply: true
    };

    broadcastToSession(sessionId, {
      type: 'message',
      data: messageResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Error sending auto-reply to chat ${chatId}:`, error);
    throw error;
  }
}

// Broadcast update to all clients of a session
export function broadcastToSession(sessionId: string, update: { type: string; data: any; timestamp: string }): void {
  const clients = sseClients.get(sessionId);
  if (!clients || clients.length === 0) {
    return;
  }

  // Safely stringify update to avoid circular references
  let messageData;
  try {
    messageData = JSON.stringify(update);
  } catch (error) {
    // Handle circular references by creating a safe version
    messageData = JSON.stringify({
      type: update.type,
      data: update.data,
      timestamp: update.timestamp,
      error: 'Circular reference in original data'
    });
  }
  const message = `data: ${messageData}\n\n`;

  // Send to all clients, remove failed ones
  const failedClients: number[] = [];

  clients.forEach((client, index) => {
    // Skip already closed clients
    if (client.isClosed) {
      failedClients.push(index);
      return;
    }

    try {
      // Check if controller is still valid before sending
      if (client.controller && typeof client.controller.enqueue === 'function') {
        client.controller.enqueue(new TextEncoder().encode(message));
        client.lastPing = new Date();
      } else {
        client.isClosed = true;
        failedClients.push(index);
      }
    } catch (error) {
      client.isClosed = true;
      failedClients.push(index);
    }
  });

  // Remove failed clients
  failedClients.reverse().forEach(index => {
    clients.splice(index, 1);
  });

}

// Setup MTProto update handlers for a session
export async function setupUpdateHandlers(sessionId: string): Promise<void> {
  const sessionData = await getSession(sessionId);
  if (!sessionData || !sessionData.client || !sessionData.isAuthenticated) {
    return;
  }

  const { client } = sessionData;

  // Ensure client is connected before setting up handlers
  try {
    if (!client.connected) {
      await client.connect();
    }
  } catch (error) {
    console.error(`Failed to connect client:`, error);
    return;
  }

  // Test if client is working by getting dialogs
  try {
    const dialogs = await client.getDialogs({ limit: 1 });
  } catch (error) {
    console.error(`Client test failed:`, error);
    return;
  }

  // Clear any existing event handlers to prevent duplicates
  try {
    client.removeEventHandlers();
  } catch (error) {
    // Ignore - this is normal
  }

  const updateHandler = async (update: MTProtoUpdate) => {
    try {

      if (!client.connected) {
        try {
          await client.connect();
        } catch (reconnectError) {
          console.error(`Failed to reconnect client:`, reconnectError);
          return;
        }
      }

      // Process ALL message-related updates (not just specific types)
      const isMessageUpdate = update.className && (
        update.className.includes('Message') ||
        update.className.includes('message') ||
        update.className === 'UpdateNewMessage' ||
        update.className === 'UpdateShortMessage' ||
        update.className === 'UpdateNewChannelMessage'
      );

      // Also check if update contains message data even without className
      const hasMessageData = update.message || (update.updates && update.updates.some((u: any) => u.message));

      // Check if this might be a combined update with multiple sub-updates
      const hasPotentialMessages = update.updates && update.updates.length > 0;



      if (isMessageUpdate || hasMessageData) {
        console.log('📨 New message arrived!', {update});
        try {
          await handleUpdate(sessionId, update);
        } catch (error) {
          console.error('Error handling update:', error);
        }
      } else if (hasPotentialMessages) {

        // Process each sub-update
        for (const subUpdate of update.updates || []) {
          if (subUpdate.className && subUpdate.className.includes('Message')) {

            try {
              await handleUpdate(sessionId, subUpdate);
            } catch (error) {
              console.error('Error handling sub-update:', error);
            }
          }
        }
      }

    } catch (error) {
      console.error(`Error in update handler for session ${sessionId}:`, error);
    }
  };

  // Add the event handler
  client.addEventHandler(updateHandler);
  console.log('✅ MTProto update handler added for session', sessionId);

  // Store the handler reference for potential cleanup
  if (!sessionData.updateHandler) {
    sessionData.updateHandler = updateHandler;
  }

  // Force client to start receiving updates with better error handling
  try {
    // Verify connection one more time
    if (!client.connected) {
      await client.connect();
    }

    // Test that we can make API calls
    try {
      await client.getMe();
    } catch (apiError) {
      console.error(`Client API test failed:`, apiError);
      throw apiError;
    }

  } catch (error) {
    console.error(`Error ensuring updates:`, error);
    throw error;
  }
}

// Handle individual MTProto updates
async function handleUpdate(sessionId: string, update: MTProtoUpdate): Promise<void> {
  const sessionData = await getSession(sessionId);
  if (!sessionData || !sessionData.client) {
    return;
  }

  const { client } = sessionData;

  try {

    // Process different types of message updates
    let message: any = null;
    let messageText = '';
    let mediaType: string | undefined = undefined;

    if (update.className === 'UpdateNewMessage') {
      message = update.message;
      messageText = message?.message || '';

    } else if (update.className === 'UpdateShortMessage') {
      messageText = update.message || '';
      // Handle BigInt userId properly
      const userId = typeof update.userId === 'bigint' ? Number(update.userId) :
                     (update.userId?.value ? Number(update.userId.value) : update.userId);

      message = {
        id: update.id,
        message: update.message,
        date: update.date,
        fromId: { userId: userId },
        peerId: { userId: userId },
        out: update.out || false
      };
      console.log('📱 UpdateShortMessage processed:', { id: message.id, text: messageText, userId: userId });

    } else if (update.className === 'UpdateNewChannelMessage') {
      message = update.message;
      messageText = message?.message || '';
    }

    // Handle media messages for all message types
    if (message?.media) {
      const { text: processedText, mediaType: processedMediaType } = processMediaMessage(message);
      messageText = processedText || messageText;
      mediaType = processedMediaType;
    }

    // Check if we have a valid message (allow media messages without text)
    if (!message || (!messageText && !message.media)) {
      console.log('❌ Invalid message, skipping:', { hasMessage: !!message, messageText, hasMedia: !!message?.media });
      return;
    }

    console.log('✅ Message validation passed, proceeding with processing');


    // Determine if message is outgoing by comparing with current user
    const currentUserId = sessionData.userInfo?.id;
    const messageFromId = message.fromId?.userId ? Number(message.fromId.userId) : undefined;
    const isOutgoing = currentUserId && messageFromId ?
      currentUserId.toString() === messageFromId.toString() :
      (message.out || false);



    const chatId = message.peerId?.chatId ? Number(message.peerId.chatId) :
                   message.peerId?.userId ? Number(message.peerId.userId) : 0;

    console.log('📋 Message details:', {
      id: message.id,
      text: messageText,
      chatId,
      fromId: messageFromId,
      peerId: message.peerId
    });

    const telegramMessage: TelegramMessage = {
      id: message.id,
      text: messageText,
      date: new Date(message.date * 1000).toISOString(),
      fromId: messageFromId,
      chatId,
      chatTitle: await getChatTitle(client, message.peerId),
      fromName: await getFromName(client, message.fromId),
      isOutgoing: isOutgoing,
      mediaType
    };

    console.log('📤 Broadcasting message:', { id: telegramMessage.id, chatId: telegramMessage.chatId, text: telegramMessage.text });



    // Broadcast to frontend
    broadcastToSession(sessionId, {
      type: 'message',
      data: telegramMessage,
      timestamp: new Date().toISOString()
    });

    // Process message with LLM if enabled for this chat (only for incoming messages)
    if (!telegramMessage.isOutgoing) {
      try {
        console.log('🤖 Starting LLM processing for incoming message in chat:', telegramMessage.chatId);

        const messageContext: any = {
          sessionId,
          chatId: telegramMessage.chatId.toString(),
          messageId: telegramMessage.id.toString(),
          message: messageText,
          sender: telegramMessage.fromName || 'Unknown',
          chat: telegramMessage.chatTitle || 'Unknown',
          senderId: telegramMessage.fromId?.toString() || 'unknown',
          timestamp: Math.floor(new Date(telegramMessage.date).getTime() / 1000)
        };

        console.log('🤖 LLM context:', messageContext);
        const llmResult = await llmService.processMessage(messageContext);
        console.log('🤖 LLM processing completed:', { success: llmResult.success, error: llmResult.error });

      if (llmResult.success) {

        // Broadcast LLM result to frontend
        broadcastToSession(sessionId, {
          type: 'llm_result',
          data: {
            messageId: telegramMessage.id,
            result: {
              content: llmResult.response || '',
              provider: llmResult.provider || 'unknown',
              model: llmResult.model || 'unknown',
              timestamp: new Date().toISOString(),
              processingTime: llmResult.processingTime || 0
            }
          },
          timestamp: new Date().toISOString()
        });

        // Auto-reply if enabled and this is not an outgoing message
        if (llmResult.shouldReply && !telegramMessage.isOutgoing && llmResult.response) {
          try {
            console.log('🤖 Auto-reply enabled, checking if already replied to message:', telegramMessage.id);

            // Check if we already sent an auto-reply for this message
            const replyKey = `auto_reply_${sessionId}_${telegramMessage.chatId}_${telegramMessage.id}`;

            if (!autoReplyCache.has(replyKey)) {
              console.log('🤖 Sending LLM response back to chat:', telegramMessage.chatId);

              // Mark this message as having an auto-reply sent
              autoReplyCache.set(replyKey, true);

              // Send the LLM response back to the chat
              await sendAutoReply(sessionId, telegramMessage.chatId, llmResult.response, telegramMessage.id);

              console.log('✅ Auto-reply sent successfully');
            } else {
              console.log('⏭️ Auto-reply already sent for this message, skipping');
            }
          } catch (autoReplyError) {
            console.error('❌ Error sending auto-reply:', autoReplyError);
          }
        }

      }
      } catch (llmError) {
        console.error('Error in LLM processing:', llmError);
      }
    } else {
      console.log('⏭️ Skipping LLM processing for outgoing message');
    }

  } catch (error) {
    console.error('Error processing update:', error);

    // Handle Telegram authentication errors
    try {
      const { handleTelegramError, broadcastAuthError } = await import('./telegram-error-handler.js');
      const errorResponse = await handleTelegramError(error, sessionId);

      if (errorResponse.shouldLogout) {

        // Broadcast auth error to frontend
        broadcastAuthError(sessionId, errorResponse);
      }
    } catch (handlerError) {
      console.error('Error in telegram error handler:', handlerError);
    }
  }
}

// Helper functions
async function getChatTitle(client: any, peerId: any): Promise<string | undefined> {
  try {
    if (peerId?.chatId) {
      const chat = await client.getEntity(peerId.chatId);
      return chat.title;
    } else if (peerId?.userId) {
      const user = await client.getEntity(peerId.userId);
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const title = fullName || user.username || `User ${peerId.userId}`;
      return title;
    }
  } catch (error) {
    console.error('Error getting chat title:', error);
    // Return a fallback title
    if (peerId?.chatId) {
      return `Chat ${peerId.chatId}`;
    } else if (peerId?.userId) {
      return `User ${peerId.userId}`;
    }
  }
  return undefined;
}

async function getFromName(client: any, fromId: any): Promise<string | undefined> {
  try {
    if (fromId?.userId) {
      const user = await client.getEntity(fromId.userId);
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const finalName = fullName || user.username || `User ${fromId.userId}`;
      return finalName;
    }
  } catch (error) {
    console.error('Error getting user name:', error);
    // Return a fallback name with the user ID
    if (fromId?.userId) {
      return `User ${fromId.userId}`;
    }
  }
  return undefined;
}

// Cleanup function
export function cleanupSession(sessionId: string): void {
  // Remove all SSE clients for this session
  sseClients.delete(sessionId);

}

// Periodic cleanup of stale connections
setInterval(() => {
  const now = new Date();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes

  for (const entry of Array.from(sseClients.entries())) {
    const [sessionId, clients] = entry;
    const activeClients = clients.filter(client => {
      const timeSinceLastPing = now.getTime() - client.lastPing.getTime();
      return !client.isClosed && timeSinceLastPing < staleThreshold;
    });

    if (activeClients.length !== clients.length) {
      sseClients.set(sessionId, activeClients);

    }
  }
}, 60000); // Run every minute

// Process media messages to extract type and generate appropriate text
function processMediaMessage(message: any): { text: string; mediaType: string } {
  if (!message.media) {
    return { text: message.message || '', mediaType: '' };
  }

  const mediaClassName = message.media.className;
  let text = message.message || '';
  let mediaType = 'other';

  switch (mediaClassName) {
    case 'MessageMediaPhoto':
      mediaType = 'photo';
      text = text || '📷 Photo';
      break;

    case 'MessageMediaDocument':
      const document = message.media.document;
      if (document?.attributes) {
        for (const attr of document.attributes) {
          if (attr.className === 'DocumentAttributeVideo') {
            mediaType = 'video';
            const duration = attr.duration ? ` (${Math.floor(attr.duration / 60)}:${(attr.duration % 60).toString().padStart(2, '0')})` : '';
            text = text || `🎥 Video${duration}`;
            break;
          } else if (attr.className === 'DocumentAttributeAudio') {
            mediaType = 'audio';
            const duration = attr.duration ? ` (${Math.floor(attr.duration / 60)}:${(attr.duration % 60).toString().padStart(2, '0')})` : '';
            const title = attr.title || attr.performer ? `${attr.performer || 'Unknown'} - ${attr.title || 'Unknown'}` : 'Audio';
            text = text || `🎵 ${title}${duration}`;
            break;
          } else if (attr.className === 'DocumentAttributeSticker') {
            mediaType = 'sticker';
            text = text || '🎭 Sticker';
            break;
          } else if (attr.className === 'DocumentAttributeAnimated') {
            mediaType = 'gif';
            text = text || '🎬 GIF';
            break;
          } else if (attr.className === 'DocumentAttributeFilename') {
            mediaType = 'document';
            text = text || `📄 ${attr.fileName || 'Document'}`;
            break;
          }
        }
        // Default document handling if no specific attribute found
        if (mediaType === 'other') {
          mediaType = 'document';
          text = text || '📄 Document';
        }
      } else {
        mediaType = 'document';
        text = text || '📄 Document';
      }
      break;

    case 'MessageMediaContact':
      mediaType = 'contact';
      text = text || '👤 Contact';
      break;

    case 'MessageMediaGeo':
    case 'MessageMediaGeoLive':
    case 'MessageMediaVenue':
      mediaType = 'location';
      text = text || '📍 Location';
      break;

    case 'MessageMediaPoll':
      mediaType = 'poll';
      text = text || '📊 Poll';
      break;

    case 'MessageMediaGame':
      mediaType = 'game';
      text = text || '🎮 Game';
      break;

    case 'MessageMediaWebPage':
      mediaType = 'webpage';
      text = text || '🔗 Link';
      break;

    default:
      mediaType = 'other';
      text = text || '📎 Media';
      break;
  }

  return { text, mediaType };
}
