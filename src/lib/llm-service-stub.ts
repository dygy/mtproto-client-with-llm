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

export class LLMService {
  static async getChatSettings(sessionId: string, chatId: string): Promise<ChatSettings | null> {
    console.warn('⚠️ LLM Service not yet fully implemented with Blob storage');
    return null;
  }

  static async shouldProcessMessage(sessionId: string, chatId: string, message: string): Promise<boolean> {
    return false;
  }

  static async processMessage(sessionId: string, chatId: string, message: any): Promise<string | null> {
    console.warn('⚠️ LLM processing not available');
    return null;
  }

  static async saveLLMResult(data: any): Promise<void> {
    console.warn('⚠️ LLM result saving not available');
  }

  static async getLLMStats(sessionId: string): Promise<any> {
    return {
      totalProcessed: 0,
      byProvider: {},
      byModel: {},
      avgProcessingTime: 0
    };
  }
}

export default LLMService;

