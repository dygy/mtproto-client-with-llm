// @ts-nocheck
import type { APIRoute } from 'astro';
import { ChatSettingsStore } from '../../../../lib/database.js';

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

    const settings = await ChatSettingsStore.getChatSettings(sessionId, chatId);

    if (settings) {
      return new Response(JSON.stringify({
        success: true,
        settings: settings
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to get chat settings'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
