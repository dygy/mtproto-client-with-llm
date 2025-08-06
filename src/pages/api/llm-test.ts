// @ts-nocheck
import type { APIRoute } from 'astro';
import { LLMProviderRegistry, type LLMMessage } from '../../lib/llm-providers/index.js';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data', 'sessions.db');

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { provider, model, prompt, originalPrompt, messageId, sessionId, chatId } = data;

    // Validate required fields
    if (!provider || !model || !prompt) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Provider, model, and prompt are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`🧪 Testing LLM: ${provider}/${model} for message ${messageId}`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

    // Get the provider instance
    const llmProvider = LLMProviderRegistry.getProvider(provider);
    
    if (!llmProvider) {
      return new Response(JSON.stringify({
        success: false,
        message: `Provider ${provider} is not available or not configured. Please check your API key configuration.`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if model is supported
    if (!llmProvider.isModelSupported(model)) {
      const availableModels = llmProvider.getAvailableModels().map(m => m.id);
      return new Response(JSON.stringify({
        success: false,
        message: `Model ${model} is not supported by ${provider}. Available models: ${availableModels.join(', ')}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prepare messages for the LLM
    const messages: LLMMessage[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    const startTime = Date.now();

    try {
      // Call the provider
      const response = await llmProvider.generateResponse(messages, model, {
        temperature: 0.7,
        maxTokens: 1000
      });

      const processingTime = Date.now() - startTime;

      if (!response.success) {
        console.error(`❌ LLM provider error:`, response.error);

        // Save error to database
        try {
          const db = new Database(dbPath);
          try {
            db.exec(`
              CREATE TABLE IF NOT EXISTS llm_processing (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                chat_id TEXT NOT NULL,
                message_id INTEGER NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt TEXT NOT NULL,
                original_prompt TEXT,
                response TEXT,
                error TEXT,
                processing_time INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(session_id, chat_id, message_id, provider, model)
              )
            `);

            const stmt = db.prepare(`
              INSERT OR REPLACE INTO llm_processing
              (session_id, chat_id, message_id, provider, model, prompt, original_prompt, error, processing_time)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
              sessionId,
              chatId,
              messageId,
              provider,
              model,
              prompt,
              originalPrompt || prompt,
              response.error,
              Date.now() - startTime
            );
          } finally {
            db.close();
          }
        } catch (dbError) {
          console.error('❌ Error saving LLM error to database:', dbError);
        }

        return new Response(JSON.stringify({
          success: false,
          message: response.error || 'LLM provider returned an error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ LLM test completed in ${processingTime}ms`);
      console.log(`📤 Response: ${response.content?.substring(0, 100)}...`);

      // Save result to database
      try {
        const db = new Database(dbPath);

        try {
          // Ensure the table exists
          db.exec(`
            CREATE TABLE IF NOT EXISTS llm_processing (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              session_id TEXT NOT NULL,
              chat_id TEXT NOT NULL,
              message_id INTEGER NOT NULL,
              provider TEXT NOT NULL,
              model TEXT NOT NULL,
              prompt TEXT NOT NULL,
              original_prompt TEXT,
              response TEXT,
              error TEXT,
              processing_time INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(session_id, chat_id, message_id, provider, model)
            )
          `);

          // Insert or replace the result
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO llm_processing
            (session_id, chat_id, message_id, provider, model, prompt, original_prompt, response, processing_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          stmt.run(
            sessionId,
            chatId,
            messageId,
            provider,
            model,
            prompt,
            originalPrompt || prompt,
            response.content,
            processingTime
          );

          console.log(`💾 Saved LLM result to database for message ${messageId}`);

        } finally {
          db.close();
        }
      } catch (dbError) {
        console.error('❌ Error saving LLM result to database:', dbError);
        // Don't fail the request if database save fails
      }

      // Return successful result
      return new Response(JSON.stringify({
        success: true,
        result: {
          content: response.content,
          usage: response.usage,
          model: response.model,
          provider: response.provider,
          processingTime,
          timestamp: new Date().toISOString()
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (providerError) {
      console.error(`❌ Provider call failed:`, providerError);
      
      return new Response(JSON.stringify({
        success: false,
        message: `Provider call failed: ${providerError instanceof Error ? providerError.message : 'Unknown error'}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Error in LLM test endpoint:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
