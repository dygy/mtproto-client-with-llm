// @ts-nocheck
import Database from 'better-sqlite3';
import path from 'path';
import type { ChatSettingsRow, LLMStatsRow } from '../types/database.js';
import { LLMProviderRegistry, type LLMMessage } from './llm-providers/index.js';

const dbPath = path.join(process.cwd(), 'data', 'sessions.db');

export interface ChatSettings {
  llmEnabled: boolean;
  llmProvider: string;
  llmModel: string;
  llmPrompt: string;
  autoReply: boolean;
  keywords: string[];
  notifications: boolean;
  customLLMConfig?: {
    baseUrl: string;
    apiKey?: string;
    headers?: Record<string, string>;
    requestFormat?: 'openai' | 'custom';
    responseFormat?: 'openai' | 'custom';
    customRequestTemplate?: string;
    customResponsePath?: string;
  };
}

export interface MessageContext {
  messageId?: string;
  message: string;
  sender: string;
  senderId: string;
  chat: string;
  chatId: string;
  sessionId: string;
  timestamp: number;
}

export interface LLMResponse {
  success: boolean;
  response?: string;
  shouldReply?: boolean;
  error?: string;
  processingTime?: number;
  provider?: string;
  model?: string;
}

export class LLMService {
  private db: Database.Database;

  constructor() {
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables() {
    // Create LLM processing log table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS llm_processing_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        original_message TEXT NOT NULL,
        llm_prompt TEXT NOT NULL,
        llm_response TEXT,
        processing_time_ms INTEGER,
        success BOOLEAN DEFAULT FALSE,
        error_message TEXT,
        auto_replied BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create LLM statistics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS llm_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        total_processed INTEGER DEFAULT 0,
        total_replied INTEGER DEFAULT 0,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(session_id, chat_id)
      )
    `);
  }

  async getChatSettings(sessionId: string, chatId: string): Promise<ChatSettings | null> {
    try {
      console.log('🔍 Getting chat settings for:', { sessionId, chatId });
      const stmt = this.db.prepare(`
        SELECT * FROM chat_settings
        WHERE session_id = ? AND chat_id = ?
      `);

      const settings = stmt.get(sessionId, chatId) as ChatSettingsRow | undefined;
      console.log('🔍 Raw settings from DB:', settings);

      if (settings) {
        let customLLMConfig;
        try {
          customLLMConfig = settings.custom_llm_config ? JSON.parse(settings.custom_llm_config) : undefined;
        } catch (error) {
          console.warn('Failed to parse custom LLM config:', error);
          customLLMConfig = undefined;
        }

        const chatSettings = {
          llmEnabled: Boolean(settings.llm_enabled),
          llmProvider: settings.llm_provider || 'openai',
          llmModel: settings.llm_model || 'gpt-4o-mini',
          llmPrompt: settings.llm_prompt || '',
          autoReply: Boolean(settings.auto_reply),
          keywords: settings.keywords ? settings.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k) : [],
          notifications: Boolean(settings.notifications),
          customLLMConfig
        };
        console.log('🔍 Processed chat settings:', chatSettings);
        return chatSettings;
      }

      console.log('🔍 No settings found for chat');
      return null;
    } catch (error) {
      console.error('Error getting chat settings:', error);
      return null;
    }
  }

  shouldProcessMessage(message: string, settings: ChatSettings): boolean {
    console.log('🔍 Checking if should process message:', {
      llmEnabled: settings.llmEnabled,
      keywords: settings.keywords,
      messagePreview: message.substring(0, 50)
    });

    if (!settings.llmEnabled) {
      console.log('🔍 LLM not enabled for this chat');
      return false;
    }

    // If keywords are specified, check if message contains any of them
    if (settings.keywords.length > 0) {
      const messageText = message.toLowerCase();
      const hasKeyword = settings.keywords.some(keyword =>
        messageText.includes(keyword.toLowerCase())
      );
      console.log('🔍 Keyword check:', { hasKeyword, keywords: settings.keywords });
      return hasKeyword;
    }

    // If no keywords specified, process all messages
    console.log('🔍 No keywords specified, processing message');
    return true;
  }

  buildPrompt(template: string, context: MessageContext): string {
    console.log(`💭 Building prompt with context:`, {
      message: context.message?.substring(0, 100),
      sender: context.sender,
      chat: context.chat,
      senderId: context.senderId,
      chatId: context.chatId,
      timestamp: context.timestamp
    });

    // First, replace context variables in the template
    let processedPrompt = template
      .replace(/{sender}/g, context.sender || 'Unknown')
      .replace(/{chat}/g, context.chat || 'Unknown Chat')
      .replace(/{senderId}/g, context.senderId || 'unknown')
      .replace(/{chatId}/g, context.chatId || 'unknown')
      .replace(/{timestamp}/g, new Date(context.timestamp * 1000).toISOString());

    // Handle {message} replacement - if template contains {message}, replace it
    // Otherwise, append the message to the end of the prompt
    if (template.includes('{message}')) {
      processedPrompt = processedPrompt.replace(/{message}/g, context.message || '');
      console.log(`💭 Template contained {message} placeholder - replaced with message content`);
    } else {
      // Append the user message to the custom prompt
      processedPrompt = `${processedPrompt}\n\nUSER MESSAGE:\n${context.message || ''}`;
      console.log(`💭 Template did not contain {message} placeholder - appended message to end`);
    }

    console.log(`💭 Prompt template: "${template}"`);
    console.log(`💭 Processed prompt: "${processedPrompt}"`);
    return processedPrompt;
  }

  async processMessage(context: MessageContext): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Processing message from ${context.sender} in ${context.chat}`);
      
