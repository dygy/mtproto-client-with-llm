// @ts-nocheck
import type { APIRoute } from 'astro';
import BlobStorage from '../../../../lib/blob-storage.js';

export const GET: APIRoute = async ({ params }) => {
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

  try {
    // Get all chat settings for this session from Blob storage
    const settings = await BlobStorage.listChatSettings(sessionId);

    return new Response(JSON.stringify({
      success: true,
      data: {
        sessionId,
        totalChats: settings.length,
        settings: settings.map(setting => ({
          chatId: setting.chat_id,
          llmEnabled: Boolean(setting.llm_enabled),
          llmProvider: setting.llm_provider,
          llmModel: setting.llm_model,
          llmPrompt: setting.llm_prompt?.substring(0, 100) + '...',
          keywords: setting.keywords,
          autoReply: Boolean(setting.auto_reply),
          notifications: Boolean(setting.notifications)
        }))
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error listing chat settings:', error);

    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to list chat settings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
