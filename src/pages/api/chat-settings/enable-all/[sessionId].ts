// @ts-nocheck
import type { APIRoute } from 'astro';
import BlobStorage, { type ChatSettings } from '../../../../lib/blob-storage.js';
import { getSession } from '../../../../lib/session-store.js';

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { sessionId } = params;

    if (!sessionId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the prompt from request body (optional)
    let defaultPrompt = 'Analyze this message from {sender} in {chat}: {message}';
    try {
      const body = await request.json();
      if (body.prompt) {
        defaultPrompt = body.prompt;
      }
    } catch {
      // Use default prompt if no body or invalid JSON
    }

    // Get session to verify it exists
    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all chats for this session (we'll need to get them from the client)
    if (!sessionData.client || !sessionData.isAuthenticated) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not authenticated or no client available'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { client } = sessionData;

    // Get dialogs (chats) from Telegram
    const dialogs = await client.getDialogs({ limit: 100 });

    const enabledChats = [];
    const errors = [];

    // Enable LLM for each chat
    for (const dialog of dialogs) {
      try {
        const chatId = dialog.id?.toString();
        if (chatId) {
          const settings: ChatSettings = {
            session_id: sessionId,
            chat_id: chatId,
            llm_enabled: true,
            llm_provider: 'openai',
            llm_model: 'gpt-4o-mini',
            llm_prompt: defaultPrompt,
            auto_reply: false,
            keywords: '',
            notifications: true
          };

          await BlobStorage.setChatSettings(sessionId, chatId, settings);
          enabledChats.push({
            chatId,
            title: dialog.title || dialog.name || 'Unknown Chat'
          });
        }
      } catch (error) {
        errors.push({
          chatId: dialog.id?.toString() || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `LLM processing enabled for ${enabledChats.length} chats`,
      data: {
        enabledChats,
        errors,
        prompt: defaultPrompt
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error enabling LLM for all chats:', error);

    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to enable LLM for chats'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