      // Get chat settings
      const settings = await this.getChatSettings(context.sessionId, context.chatId);

      if (!settings) {
        console.log(`⏭️ No chat settings found for session ${context.sessionId}, chat ${context.chatId}`);
        return { success: false, error: 'No chat settings found' };
      }

      if (!this.shouldProcessMessage(context.message, settings)) {
        console.log(`⏭️ Skipping message processing (disabled or no keyword match)`);
        return { success: false, error: 'Processing disabled or no keyword match' };
      }

      // Check if we already have a result for this message (persistent storage)
      const { LLMResultsStore } = await import('./database.js');
      const messageId = context.messageId ? parseInt(context.messageId) : 0;
      const existingResult = await LLMResultsStore.getLLMResult(
        parseInt(context.senderId),
        messageId,
        parseInt(context.chatId)
      );

      if (existingResult) {
        console.log(`📋 Found existing LLM result for message ${context.messageId}`);
        return {
          success: true,
          response: existingResult.llm_response || '',
          shouldReply: false, // Don't auto-reply for existing results to prevent duplicates
          processingTime: existingResult.processing_time_ms || 0,
          provider: existingResult.llm_provider || 'unknown',
          model: existingResult.llm_model || 'unknown'
        };
      }

      // Build the prompt
      const prompt = this.buildPrompt(settings.llmPrompt, context);
      console.log(`📝 Built prompt: ${prompt.substring(0, 100)}...`);

      // Call the configured LLM provider
      const llmResponse = await this.callLLMProvider(prompt, settings.llmProvider, settings.llmModel, settings.customLLMConfig);

      const processingTime = Date.now() - startTime;

      // Save the result to persistent storage
      try {
        if (messageId > 0) {
          await LLMResultsStore.saveLLMResult(
            parseInt(context.senderId),
            messageId,
            parseInt(context.chatId),
            prompt,
            settings.llmProvider,
            settings.llmModel,
            llmResponse,
            processingTime
          );

          // Broadcast the new result to stream clients
          try {
            const { broadcastLLMResult } = await import('../pages/api/llm-results/stream.js');
            broadcastLLMResult({
              id: Date.now(), // We don't have the actual DB ID, use timestamp
              messageId: messageId,
              chatId: parseInt(context.chatId),
              sessionId: context.sessionId,
              userId: parseInt(context.senderId),
              provider: settings.llmProvider,
              model: settings.llmModel,
              response: llmResponse,
              prompt: prompt,
              processingTime: processingTime,
              chatTitle: context.chat,
              createdAt: new Date().toISOString()
            });
          } catch (broadcastError) {
            console.warn('⚠️ Failed to broadcast LLM result:', broadcastError);
            // Don't fail the main process if broadcast fails
          }
        }
      } catch (saveError) {
        console.error('❌ Error saving LLM result to database:', saveError);
        // Continue processing even if save fails
      }

      // Log the processing
      this.logProcessing(context, prompt, llmResponse, processingTime, true);

      // Update statistics
      this.updateStats(context.sessionId, context.chatId);

      console.log(`✅ LLM processing completed in ${processingTime}ms using ${settings.llmProvider}/${settings.llmModel}`);

