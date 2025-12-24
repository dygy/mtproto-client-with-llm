// @ts-nocheck
/**
 * LLM Service - Full implementation with Vercel Blob storage and LLM providers
 */
import BlobStorage from './blob-storage.js';
import { LLMProviderRegistry } from './llm-providers/registry.js';
import { CustomLLMProvider } from './llm-providers/custom.js';
import type { LLMMessage } from './llm-providers/base.js';

export interface ChatSettings {
  llmEnabled: boolean;
  llmProvider: string;
  llmModel: string;
  llmPrompt: string;
  autoReply: boolean;
  keywords: string[];
  notifications: boolean;
  customLLMConfig?: any;
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
  constructor() {
    // No initialization needed
  }

  async getChatSettings(sessionId: string, chatId: string): Promise<ChatSettings | null> {
    try {
      const settings = await BlobStorage.getChatSettings(sessionId, chatId);
      if (!settings) {
        return null;
      }

      // Convert BlobStorage format to ChatSettings format
      return {
        llmEnabled: settings.llm_enabled ?? false,
        llmProvider: settings.llm_provider ?? 'openai',
        llmModel: settings.llm_model ?? 'gpt-4o-mini',
        llmPrompt: settings.llm_prompt ?? '',
        autoReply: settings.auto_reply ?? false,
        keywords: settings.keywords ? (typeof settings.keywords === 'string' ? settings.keywords.split(',').map(k => k.trim()).filter(k => k) : settings.keywords) : [],
        notifications: settings.notifications ?? true,
        customLLMConfig: settings.custom_llm_config
      };
    } catch (error) {
      console.error('❌ Error getting chat settings:', error);
      return null;
    }
  }

  shouldProcessMessage(message: string, settings: ChatSettings): boolean {
    if (!settings || !settings.llmEnabled) {
      return false;
    }

    // If no keywords specified, process all messages
    if (!settings.keywords || settings.keywords.length === 0) {
      return true;
    }

    // Check if message contains any of the keywords
    const messageLower = message.toLowerCase();
    return settings.keywords.some(keyword =>
      messageLower.includes(keyword.toLowerCase())
    );
  }

  async processMessage(context: MessageContext, settings?: ChatSettings): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // Get settings if not provided
      if (!settings) {
        settings = await this.getChatSettings(context.sessionId, context.chatId);
      }

      // Check if LLM is enabled for this chat
      if (!settings || !settings.llmEnabled) {
        return {
          success: false,
          error: 'LLM not enabled for this chat'
        };
      }

      // Check if we should process this message
      if (!this.shouldProcessMessage(context.message, settings)) {
        return {
          success: false,
          error: 'Message does not match keywords'
        };
      }

      // Get the LLM provider
      let provider;
      if (settings.llmProvider === 'custom' && settings.customLLMConfig) {
        // Create custom provider instance
        provider = new CustomLLMProvider({
          apiKey: settings.customLLMConfig.apiKey || '',
          timeout: 30000,
          maxRetries: 3
        }, settings.customLLMConfig);
      } else {
        // Get provider from registry
        provider = LLMProviderRegistry.getProvider(settings.llmProvider);
      }

      if (!provider) {
        return {
          success: false,
          error: `Provider ${settings.llmProvider} not available or not configured`
        };
      }

      // Process the prompt template
      const processedPrompt = this.processPromptTemplate(settings.llmPrompt, context);

      // Create messages for LLM
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: processedPrompt
        },
        {
          role: 'user',
          content: context.message
        }
      ];

      // Generate response
      const llmResponse = await provider.generateResponse(messages, settings.llmModel, {
        temperature: 0.7,
        maxTokens: 1000
      });

      if (!llmResponse.success) {
        return {
          success: false,
          error: llmResponse.error || 'LLM generation failed'
        };
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        response: llmResponse.content,
        shouldReply: settings.autoReply,
        processingTime,
        provider: settings.llmProvider,
        model: settings.llmModel
      };

    } catch (error) {
      console.error('❌ Error in LLM processing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  private processPromptTemplate(template: string, context: MessageContext): string {
    return template
      .replace(/\{message\}/g, context.message)
      .replace(/\{sender\}/g, context.sender)
      .replace(/\{chat\}/g, context.chat)
      .replace(/\{timestamp\}/g, new Date(context.timestamp * 1000).toISOString());
  }

  async saveLLMResult(data: any): Promise<void> {
    console.warn('⚠️ LLM result saving not yet implemented');
    // TODO: Implement if needed for analytics
  }

  async getLLMStats(sessionId: string): Promise<any> {
    return {
      totalProcessed: 0,
      byProvider: {},
      byModel: {},
      avgProcessingTime: 0
    };
  }
}

// Export singleton instance for backward compatibility
export const llmService = new LLMService();

export default LLMService;

