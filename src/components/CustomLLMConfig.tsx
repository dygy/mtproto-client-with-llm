// @ts-nocheck
import React, { useState, useEffect } from 'react';

interface CustomLLMConfigProps {
  config?: {
    baseUrl: string;
    apiKey?: string;
    headers?: Record<string, string>;
    requestFormat?: 'openai' | 'custom';
    responseFormat?: 'openai' | 'custom';
    customRequestTemplate?: string;
    customResponsePath?: string;
  };
  onChange: (config: any) => void;
  disabled?: boolean;
}

const CustomLLMConfig: React.FC<CustomLLMConfigProps> = ({
  config,
  onChange,
  disabled = false
}) => {
  const [localConfig, setLocalConfig] = useState({
    baseUrl: config?.baseUrl || '',
    apiKey: config?.apiKey || '',
    headers: config?.headers || {},
    requestFormat: config?.requestFormat || 'openai',
    responseFormat: config?.responseFormat || 'openai',
    customRequestTemplate: config?.customRequestTemplate || '',
    customResponsePath: config?.customResponsePath || ''
  });

  const [headersText, setHeadersText] = useState(
    config?.headers ? JSON.stringify(config.headers, null, 2) : '{}'
  );

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (config) {
      setLocalConfig({
        baseUrl: config.baseUrl || '',
        apiKey: config.apiKey || '',
        headers: config.headers || {},
        requestFormat: config.requestFormat || 'openai',
        responseFormat: config.responseFormat || 'openai',
        customRequestTemplate: config.customRequestTemplate || '',
        customResponsePath: config.customResponsePath || ''
      });
      setHeadersText(config.headers ? JSON.stringify(config.headers, null, 2) : '{}');
    }
  }, [config]);

  const handleChange = (field: string, value: any) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const handleHeadersChange = (value: string) => {
    setHeadersText(value);
    try {
      const parsedHeaders = JSON.parse(value);
      handleChange('headers', parsedHeaders);
    } catch (error) {
      // Invalid JSON, don't update the config yet
    }
  };

  return (
    <div className="space-y-4 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          🔧 Custom LLM Configuration
        </h4>
      </div>

      {/* Base URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          API Endpoint URL *
        </label>
        <input
          type="url"
          value={localConfig.baseUrl}
          onChange={(e) => handleChange('baseUrl', e.target.value)}
          disabled={disabled}
          placeholder="https://api.example.com/v1/chat/completions"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          The complete URL endpoint for your LLM API
        </p>
      </div>

      {/* API Key */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          API Key (Optional)
        </label>
        <input
          type="password"
          value={localConfig.apiKey}
          onChange={(e) => handleChange('apiKey', e.target.value)}
          disabled={disabled}
          placeholder="sk-..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Will be sent as Authorization: Bearer header if provided
        </p>
      </div>

      {/* Request Format */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Request Format
        </label>
        <select
          value={localConfig.requestFormat}
          onChange={(e) => handleChange('requestFormat', e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        >
          <option value="openai">OpenAI Compatible</option>
          <option value="custom">Custom Template</option>
        </select>
      </div>

      {/* Response Format */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Response Format
        </label>
        <select
          value={localConfig.responseFormat}
          onChange={(e) => handleChange('responseFormat', e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
        >
          <option value="openai">OpenAI Compatible</option>
          <option value="custom">Custom Path</option>
        </select>
      </div>

      {/* Advanced Settings Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          disabled={disabled}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
        >
          {showAdvanced ? '▼' : '▶'} Advanced Settings
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-4 pl-4 border-l-2 border-gray-300 dark:border-gray-600">
          {/* Custom Headers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Custom Headers (JSON)
            </label>
            <textarea
              value={headersText}
              onChange={(e) => handleHeadersChange(e.target.value)}
              disabled={disabled}
              rows={3}
              placeholder='{"X-Custom-Header": "value"}'
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 font-mono text-sm"
            />
          </div>

          {/* Custom Request Template */}
          {localConfig.requestFormat === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custom Request Template (JSON)
              </label>
              <textarea
                value={localConfig.customRequestTemplate}
                onChange={(e) => handleChange('customRequestTemplate', e.target.value)}
                disabled={disabled}
                rows={5}
                placeholder='{"prompt": "{{user_message}}", "model": "{{model}}"}'
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use placeholders: {{user_message}}, {{system_message}}, {{model}}, {{temperature}}, {{max_tokens}}
              </p>
            </div>
          )}

          {/* Custom Response Path */}
          {localConfig.responseFormat === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Response Content Path
              </label>
              <input
                type="text"
                value={localConfig.customResponsePath}
                onChange={(e) => handleChange('customResponsePath', e.target.value)}
                disabled={disabled}
                placeholder="data.response.text"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Dot-separated path to the response content in the API response
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomLLMConfig;
