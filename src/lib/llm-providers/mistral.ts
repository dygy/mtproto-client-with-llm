// @ts-nocheck
import { BaseLLMProvider, type LLMMessage, type LLMResponse, type LLMProviderConfig, type ModelInfo } from './base.js';

export class MistralProvider extends BaseLLMProvider {
  private models: ModelInfo[] = [
    {
      id: 'mistral-large-latest',
      name: 'Mistral Large',
      description: 'Most advanced model for complex reasoning tasks',
      contextLength: 128000,
      inputCostPer1k: 0.004,
      outputCostPer1k: 0.012,
      supportsStreaming: true
    },
    {
      id: 'mistral-medium-latest',
      name: 'Mistral Medium',
      description: 'Balanced model for most use cases',
      contextLength: 32000,
      inputCostPer1k: 0.0027,
      outputCostPer1k: 0.0081,
      supportsStreaming: true
    },
    {
      id: 'mistral-small-latest',
      name: 'Mistral Small',
      description: 'Fast and efficient model for simple tasks',
      contextLength: 32000,
      inputCostPer1k: 0.001,
      outputCostPer1k: 0.003,
      supportsStreaming: true
    },
    {
      id: 'open-mistral-7b',
      name: 'Open Mistral 7B',
      description: 'Open source model for basic tasks',
      contextLength: 32000,
      inputCostPer1k: 0.00025,
      outputCostPer1k: 0.00025,
      supportsStreaming: true
    },
    {
      id: 'open-mixtral-8x7b',
      name: 'Open Mixtral 8x7B',
      description: 'Open source mixture of experts model',
      contextLength: 32000,
      inputCostPer1k: 0.0007,
      outputCostPer1k: 0.0007,
      supportsStreaming: true
    }
  ];

  constructor(config: LLMProviderConfig) {
    super(config, 'mistral');
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
        throw new Error(`Model ${modelId} is not supported by Mistral provider`);
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
        stream: false
      };

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
