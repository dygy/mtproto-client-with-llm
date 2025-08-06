// @ts-nocheck
import React from 'react';
import { apiClient } from '../lib/api';
import { wsClient, type TelegramMessage } from '../lib/websocket';

interface MessageListProps {
  sessionId: string;
  userInfo: any;
}

export default function MessageList({ sessionId, userInfo }: MessageListProps) {
  const [messages, setMessages] = React.useState<TelegramMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [connectionStatus, setConnectionStatus] = React.useState('disconnected');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  React.useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        await wsClient.connect();
        setConnectionStatus('connected');
        
        // Update global connection status
        if (typeof window !== 'undefined' && (window as any).updateConnectionStatus) {
          (window as any).updateConnectionStatus('Connected', true);
        }

        wsClient.subscribeToSession(sessionId);

        // Set up message handler
        wsClient.onMessage((message) => {
          setMessages(prev => [message, ...prev]);
        });

        // Set up status handler
        wsClient.onStatus((_status) => {
          setConnectionStatus(wsClient.connectionState);
        });

        // Set up error handler
        wsClient.onError((error) => {
          setError(error.message);
        });

      } catch (err) {
        setConnectionStatus('error');
        setError('Failed to connect to WebSocket');
        
        if (typeof window !== 'undefined' && (window as any).updateConnectionStatus) {
          (window as any).updateConnectionStatus('Connection Error', false);
        }
      }
    };

    const loadInitialMessages = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getMessages(sessionId, 50);
        
        if (response.success && response.messages) {
          setMessages(response.messages);
        } else {
          setError(response.message || 'Failed to load messages');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      } finally {
        setLoading(false);
      }
    };

    initializeWebSocket();
    loadInitialMessages();

    return () => {
      wsClient.disconnect();
      if (typeof window !== 'undefined' && (window as any).updateConnectionStatus) {
        (window as any).updateConnectionStatus('Disconnected', false);
      }
    };
  }, [sessionId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const getMessageDirection = (message: TelegramMessage) => {
    return message.fromId === userInfo?.id ? 'sent' : 'received';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600 dark:text-gray-400">Loading messages...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md p-4">
        <div className="flex">
          <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error</h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-section">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Messages</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Logged in as {userInfo?.firstName} {userInfo?.lastName}
              {userInfo?.username && ` (@${userInfo.username})`}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
              {connectionStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="h-96 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="mt-2">No messages yet</p>
            <p className="text-sm">Messages will appear here in real-time</p>
          </div>
        ) : (
          messages.map((message) => {
            const direction = getMessageDirection(message);
            return (
              <div
                key={`${message.chatId}-${message.id}`}
                className={`flex ${direction === 'sent' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  direction === 'sent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}>
                  {direction === 'received' && (
                    <div className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
                      {message.chatTitle || message.fromName || 'Unknown'}
                    </div>
                  )}
                  <p className="text-sm">{message.text}</p>
                  <p className={`text-xs mt-1 ${
                    direction === 'sent' 
                      ? 'text-blue-100' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formatDate(message.date)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Real-time updates enabled • {messages.length} messages loaded
        </p>
      </div>
    </div>
  );
}
