// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { X, Bot, Loader2, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import ProviderSelector from './ProviderSelector';

interface Message {
  id: number;
  text: string;
  date: string;
  fromId?: number;
  fromName?: string;
  chatId: number;
  isOutgoing: boolean;
}

interface LLMTestModalProps {
  message: Message;
  sessionId: string;
  chatId: string;
  onClose: () => void;
  onResult: (result: any) => void;
}

const LLMTestModal: React.FC<LLMTestModalProps> = ({
  message,
  sessionId,
  chatId,
  onClose,
  onResult
}) => {
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [customPrompt, setCustomPrompt] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Default prompts for different use cases
  const defaultPrompts = [
    {
      name: 'Analyze Message',
      prompt: 'Analyze this message and provide insights about its content, tone, and intent:\n\n"{message}"'
    },
    {
      name: 'Summarize',
      prompt: 'Provide a brief summary of this message:\n\n"{message}"'
    },
    {
      name: 'Sentiment Analysis',
      prompt: 'Analyze the sentiment of this message (positive, negative, neutral) and explain why:\n\n"{message}"'
    },
    {
      name: 'Translation',
      prompt: 'Translate this message to English if it\'s in another language, or identify the language if it\'s already in English:\n\n"{message}"'
    },
    {
      name: 'Extract Information',
      prompt: 'Extract any important information, dates, numbers, or key points from this message:\n\n"{message}"'
    },
    {
      name: 'Generate Response',
      prompt: 'Generate an appropriate response to this message:\n\n"{message}"'
    }
  ];

  useEffect(() => {
    // Set default prompt (already processed)
    if (!customPrompt) {
      setCustomPrompt(defaultPrompts[0].prompt.replace('{message}', message.text));
    }
  }, [message.text, customPrompt]);

  const handlePromptSelect = (prompt: string) => {
    setCustomPrompt(prompt.replace('{message}', message.text));
  };

  // Function to get the original template from processed prompt
  const getOriginalTemplate = (processedPrompt: string) => {
    // Try to reverse the replacement to get the template
    // This is a simple heuristic - in practice, we might want to store templates separately
    return processedPrompt.replace(new RegExp(message.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '{message}');
  };

  const handleTest = async () => {
    if (!customPrompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setTesting(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/llm-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel,
          prompt: customPrompt, // This is the processed prompt
          originalPrompt: getOriginalTemplate(customPrompt), // Try to get the template
          messageId: message.id,
          sessionId,
          chatId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data.result);
        onResult(data.result);
      } else {
        setError(data.message || 'Failed to test LLM');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setTesting(false);
    }
  };

  const handleCopyResult = () => {
    if (result?.content) {
      navigator.clipboard.writeText(result.content);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Bot className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Test Message with LLM
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Message from {message.fromName || 'Unknown'} • {formatDate(message.date)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-6">
            {/* Original Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📝 Original Message
              </label>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md border">
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {message.text}
                </p>
              </div>
            </div>

            {/* Provider Selection */}
            <ProviderSelector
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              onProviderChange={setSelectedProvider}
              onModelChange={setSelectedModel}
              disabled={testing}
            />

            {/* Quick Prompts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ⚡ Quick Prompts
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {defaultPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handlePromptSelect(prompt.prompt)}
                    disabled={testing}
                    className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {prompt.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                💬 Custom Prompt
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                disabled={testing}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Enter your custom prompt here..."
              />
            </div>

            {/* Test Button */}
            <div className="flex justify-end">
              <button
                onClick={handleTest}
                disabled={testing || !customPrompt.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    <span>Test with LLM</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Error
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Result Display */}
            {result && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      LLM Response
                    </p>
                  </div>
                  <button
                    onClick={handleCopyResult}
                    className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                    title="Copy result"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {result.content}
                  </p>
                </div>
                {result.usage && (
                  <div className="mt-2 text-xs text-green-700 dark:text-green-300">
                    Tokens: {result.usage.totalTokens} ({result.usage.promptTokens} prompt + {result.usage.completionTokens} completion)
                    {result.model && ` • Model: ${result.model}`}
                    {result.provider && ` • Provider: ${result.provider}`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LLMTestModal;
