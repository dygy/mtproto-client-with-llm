// @ts-nocheck
import type { APIRoute } from 'astro';
import { LLMProviderRegistry } from '../../lib/llm-providers/index.js';

export const GET: APIRoute = async () => {
  try {
    // Get provider information
    const providers = LLMProviderRegistry.getProviderInfo();
    
    // Get available providers (those with API keys configured)
    const availableProviders = LLMProviderRegistry.getAvailableProviders();
    
    // Get all models organized by provider
    const allModels = LLMProviderRegistry.getAllModels();
    const modelsByProvider: { [provider: string]: any[] } = {};
    
    for (const { provider, models } of allModels) {
      modelsByProvider[provider] = models;
    }

    return new Response(JSON.stringify({
      success: true,
      providers,
      availableProviders,
      models: modelsByProvider
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Error getting LLM providers:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get LLM providers',
      providers: [],
      availableProviders: [],
      models: {}
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};
