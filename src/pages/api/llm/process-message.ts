// @ts-nocheck
import type { APIRoute } from 'astro';
import { llmService, type MessageContext } from '../../../lib/llm-service.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    
    const { sessionId, chatId, message, sender, senderId } = data;
    
    if (!sessionId || !chatId || !message) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields: sessionId, chatId, message'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`🤖 LLM processing request for session ${sessionId}, chat ${chatId}`);

    const context: MessageContext = {
      message,
      sender: sender || 'Unknown',
      senderId: senderId || 'unknown',
      chat: `Chat ${chatId}`,
      chatId,
      sessionId,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const result = await llmService.processMessage(context);
    
    return new Response(JSON.stringify({
      success: result.success,
      response: result.response,
      shouldReply: result.shouldReply,
      processingTime: result.processingTime,
      error: result.error
    }), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in LLM processing API:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
