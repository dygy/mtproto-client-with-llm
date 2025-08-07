// @ts-nocheck
import { BaseLLMProvider, type LLMMessage, type LLMResponse, type LLMProviderConfig, type ModelInfo } from './base.js';

export interface CustomLLMConfig extends LLMProviderConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  requestFormat?: 'openai' | 'custom';
  responseFormat?: 'openai' | 'custom';
  customRequestTemplate?: string;
  customResponsePath?: string;
}

export class CustomLLMProvider extends BaseLLMProvider {
  private customConfig: CustomLLMConfig;
  private models: ModelInfo[] = [
    {
      id: 'custom-model',
      name: 'Custom Model',
      description: 'User-configured custom LLM model',
      contextLength: 4096,
      inputCostPer1k: 0,
      outputCostPer1k: 0,
      supportsStreaming: false
    }
  ];

  constructor(config: CustomLLMConfig) {
    super(config, 'custom');
    this.customConfig = config;
    this.validateCustomConfig();
  }

  private validateCustomConfig(): void {
    if (!this.customConfig.baseUrl) {
      throw new Error('Base URL is required for custom LLM provider');
    }

    try {
      new URL(this.customConfig.baseUrl);
    } catch (error) {
      throw new Error('Invalid base URL provided for custom LLM provider');
    }
  }

  // Override base validation to not require API key
  protected validateConfig(): void {
    // Custom provider doesn't require API key - it's optional
    // Base URL validation is handled in validateCustomConfig
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
        throw new Error(`Model ${modelId} is not supported by custom provider`);
      }

      const requestBody = this.buildRequestBody(messages, modelId, options);
      const headers = this.buildHeaders();

      console.log('🔧 Custom LLM Request:', {
        url: this.customConfig.baseUrl,
        headers: Object.keys(headers),
        bodyPreview: JSON.stringify(requestBody).substring(0, 200)
      });

      const response = await fetch(this.customConfig.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.customConfig.timeout || 30000)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const content = this.extractContent(data);

      return {
        success: true,
        content,
        model: modelId,
        provider: this.providerName,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  private buildRequestBody(
    messages: LLMMessage[],
    modelId: string,
    options: any
  ): any {
    const format = this.customConfig.requestFormat || 'openai';

    if (format === 'openai') {
      return {
        model: modelId,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        top_p: options.topP ?? 1
      };
    }

    // Custom format using template
    if (this.customConfig.customRequestTemplate) {
      try {
        const template = JSON.parse(this.customConfig.customRequestTemplate);
        const userMessage = messages.find(msg => msg.role === 'user')?.content || '';
        const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';
        
        // Replace placeholders in template
        const requestBody = JSON.parse(JSON.stringify(template)
          .replace(/\{\{user_message\}\}/g, userMessage)
          .replace(/\{\{system_message\}\}/g, systemMessage)
          .replace(/\{\{model\}\}/g, modelId)
          .replace(/\{\{temperature\}\}/g, (options.temperature ?? 0.7).toString())
          .replace(/\{\{max_tokens\}\}/g, (options.maxTokens ?? 1000).toString())
        );
        
        return requestBody;
      } catch (error) {
        console.error('Error parsing custom request template:', error);
        // Fallback to simple format
        return {
          prompt: messages.map(msg => `${msg.role}: ${msg.content}`).join('\n'),
          model: modelId
        };
      }
    }

    // Default simple format
    return {
      prompt: messages.map(msg => `${msg.role}: ${msg.content}`).join('\n'),
      model: modelId,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1000
    };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add API key if provided
    if (this.customConfig.apiKey) {
      headers['Authorization'] = `Bearer ${this.customConfig.apiKey}`;
    }

    // Add custom headers
    if (this.customConfig.headers) {
      Object.assign(headers, this.customConfig.headers);
    }

    return headers;
  }

  private extractContent(data: any): string {
    const format = this.customConfig.responseFormat || 'openai';

    if (format === 'openai') {
      return data.choices?.[0]?.message?.content || 
             data.choices?.[0]?.text || 
             'No response content found';
    }

    // Custom format using path
    if (this.customConfig.customResponsePath) {
      try {
        const path = this.customConfig.customResponsePath.split('.');
        let result = data;
        
        for (const key of path) {
          if (result && typeof result === 'object' && key in result) {
            result = result[key];
          } else {
            throw new Error(`Path ${this.customConfig.customResponsePath} not found in response`);
          }
        }
        
        return typeof result === 'string' ? result : JSON.stringify(result);
      } catch (error) {
        console.error('Error extracting content using custom path:', error);
        return 'Error extracting response content';
      }
    }

    // Try common response formats
    if (data.response) return data.response;
    if (data.text) return data.text;
    if (data.content) return data.content;
    if (data.output) return data.output;
    if (data.result) return data.result;

    // Fallback to stringified response
    return JSON.stringify(data);
  }
}
