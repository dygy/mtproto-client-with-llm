// @ts-nocheck
// LLM Providers - Main Export File

export { BaseLLMProvider } from './base.js';
export { OpenAIProvider } from './openai.js';
export { ClaudeProvider } from './claude.js';
export { MistralProvider } from './mistral.js';
export { GeminiProvider } from './gemini.js';
export { CustomLLMProvider } from './custom.js';
export { LLMProviderRegistry } from './registry.js';

// Import for convenience functions
import { LLMProviderRegistry } from './registry.js';

export type {
  LLMMessage,
  LLMResponse,
  LLMProviderConfig,
  ModelInfo
} from './base.js';

export type { ProviderInfo } from './registry.js';

// Convenience function to get a provider instance
export function getLLMProvider(providerId: string) {
  return LLMProviderRegistry.getProvider(providerId);
}

// Convenience function to check if a provider is available
export function isProviderAvailable(providerId: string): boolean {
  return LLMProviderRegistry.isProviderConfigured(providerId);
}

// Convenience function to get all available providers
export function getAvailableProviders(): string[] {
  return LLMProviderRegistry.getAvailableProviders();
}

// Convenience function to get provider information
export function getProviderInfo() {
  return LLMProviderRegistry.getProviderInfo();
}

// Convenience function to get all models
export function getAllModels() {
  return LLMProviderRegistry.getAllModels();
}
