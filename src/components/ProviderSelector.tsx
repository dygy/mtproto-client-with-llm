// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ChevronDown, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import CustomLLMConfig from './CustomLLMConfig';

interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  website: string;
  requiresApiKey: boolean;
  envKeyName: string;
}

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  supportsStreaming: boolean;
}

interface ProviderSelectorProps {
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  customLLMConfig?: any;
  onCustomLLMConfigChange?: (config: any) => void;
  disabled?: boolean;
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  customLLMConfig,
  onCustomLLMConfigChange,
  disabled = false
}) => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<{ [provider: string]: ModelInfo[] }>({});
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  useEffect(() => {
    fetchProviderData();
  }, []);

  const fetchProviderData = async () => {
    try {
      setLoading(true);
      
      // Fetch provider information
      const response = await fetch('/api/llm-providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
        setModels(data.models || {});
        setAvailableProviders(data.availableProviders || []);
      }
    } catch (error) {
      console.error('Error fetching provider data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (providerId: string) => {
    onProviderChange(providerId);
    setShowProviderDropdown(false);
    
    // Auto-select first available model for the provider
    const providerModels = models[providerId] || [];
    if (providerModels.length > 0 && selectedModel !== providerModels[0].id) {
      onModelChange(providerModels[0].id);
    }
  };

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    setShowModelDropdown(false);
  };

  const selectedProviderInfo = providers.find(p => p.id === selectedProvider);
  const selectedProviderModels = models[selectedProvider] || [];
  const selectedModelInfo = selectedProviderModels.find(m => m.id === selectedModel);

  const isProviderAvailable = (providerId: string) => {
    return availableProviders.includes(providerId);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          🤖 LLM Provider
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProviderDropdown(!showProviderDropdown)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-left focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {selectedProviderInfo ? (
                  <>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedProviderInfo.name}
                    </span>
                    {isProviderAvailable(selectedProvider) ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Select a provider
                  </span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </button>

          {showProviderDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
              <div className="max-h-60 overflow-auto">
                {providers.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderSelect(provider.id)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-600"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {provider.name}
                          </span>
                          {isProviderAvailable(provider.id) ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {provider.description}
                        </p>
                        {!isProviderAvailable(provider.id) && (
                          <p className="text-xs text-red-500">
                            API key required: {provider.envKeyName}
                          </p>
                        )}
                      </div>
                      <a
                        href={provider.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-500 hover:text-blue-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Model Selection */}
      {selectedProvider && selectedProviderModels.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            🧠 Model
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              disabled={disabled || !isProviderAvailable(selectedProvider)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-left focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <div>
                  {selectedModelInfo ? (
                    <>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedModelInfo.name}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedModelInfo.description}
                      </p>
                    </>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Select a model
                    </span>
                  )}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </button>

            {showModelDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                <div className="max-h-60 overflow-auto">
                  {selectedProviderModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => handleModelSelect(model.id)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-600"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {model.name}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {model.description}
                        </p>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-gray-400">
                            Context: {model.contextLength.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-400">
                            ${model.inputCostPer1k.toFixed(4)}/1K in
                          </span>
                          <span className="text-xs text-gray-400">
                            ${model.outputCostPer1k.toFixed(4)}/1K out
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Provider Status */}
      {selectedProvider && !isProviderAvailable(selectedProvider) && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Provider Not Configured
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                To use {selectedProviderInfo?.name}, add your API key to the environment variable{' '}
                <code className="bg-red-100 dark:bg-red-800 px-1 rounded">
                  {selectedProviderInfo?.envKeyName}
                </code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Custom LLM Configuration */}
      {selectedProvider === 'custom' && onCustomLLMConfigChange && (
        <div className="mt-4">
          <CustomLLMConfig
            config={customLLMConfig}
            onChange={onCustomLLMConfigChange}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};

export default ProviderSelector;
