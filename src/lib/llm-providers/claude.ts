// @ts-nocheck
import { BaseLLMProvider, type LLMMessage, type LLMResponse, type LLMProviderConfig, type ModelInfo } from './base.js';

export class ClaudeProvider extends BaseLLMProvider {
  private models: ModelInfo[] = [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      description: 'Most intelligent model with best performance on complex tasks',
      contextLength: 200000,
      inputCostPer1k: 0.003,
      outputCostPer1k: 0.015,
      supportsStreaming: true
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      description: 'Fastest model for everyday tasks',
      contextLength: 200000,
      inputCostPer1k: 0.00025,
      outputCostPer1k: 0.00125,
      supportsStreaming: true
    },
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      description: 'Most powerful model for highly complex tasks',
      contextLength: 200000,
      inputCostPer1k: 0.015,
      outputCostPer1k: 0.075,
      supportsStreaming: true
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      description: 'Balanced model for a wide range of tasks',
      contextLength: 200000,
      inputCostPer1k: 0.003,
      outputCostPer1k: 0.015,
      supportsStreaming: true
    }
  ];

  constructor(config: LLMProviderConfig) {
    super(config, 'claude');
    this.validateConfig();
  }

  getAvailableModels(): ModelInfo[] {
    return this.models;
  }

  isModelSupported(modelId: string): boolean {
    return this.models.some(model => model.id === modelId);
  }

  async generateResponse(
    messages: LLMMessage[],
    modelId: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      stream?: boolean;
    } = {}
  ): Promise<LLMResponse> {
    try {
      if (!this.isModelSupported(modelId)) {
        throw new Error(`Model ${modelId} is not supported by Claude provider`);
      }

      // Convert messages to Claude format
      const systemMessage = messages.find(msg => msg.role === 'system');
      const conversationMessages = messages.filter(msg => msg.role !== 'system');

      const requestBody = {
        model: modelId,
        max_tokens: options.maxTokens ?? 1000,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP ?? 1,
        messages: conversationMessages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        })),
        ...(systemMessage && { system: systemMessage.content })
      };

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        content: data.content[0]?.text || '',
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        },
        model: modelId,
        provider: this.providerName
      };

    } catch (error) {
      return this.handleError(error);
    }
  }
}
