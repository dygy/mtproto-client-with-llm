// @ts-nocheck
import React from 'react';
import { X, Bot, Copy, Clock, Zap } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  date: string;
  fromId?: number;
  fromName?: string;
  chatId: number;
  isOutgoing: boolean;
}

interface LLMResult {
  content?: string;
  provider?: string;
  model?: string;
  timestamp?: string;
  tests?: Array<{
    provider: string;
    model: string;
    prompt: string;
    content?: string;
    error?: string;
    processingTime?: number;
    timestamp: string;
  }>;
}

interface LLMResultModalProps {
  message: Message;
  result: LLMResult;
  onClose: () => void;
}

const LLMResultModal: React.FC<LLMResultModalProps> = ({
  message,
  result,
  onClose
}) => {
  const handleCopyResult = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatProcessingTime = (time?: number) => {
    if (!time) return 'Unknown';
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  // Get the main result or the first test result
  const mainResult = result.content || result.tests?.[0]?.content;
  const mainProvider = result.provider || result.tests?.[0]?.provider;
  const mainModel = result.model || result.tests?.[0]?.model;
  const mainTimestamp = result.timestamp || result.tests?.[0]?.timestamp;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Bot className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                LLM Processing Result
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Message from {message.fromName || message.fromId || 'Unknown'} • {formatDate(message.date)}
              </p>
              {(mainProvider && mainModel) && (
                <div className="flex items-center space-x-2 mt-1">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {mainProvider}
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {mainModel}
                  </span>
                </div>
              )}
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

            {/* Prompt Used */}
            {result.tests && result.tests.length > 0 && result.tests[0].prompt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  💭 Prompt Used
                </label>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                    {result.tests[0].prompt}
                  </p>
                </div>
              </div>
            )}

            {/* Main Result */}
            {mainResult && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      🤖 LLM Response
                    </label>
                    {(mainProvider && mainModel) && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        via {mainProvider}/{mainModel}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleCopyResult(mainResult)}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    title="Copy result"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                    <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {mainResult}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center space-x-4 text-xs text-green-700 dark:text-green-300">
                    {mainProvider && (
                      <span>Provider: {mainProvider}</span>
                    )}
                    {mainModel && (
                      <span>Model: {mainModel}</span>
                    )}
                    {mainTimestamp && (
                      <span>
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatDate(mainTimestamp)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Multiple Test Results */}
            {result.tests && result.tests.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  🧪 All Test Results ({result.tests.length})
                </label>
                <div className="space-y-3">
                  {result.tests.map((test, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-md border ${
                        test.content
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {test.provider} / {test.model}
                          </span>
                          {test.processingTime && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              <Zap className="w-3 h-3 inline mr-1" />
                              {formatProcessingTime(test.processingTime)}
                            </span>
                          )}
                        </div>
                        {test.content && (
                          <button
                            onClick={() => handleCopyResult(test.content!)}
                            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            title="Copy result"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Show prompt if available */}
                      {test.prompt && (
                        <div className="mb-3">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Prompt:
                          </div>
                          <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs">
                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                              {test.prompt}
                            </p>
                          </div>
                        </div>
                      )}

                      {test.content ? (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                            {test.content}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                          <p className="text-sm text-red-600 dark:text-red-400">
                            Error: {test.error || 'Unknown error'}
                          </p>
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatDate(test.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {!mainResult && (!result.tests || result.tests.length === 0) && (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No LLM results available for this message
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LLMResultModal;
