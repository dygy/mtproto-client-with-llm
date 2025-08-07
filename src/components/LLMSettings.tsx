// @ts-nocheck
import React from 'react';
import type { ChatSettings } from '../lib/database';
import ProviderSelector from './ProviderSelector';

interface LLMSettingsProps {
  settings: {
    llmEnabled: boolean;
    llmProvider: string;
    llmModel: string;
    llmPrompt: string;
    autoReply: boolean;
    keywords: string[];
    customLLMConfig?: any;
  };
  onChange: (key: keyof ChatSettings, value: any) => void;
  disabled?: boolean;
}

const LLMSettings: React.FC<LLMSettingsProps> = ({ settings, onChange, disabled = false }) => {


    const predefinedPrompts = [
      {
        name: 'Trading Analysis',
        prompt: 'You are a crypto trading analyst. Analyze the message for trading signals, market sentiment, and provide brief insights on potential price movements.'
      },
      {
        name: 'News Summarizer', 
        prompt: 'You are a news summarizer. Extract key information from the message and provide a concise summary highlighting the most important points.'
      },
      {
        name: 'General Assistant',
        prompt: 'You are a helpful assistant. Provide useful, accurate, and concise responses to questions and comments in the chat.'
      }
    ];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              🤖 LLM Integration
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure AI processing for this chat
            </p>
          </div>
          
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.llmEnabled}
              onChange={(e) => onChange('llmEnabled', e.target.checked)}
              disabled={disabled}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {settings.llmEnabled && (
          <div className="space-y-4 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
            {/* Provider Selection */}
            <ProviderSelector
              selectedProvider={settings.llmProvider}
              selectedModel={settings.llmModel}
              onProviderChange={(provider) => onChange('llmProvider', provider)}
              onModelChange={(model) => onChange('llmModel', model)}
              customLLMConfig={settings.customLLMConfig}
              onCustomLLMConfigChange={(config) => onChange('customLLMConfig', config)}
              disabled={disabled}
            />

            {/* Quick Prompts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quick Prompts
              </label>
              <div className="space-y-1">
                {predefinedPrompts.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => onChange('llmPrompt', preset.prompt)}
                    disabled={disabled}
                    className="w-full text-left p-2 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-xs text-gray-900 dark:text-white">
                      {preset.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {preset.prompt.substring(0, 60)}...
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Custom LLM Prompt
              </label>
              <textarea
                value={settings.llmPrompt}
                onChange={(e) => onChange('llmPrompt', e.target.value)}
                placeholder="Enter a custom prompt for this chat..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none text-sm"
                rows={3}
                disabled={disabled}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1">
                <p>This prompt will be used when processing messages from this chat.</p>
                <p><strong>The received message will be automatically appended</strong> to your prompt as "USER MESSAGE:"</p>
                <p>You can also use placeholders: {'{sender}'}, {'{chat}'}, {'{timestamp}'}, or {'{message}'} (if you want to control placement)</p>
              </div>
            </div>

            {/* Auto Reply */}
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto Reply
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Auto-send responses
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoReply}
                  onChange={(e) => onChange('autoReply', e.target.checked)}
                  disabled={disabled}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Trigger Keywords
              </label>
              <input
                type="text"
                value={settings.keywords.join(', ')}
                onChange={(e) => {
                  const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                  onChange('keywords', keywords);
                }}
                placeholder="crypto, trading, btc (comma-separated)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={disabled}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Only process messages containing these keywords (leave empty for all messages)
              </p>
              {settings.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {settings.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                      {keyword}
                      <button
                        onClick={() => {
                          const newKeywords = settings.keywords.filter((_, i) => i !== index);
                          onChange('keywords', newKeywords);
                        }}
                        disabled={disabled}
                        className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-2">
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                    LLM Active
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300">
                    AI processing enabled
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!settings.llmEnabled && (
          <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-md p-3 text-center">
            <div className="text-gray-400 mb-1">
              <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M13 10V3L4 14h4v7l9-11h-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Enable LLM to configure AI responses
            </p>
          </div>
        )}
      </div>
    );
};

export default LLMSettings;
