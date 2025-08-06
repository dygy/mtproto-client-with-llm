// @ts-nocheck
import { BaseLLMProvider, type LLMMessage, type LLMResponse, type LLMProviderConfig, type ModelInfo } from './base.js';

export class OpenAIProvider extends BaseLLMProvider {
  private models: ModelInfo[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'Most advanced GPT-4 model with vision capabilities',
      contextLength: 128000,
      inputCostPer1k: 0.005,
      outputCostPer1k: 0.015,
      supportsStreaming: true
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      description: 'Faster, cheaper GPT-4 model',
      contextLength: 128000,
      inputCostPer1k: 0.00015,
      outputCostPer1k: 0.0006,
      supportsStreaming: true
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      description: 'High-performance GPT-4 model',
      contextLength: 128000,
      inputCostPer1k: 0.01,
      outputCostPer1k: 0.03,
      supportsStreaming: true
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and efficient model for most tasks',
      contextLength: 16385,
      inputCostPer1k: 0.0005,
      outputCostPer1k: 0.0015,
      supportsStreaming: true
    }
  ];

  constructor(config: LLMProviderConfig) {
    super(config, 'openai');
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
        throw new Error(`Model ${modelId} is not supported by OpenAI provider`);
      }

      const requestBody = {
        model: modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        top_p: options.topP ?? 1,
        stream: false // For now, disable streaming
      };

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
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
        content: data.choices[0]?.message?.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        },
        model: modelId,
        provider: this.providerName
      };

    } catch (error) {
      return this.handleError(error);
    }
  }
}
