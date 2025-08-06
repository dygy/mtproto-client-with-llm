// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../../../../lib/session-store.js';
import { broadcastToSession } from '../../../../../lib/update-manager.js';
import { LLMService } from '../../../../../lib/llm-service.js';

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
    const { text, replyToMsgId } = body;

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
      console.log(`📤 Mock sending message to chat ${chatId}: "${text}"`);
      
      const mockMessage = {
        id: Date.now(),
        text: text.trim(),
        date: new Date().toISOString(),
        fromId: sessionData.userInfo?.id || 12345,
        fromName: sessionData.userInfo?.firstName || 'You',
        chatId: parseInt(chatId),
        isOutgoing: true,
        replyToMsgId: replyToMsgId || undefined
      };

      return new Response(JSON.stringify({
        success: true,
        message: mockMessage
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

      // Send the message
      const sentMessage = await client.sendMessage(targetDialog.entity, {
        message: text.trim(),
        replyTo: replyToMsgId || undefined
      });

      console.log(`✅ Message sent to chat ${targetDialog.title}: "${text}"`);

      // Capture variables for LLM processing
      const chatTitle = targetDialog.title || 'Unknown Chat';
      const messageId = sentMessage.id;
      const messageText = text.trim();

      // Format the response
      const messageResponse = {
        id: sentMessage.id,
        text: text.trim(),
        date: new Date().toISOString(),
        fromId: sessionData.userInfo?.id,
        fromName: sessionData.userInfo?.firstName || 'You',
        chatId: parseInt(chatId),
        isOutgoing: true,
        replyToMsgId: replyToMsgId || undefined
      };

      // Broadcast message to frontend via SSE
      broadcastToSession(sessionId, {
        type: 'message',
        data: messageResponse,
        timestamp: new Date().toISOString()
      });

      // Process with LLM if enabled for this chat (async, don't wait)
      setTimeout(async () => {
        try {
          console.log(`🤖 Checking if LLM processing is enabled for outgoing message...`);

          const llmService = new LLMService();
          const messageContext = {
            sessionId,
            chatId: chatId,
            messageId: messageId.toString(), // Add the actual message ID
            message: messageText,
            sender: sessionData.userInfo?.firstName || 'You',
            chat: chatTitle,
            senderId: sessionData.userInfo?.id?.toString() || 'unknown',
            timestamp: Math.floor(Date.now() / 1000)
          };

          const llmResult = await llmService.processMessage(messageContext);

          if (llmResult.success) {
            console.log(`✅ LLM processing completed for outgoing message ${messageId}`);
            console.log(`🤖 LLM Response: ${llmResult.response?.substring(0, 100)}...`);

            // Broadcast LLM result to frontend
            broadcastToSession(sessionId, {
              type: 'llm_result',
              data: {
                messageId: messageId,
                result: {
                  content: llmResult.response,
                  provider: llmResult.provider || 'unknown',
                  model: llmResult.model || 'unknown',
                  timestamp: new Date().toISOString(),
                  processingTime: llmResult.processingTime
                }
              },
              timestamp: new Date().toISOString()
            });

            console.log(`📡 LLM result broadcasted to frontend for outgoing message ${messageId}`);
          } else {
            console.log(`⏭️ LLM processing skipped for outgoing message: ${llmResult.error}`);
          }
        } catch (llmError) {
          console.error('❌ Error in LLM processing for outgoing message:', llmError);
        }
      }, 100); // Small delay to ensure message is processed first

      return new Response(JSON.stringify({
        success: true,
        message: messageResponse
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error(`❌ Error sending message to chat ${chatId}:`, error);
      return new Response(JSON.stringify({
        success: false,
        message: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('❌ Error in send message API:', error);
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
