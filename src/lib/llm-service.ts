// @ts-nocheck
/**
 * LLM Service Stub - Placeholder for LLM functionality
 * Full implementation with Vercel Blob storage coming soon
 */

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
    console.warn('⚠️ LLM Service not yet fully implemented with Blob storage');
    return null;
  }

  shouldProcessMessage(message: string, settings: ChatSettings): boolean {
    return false;
  }

  async processMessage(context: MessageContext, settings: ChatSettings): Promise<LLMResponse> {
    return {
      success: false,
      error: 'LLM processing not available - Blob storage implementation pending'
    };
  }

  async saveLLMResult(data: any): Promise<void> {
    console.warn('⚠️ LLM result saving not available');
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

