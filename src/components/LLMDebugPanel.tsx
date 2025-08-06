// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Bot, Activity, CheckCircle, XCircle, Clock, Zap, Settings, RefreshCw } from 'lucide-react';

interface LLMDebugPanelProps {
  sessionId: string;
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface LLMStatus {
  chatSettings: {
    llmEnabled: boolean;
    llmProvider: string;
    llmModel: string;
    llmPrompt: string;
    autoReply: boolean;
    keywords: string[];
    notifications: boolean;
  } | null;
  recentLogs: Array<{
    messageId: string;
    message: string;
    prompt: string;
    response: string;
    success: boolean;
    error: string | null;
    processingTime: number;
    timestamp: string;
  }>;
  statistics: {
    totalProcessed: number;
    successful: number;
    failed: number;
    successRate: string;
    avgProcessingTime: number;
    lastProcessed: string | null;
  };
  serviceStatus: {
    initialized: boolean;
    providers: {
      openai: string;
      anthropic: string;
      mistral: string;
      gemini: string;
    };
  };
}

const LLMDebugPanel: React.FC<LLMDebugPanelProps> = ({
  sessionId,
  chatId,
  isOpen,
  onClose
}) => {
  const [status, setStatus] = useState<LLMStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/llm-status/${sessionId}/${chatId}`);
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
      } else {
        setError(data.message || 'Failed to load LLM status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen, sessionId, chatId]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getProviderStatus = (status: string) => {
    switch (status) {
      case 'configured':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'missing_key':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <XCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Activity className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                LLM Debug Panel
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Chat {chatId} • Session {sessionId.split('_')[1]}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadStatus}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading LLM status...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md mb-6">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
          )}

          {status && (
            <div className="space-y-6">
              {/* Chat Settings */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Chat Settings
                </h3>
                {status.chatSettings ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">LLM Enabled:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                        status.chatSettings.llmEnabled 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {status.chatSettings.llmEnabled ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Provider:</span>
                      <span className="ml-2 text-sm text-gray-900 dark:text-white">{status.chatSettings.llmProvider}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Model:</span>
                      <span className="ml-2 text-sm text-gray-900 dark:text-white">{status.chatSettings.llmModel}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Reply:</span>
                      <span className="ml-2 text-sm text-gray-900 dark:text-white">{status.chatSettings.autoReply ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Prompt:</span>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2 rounded border">
                        {status.chatSettings.llmPrompt || 'No custom prompt'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No settings configured for this chat</p>
                )}
              </div>

              {/* Statistics */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Bot className="w-5 h-5 mr-2" />
                  Processing Statistics
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{status.statistics.totalProcessed}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{status.statistics.successful}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{status.statistics.failed}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{status.statistics.successRate}%</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Success Rate</div>
                  </div>
                </div>
                {status.statistics.avgProcessingTime > 0 && (
                  <div className="mt-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Avg Processing Time: {status.statistics.avgProcessingTime}ms
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Provider Status */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Provider Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(status.serviceStatus.providers).map(([provider, providerStatus]) => (
                    <div key={provider} className="flex items-center space-x-2">
                      {getProviderStatus(providerStatus)}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{provider}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">({providerStatus.replace('_', ' ')})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Logs */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Recent Processing Logs
                </h3>
                {status.recentLogs.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {status.recentLogs.map((log, index) => (
                      <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {log.success ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              Message {log.messageId}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {log.processingTime}ms
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>Message:</strong> {log.message ? log.message.substring(0, 100) + '...' : 'No message'}
                        </div>
                        {log.success ? (
                          <div className="text-sm text-gray-700 dark:text-gray-300">
                            <strong>Response:</strong> {log.response ? log.response.substring(0, 150) + '...' : 'No response'}
                          </div>
                        ) : (
                          <div className="text-sm text-red-600 dark:text-red-400">
                            <strong>Error:</strong> {log.error || 'Unknown error'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No processing logs found</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LLMDebugPanel;
