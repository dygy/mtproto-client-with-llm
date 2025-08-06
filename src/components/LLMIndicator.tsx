// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

interface LLMIndicatorProps {
  sessionId: string;
  chatId: string;
}

const LLMIndicator: React.FC<LLMIndicatorProps> = ({ sessionId, chatId }) => {
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    try {
      const response = await apiClient.getChatSettings(sessionId, chatId);
      if (response.success) {
        setLlmEnabled(response.settings.llmEnabled);
        setLoading(false);
      } else {
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [sessionId, chatId]); // Only reload when sessionId or chatId changes

  if (loading) {
    return (
      <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
    );
  }

  if (!llmEnabled) {
    return null;
  }

  return (
    <div className="w-2 h-2 bg-blue-500 rounded-full" title="LLM Enabled">
      <div className="w-full h-full bg-blue-400 rounded-full animate-pulse"></div>
    </div>
  );
};

export default LLMIndicator;