      return {
        success: true,
        response: llmResponse,
        shouldReply: settings.autoReply,
        processingTime,
        provider: settings.llmProvider,
        model: settings.llmModel
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Error processing message with LLM:', error);
      
      // Log the error
      this.logProcessing(context, '', '', processingTime, false, error instanceof Error ? error.message : 'Unknown error');
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      };
    }
  }

  private async callLLMProvider(prompt: string, provider: string, model: string, customConfig?: any): Promise<string> {
    try {
      let llmProvider;

      if (provider === 'custom' && customConfig) {
        // Create custom provider instance with user configuration
        const { CustomLLMProvider } = await import('./llm-providers/custom.js');
        llmProvider = new CustomLLMProvider(customConfig);
      } else {
        // Get the standard provider instance
        llmProvider = LLMProviderRegistry.getProvider(provider);
      }

      if (!llmProvider) {
        throw new Error(`Provider ${provider} is not available or not configured`);
      }

      // Prepare messages for the LLM
      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: prompt
        }
      ];

      // Call the provider
      const response = await llmProvider.generateResponse(messages, model, {
        temperature: 0.7,
        maxTokens: 1000
      });

      if (!response.success) {
        throw new Error(response.error || 'LLM provider returned an error');
      }

      return response.content || 'No response generated';

    } catch (error) {
      console.error(`❌ Error calling LLM provider ${provider}:`, error);

      // Fallback to mock response for now
      return this.mockLLMCall(prompt);
    }
  }

  private async mockLLMCall(prompt: string): Promise<string> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Return a mock response based on the prompt content
    if (prompt.toLowerCase().includes('crypto') || prompt.toLowerCase().includes('trading')) {
      return "Based on the trading signal analysis, this appears to be a short-term position with moderate risk. Market sentiment suggests caution due to current volatility. Consider position sizing and stop-loss levels.";
    } else if (prompt.toLowerCase().includes('btc') || prompt.toLowerCase().includes('bitcoin')) {
      return "Bitcoin analysis indicates potential consolidation phase. Monitor key support/resistance levels and volume patterns for next directional move.";
    } else {
      return "Message processed successfully. This is a mock LLM response that will be replaced with actual AI integration in the future.";
    }
  }

  private logProcessing(
    context: MessageContext,
    prompt: string,
    response: string,
    processingTime: number,
    success: boolean,
    error?: string
  ) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO llm_processing_log (
          session_id, chat_id, message_id, original_message, llm_prompt,
          llm_response, processing_time_ms, success, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      // Use the actual message ID if available, otherwise create a fallback
      const messageId = context.messageId || `${context.timestamp}_${context.senderId}`;

      // Only log if we have a real message ID (not a timestamp-based fallback)
      if (context.messageId) {
        stmt.run(
          context.sessionId,
          context.chatId,
          messageId,
          context.message,
          prompt,
          response,
          processingTime,
          success ? 1 : 0,
          error || null
        );
      }
    } catch (logError) {
      console.error('❌ Error logging LLM processing:', logError);
    }
  }

  private updateStats(sessionId: string, chatId: string) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO llm_stats (session_id, chat_id, total_processed, last_activity)
        VALUES (?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id, chat_id) DO UPDATE SET
          total_processed = total_processed + 1,
          last_activity = CURRENT_TIMESTAMP
      `);
      
      stmt.run(sessionId, chatId);
    } catch (error) {
      console.error('❌ Error updating LLM stats:', error);
    }
  }

  async getProcessingStats(sessionId: string, chatId: string) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM llm_stats 
        WHERE session_id = ? AND chat_id = ?
      `);
      
      const stats = stmt.get(sessionId, chatId) as LLMStatsRow | undefined;

      return stats ? {
        totalProcessed: stats.total_processed,
        totalReplied: stats.total_replied,
        lastActivity: stats.last_activity
      } : {
        totalProcessed: 0,
        totalReplied: 0,
        lastActivity: null
      };
    } catch (error) {
      console.error('❌ Error getting processing stats:', error);
      return { totalProcessed: 0, totalReplied: 0, lastActivity: null };
    }
  }

  async getProcessingHistory(sessionId: string, chatId: string, limit: number = 50) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM llm_processing_log 
        WHERE session_id = ? AND chat_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      return stmt.all(sessionId, chatId, limit);
    } catch (error) {
      console.error('Error getting processing history:', error);
      return [];
    }
  }

  close() {
    this.db.close();
  }
}

// Export singleton instance
export const llmService = new LLMService();
