// @ts-nocheck
import { BaseLLMProvider, type LLMProviderConfig, type ModelInfo } from './base.js';
import { OpenAIProvider } from './openai.js';
import { ClaudeProvider } from './claude.js';
import { MistralProvider } from './mistral.js';
import { GeminiProvider } from './gemini.js';
import { CustomLLMProvider } from './custom.js';

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  website: string;
  requiresApiKey: boolean;
  envKeyName: string;
  isCustom?: boolean;
}

export class LLMProviderRegistry {
  private static providers: Map<string, typeof BaseLLMProvider> = new Map();
  private static instances: Map<string, BaseLLMProvider> = new Map();

  static {
    // Register all available providers
    this.providers.set('openai', OpenAIProvider as any);
    this.providers.set('claude', ClaudeProvider as any);
    this.providers.set('mistral', MistralProvider as any);
    this.providers.set('gemini', GeminiProvider as any);
    this.providers.set('custom', CustomLLMProvider as any);
  }

  static getProviderInfo(): ProviderInfo[] {
    return [
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT models from OpenAI',
        website: 'https://openai.com',
        requiresApiKey: true,
        envKeyName: 'OPENAI_API_KEY'
      },
      {
        id: 'claude',
        name: 'Anthropic Claude',
        description: 'Claude models from Anthropic',
        website: 'https://anthropic.com',
        requiresApiKey: true,
        envKeyName: 'ANTHROPIC_API_KEY'
      },
      {
        id: 'mistral',
        name: 'Mistral AI',
        description: 'Mistral and Mixtral models',
        website: 'https://mistral.ai',
        requiresApiKey: true,
        envKeyName: 'MISTRAL_API_KEY'
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Gemini models from Google',
        website: 'https://ai.google.dev',
        requiresApiKey: true,
        envKeyName: 'GEMINI_API_KEY'
      },
      {
        id: 'custom',
        name: 'Custom LLM',
        description: 'User-configured custom LLM endpoint',
        website: '',
        requiresApiKey: false,
        envKeyName: '',
        isCustom: true
      }
    ];
  }

  static getAvailableProviders(): string[] {
    const availableProviders: string[] = [];

    for (const [providerId, _] of this.providers) {
      if (this.isProviderConfigured(providerId)) {
        availableProviders.push(providerId);
      }
    }

    return availableProviders;
  }

  static isProviderConfigured(providerId: string): boolean {
    const providerInfo = this.getProviderInfo().find(p => p.id === providerId);
    if (!providerInfo) return false;

    // Custom provider doesn't require environment variables
    if (providerInfo.isCustom) {
      return true;
    }

    const apiKey = process.env[providerInfo.envKeyName];
    return Boolean(apiKey && apiKey.trim());
  }

  static getProvider(providerId: string): BaseLLMProvider | null {
    // Custom provider is handled differently - don't cache it since each instance has different config
    if (providerId === 'custom') {
      console.warn('⚠️ Custom provider should be instantiated directly with user config, not through registry');
      return null;
    }

    // Return cached instance if available
    if (this.instances.has(providerId)) {
      return this.instances.get(providerId)!;
    }

    // Check if provider is registered
    const ProviderClass = this.providers.get(providerId);
    if (!ProviderClass) {
      console.error(`❌ Provider ${providerId} is not registered`);
      return null;
    }

    // Check if provider is configured
    if (!this.isProviderConfigured(providerId)) {
      console.error(`❌ Provider ${providerId} is not configured (missing API key)`);
      return null;
    }

    try {
      // Get API key from environment
      const providerInfo = this.getProviderInfo().find(p => p.id === providerId);
      const apiKey = process.env[providerInfo!.envKeyName]!;

      // Create provider config
      const config: LLMProviderConfig = {
        apiKey,
        timeout: 30000,
        maxRetries: 3
      };

      // Create and cache provider instance
      const provider = new (ProviderClass as any)(config);
      this.instances.set(providerId, provider);

      console.log(`✅ Initialized ${providerId} provider`);
      return provider;

    } catch (error) {
      console.error(`❌ Failed to initialize ${providerId} provider:`, error);
      return null;
    }
  }

  static getAllModels(): { provider: string; models: ModelInfo[] }[] {
    const result: { provider: string; models: ModelInfo[] }[] = [];

    for (const providerId of this.getAvailableProviders()) {
      if (providerId === 'custom') {
        // For custom provider, return default models without instantiating
        result.push({
          provider: providerId,
          models: [
            {
              id: 'custom-model',
              name: 'Custom Model',
              description: 'User-configured custom LLM model',
              contextLength: 4096,
              inputCostPer1k: 0,
              outputCostPer1k: 0,
              supportsStreaming: false
            }
          ]
        });
      } else {
        const provider = this.getProvider(providerId);
        if (provider) {
          result.push({
            provider: providerId,
            models: provider.getAvailableModels()
          });
        }
      }
    }

    return result;
  }

  static getModelsByProvider(providerId: string): ModelInfo[] {
    if (providerId === 'custom') {
      return [
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
    }

    const provider = this.getProvider(providerId);
    return provider ? provider.getAvailableModels() : [];
  }

  static isModelSupported(providerId: string, modelId: string): boolean {
    if (providerId === 'custom') {
      return modelId === 'custom-model';
    }

    const provider = this.getProvider(providerId);
    return provider ? provider.isModelSupported(modelId) : false;
  }

  static getDefaultModel(providerId: string): string | null {
    const models = this.getModelsByProvider(providerId);
    if (models.length === 0) return null;

    // Return the first model as default, or a specific preferred model
    const preferredModels: Record<string, string> = {
      'openai': 'gpt-4o-mini',
      'claude': 'claude-3-5-haiku-20241022',
      'mistral': 'mistral-small-latest',
      'gemini': 'gemini-1.5-flash',
      'custom': 'custom-model'
    };

    const preferred = preferredModels[providerId];
    if (preferred && models.some(m => m.id === preferred)) {
      return preferred;
    }

    return models[0].id;
  }

  static clearCache(): void {
    this.instances.clear();
  }
}
