// @ts-nocheck
import { BaseLLMProvider, type LLMMessage, type LLMResponse, type LLMProviderConfig, type ModelInfo } from './base.js';

export class GeminiProvider extends BaseLLMProvider {
  private models: ModelInfo[] = [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Most capable model for complex reasoning and long context',
      contextLength: 2000000,
      inputCostPer1k: 0.00125,
      outputCostPer1k: 0.005,
      supportsStreaming: true
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Fast and efficient model for most tasks',
      contextLength: 1000000,
      inputCostPer1k: 0.000075,
      outputCostPer1k: 0.0003,
      supportsStreaming: true
    },
    {
      id: 'gemini-1.0-pro',
      name: 'Gemini 1.0 Pro',
      description: 'Balanced model for general use',
      contextLength: 30720,
      inputCostPer1k: 0.0005,
      outputCostPer1k: 0.0015,
      supportsStreaming: true
    }
  ];

  constructor(config: LLMProviderConfig) {
    super(config, 'gemini');
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
        throw new Error(`Model ${modelId} is not supported by Gemini provider`);
      }

      // Convert messages to Gemini format
      const contents = [];
      let systemInstruction = '';

      for (const message of messages) {
        if (message.role === 'system') {
          systemInstruction = message.content;
        } else {
          contents.push({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }]
          });
        }
      }

      const requestBody = {
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 1000,
          topP: options.topP ?? 1
        },
        ...(systemInstruction && {
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          }
        })
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response generated');
      }

      const candidate = data.candidates[0];
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Response blocked due to safety filters');
      }

      const content = candidate.content?.parts?.[0]?.text || '';
      
      return {
        success: true,
        content,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0
        },
        model: modelId,
        provider: this.providerName
      };

    } catch (error) {
      return this.handleError(error);
    }
  }
}
