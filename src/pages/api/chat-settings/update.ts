// @ts-nocheck
import type { APIRoute } from 'astro';
import BlobStorage, { type ChatSettings } from '../../../lib/blob-storage.js';

export const POST: APIRoute = async ({ request, redirect }) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let sessionId: string, chatId: string, llmEnabled: boolean, llmProvider: string, llmModel: string, llmPrompt: string, autoReply: boolean, keywords: string[], notifications: boolean;

    if (contentType.includes('application/json')) {
      // Handle JSON requests from React components
      const data = await request.json();
      sessionId = data.sessionId;
      chatId = data.chatId;
      llmEnabled = data.llmEnabled;
      llmProvider = data.llmProvider || 'openai';
      llmModel = data.llmModel || 'gpt-4o-mini';
      llmPrompt = data.llmPrompt || '';
      autoReply = data.autoReply;
      keywords = Array.isArray(data.keywords) ? data.keywords : [];
      notifications = data.notifications;
    } else {
      // Handle FormData requests from traditional forms
      const formData = await request.formData();
      sessionId = formData.get('sessionId') as string;
      chatId = formData.get('chatId') as string;
      llmEnabled = formData.get('llmEnabled') === 'on';
      llmProvider = formData.get('llmProvider') as string || 'openai';
      llmModel = formData.get('llmModel') as string || 'gpt-4o-mini';
      llmPrompt = formData.get('llmPrompt') as string || '';
      autoReply = formData.get('autoReply') === 'on';
      const keywordsStr = formData.get('keywords') as string || '';
      keywords = keywordsStr.split(',').map(k => k.trim()).filter(k => k);
      notifications = formData.get('notifications') === 'on';
    }

    if (!sessionId || !chatId) {
      return new Response('Session ID and Chat ID are required', { status: 400 });
    }

    console.log(`⚙️ Updating chat settings for session ${sessionId}, chat ${chatId}`);
    console.log(`Settings: LLM=${llmEnabled}, Provider=${llmProvider}, Model=${llmModel}, AutoReply=${autoReply}, Keywords="${keywords.join(', ')}"`);

    const settings: ChatSettings = {
      session_id: sessionId,
      chat_id: chatId,
      llm_enabled: llmEnabled,
      llm_provider: llmProvider,
      llm_model: llmModel,
      llm_prompt: llmPrompt,
      auto_reply: autoReply,
      keywords: keywords.join(','),
      notifications
    };

    await BlobStorage.setChatSettings(sessionId, chatId, settings);

    console.log(`✅ Chat settings updated for ${sessionId}/${chatId}`);

    // Return JSON response for API calls, redirect for form submissions
    if (contentType.includes('application/json')) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Settings updated successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Redirect back to chat with settings panel open for form submissions
      return redirect(`/chat?session=${sessionId}&chatId=${chatId}&settings=true`);
    }

  } catch (error) {
    console.error('❌ Error updating chat settings:', error);
    return new Response('Failed to update chat settings', { status: 500 });
  }
};
