// @ts-nocheck
import type { APIRoute } from 'astro';
import { ChatSettingsStore, type ChatSettings } from '../../lib/database.js';

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    const action = searchParams.get('action') || 'test';
    
    if (action === 'test') {
      // Test basic CRUD operations
      const testSessionId = 'test-session-123';
      const testChatId = 'test-chat-456';
      
      console.log('🧪 Testing SQLite chat settings storage...');
      
      // Test 1: Get default settings (should return defaults)
      console.log('📝 Test 1: Get default settings');
      const defaultSettings = await ChatSettingsStore.getChatSettings(testSessionId, testChatId);
      console.log('Default settings:', defaultSettings);
      
      // Test 2: Save custom settings
      console.log('📝 Test 2: Save custom settings');
      const customSettings: ChatSettings = {
        llmEnabled: true,
        llmProvider: 'openai',
        llmModel: 'gpt-4o-mini',
        llmPrompt: 'You are a helpful trading assistant.',
        autoReply: true,
        keywords: ['crypto', 'bitcoin', 'trading'],
        notifications: false
      };
      
      await ChatSettingsStore.setChatSettings(testSessionId, testChatId, customSettings);
      console.log('Custom settings saved');
      
      // Test 3: Retrieve saved settings
      console.log('📝 Test 3: Retrieve saved settings');
      const retrievedSettings = await ChatSettingsStore.getChatSettings(testSessionId, testChatId);
      console.log('Retrieved settings:', retrievedSettings);
      
      // Test 4: Update settings
      console.log('📝 Test 4: Update settings');
      const updatedSettings: ChatSettings = {
        ...retrievedSettings!,
        llmPrompt: 'Updated prompt for testing',
        keywords: ['updated', 'keywords']
      };
      
      await ChatSettingsStore.setChatSettings(testSessionId, testChatId, updatedSettings);
      const finalSettings = await ChatSettingsStore.getChatSettings(testSessionId, testChatId);
      console.log('Final settings:', finalSettings);
      
      // Test 5: List all settings for session
      console.log('📝 Test 5: List all settings for session');
      const allSettings = await ChatSettingsStore.listChatSettings(testSessionId);
      console.log('All settings for session:', allSettings);
      
      // Test 6: Get LLM-enabled chats
      console.log('📝 Test 6: Get LLM-enabled chats');
      const llmEnabledChats = await ChatSettingsStore.getChatSettingsWithLLMEnabled(testSessionId);
      console.log('LLM-enabled chats:', llmEnabledChats);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'SQLite chat settings test completed successfully',
        results: {
          defaultSettings,
          customSettings,
          retrievedSettings,
          finalSettings,
          allSettings,
          llmEnabledChats
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } else if (action === 'cleanup') {
      // Clean up test data
      console.log('🧹 Cleaning up test data...');
      const testSessionId = 'test-session-123';
      const testChatId = 'test-chat-456';
      
      const deleted = await ChatSettingsStore.deleteChatSettings(testSessionId, testChatId);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Test data cleanup completed. Deleted: ${deleted}`,
        deleted
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid action. Use ?action=test or ?action=cleanup'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('❌ Error in chat settings test:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
