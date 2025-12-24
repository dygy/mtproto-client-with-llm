// @ts-nocheck
import type { APIRoute } from 'astro';
import BlobStorage from '../../../../lib/blob-storage.js';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { sessionId, chatId } = params;

    if (!sessionId || !chatId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID and Chat ID are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const settings = await BlobStorage.getChatSettings(sessionId, chatId);

    // Convert BlobStorage format to frontend format
    const convertToFrontendFormat = (s: any) => ({
      llmEnabled: s?.llm_enabled ?? false,
      llmProvider: s?.llm_provider ?? 'openai',
      llmModel: s?.llm_model ?? 'gpt-4o-mini',
      llmPrompt: s?.llm_prompt ?? '',
      autoReply: s?.auto_reply ?? false,
      keywords: s?.keywords ? (typeof s.keywords === 'string' ? s.keywords.split(',').map(k => k.trim()).filter(k => k) : s.keywords) : [],
      notifications: s?.notifications ?? true
    });

    // If no settings exist, return default settings
    if (!settings) {
      const defaultSettings = convertToFrontendFormat(null);

      return new Response(JSON.stringify({
        success: true,
        settings: defaultSettings
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      settings: convertToFrontendFormat(settings)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error getting chat settings:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to get chat settings'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
