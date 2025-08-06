// @ts-nocheck
// Base LLM Provider Interface and Types

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  success: boolean;
  content?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  provider?: string;
}

export interface LLMProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  supportsStreaming: boolean;
}

export abstract class BaseLLMProvider {
  protected config: LLMProviderConfig;
  protected providerName: string;

  constructor(config: LLMProviderConfig, providerName: string) {
    this.config = config;
    this.providerName = providerName;
  }

  abstract getAvailableModels(): ModelInfo[];
  abstract isModelSupported(modelId: string): boolean;
  abstract generateResponse(
    messages: LLMMessage[],
    modelId: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      stream?: boolean;
    }
  ): Promise<LLMResponse>;

  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error(`API key is required for ${this.providerName} provider`);
    }
  }

  protected handleError(error: any): LLMResponse {
    console.error(`❌ ${this.providerName} provider error:`, error);
    
    let errorMessage = 'Unknown error occurred';
    
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
      provider: this.providerName
    };
  }

  getProviderName(): string {
    return this.providerName;
  }
}
