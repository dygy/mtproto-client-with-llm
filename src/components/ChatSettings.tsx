// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api';
import LLMSettings from './LLMSettings';
import type { ChatSettings } from '../lib/database';

interface ChatSettingsProps {
  sessionId: string;
  chatId: string;
  chatTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const ChatSettingsComponent: React.FC<ChatSettingsProps> = ({
  sessionId,
  chatId,
  chatTitle,
  isOpen,
  onClose
}) => {
  const [settings, setSettings] = useState<ChatSettings>({
    llmEnabled: false,
    llmProvider: 'openai',
    llmModel: 'gpt-4o-mini',
    llmPrompt: '',
    autoReply: false,
    keywords: [],
    notifications: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await apiClient.getChatSettings(sessionId, chatId);

      if (response.success) {
        setSettings(response.settings);
        setHasChanges(false);
      } else {
        setError(response.message || 'Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading chat settings:', error);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [sessionId, chatId]);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  const handleSettingChange = useCallback((key: keyof ChatSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  }, []);



  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError('');

      const response = await apiClient.updateChatSettings(sessionId, chatId, settings);

      if (response.success) {
        setSaving(false);
        setHasChanges(false);
        // Show success message briefly
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setError(response.message || 'Failed to save settings');
        setSaving(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      setSaving(false);
    }
  }, [sessionId, chatId, settings, onClose]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Chat Settings
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure settings for "{chatTitle}"
          </p>
        </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Loading settings...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* LLM Settings */}
                <LLMSettings
                  settings={{
                    llmEnabled: settings.llmEnabled,
                    llmProvider: settings.llmProvider,
                    llmModel: settings.llmModel,
                    llmPrompt: settings.llmPrompt,
                    autoReply: settings.autoReply,
                    keywords: settings.keywords
                  }}
                  onChange={handleSettingChange}
                  disabled={saving}
                />

                {/* General Settings */}
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    🔔 General Settings
                  </h3>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Notifications
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Receive notifications for this chat
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.notifications}
                        onChange={(e) => handleSettingChange('notifications', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                    <div className="flex">
                      <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div className="ml-3">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {hasChanges && (
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    • Unsaved changes
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                >
                  {saving ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </div>
                  ) : (
                    'Save Settings'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
};

export default ChatSettingsComponent;
