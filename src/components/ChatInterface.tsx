// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChatList from './ChatList';
import ChatView from './ChatView';
import { eventBus, EVENTS } from '../lib/event-bus';

interface Chat {
  id: number;
  title: string;
  type: 'private' | 'group' | 'supergroup' | 'channel' | 'bot';
  unreadCount: number;
  lastMessage?: {
    id: number;
    text: string;
    date: string;
    fromId?: number;
    fromName?: string;
  };
  info: any;
  isArchived: boolean;
  isPinned: boolean;
}

interface ChatInterfaceProps {
  sessionId: string;
  userInfo: any;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ sessionId, userInfo }) => {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [lastUpdate, setLastUpdate] = useState<any>(null);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const chatViewRef = useRef<any>(null);
  const chatListRef = useRef<any>(null);
  const sseReconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  const handleChatSelect = useCallback((chat: Chat) => {
    setSelectedChat(chat);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedChat(null);
  }, []);

  useEffect(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Setup MTProto update handlers first, then SSE
    if (sessionId) {
      setupUpdateHandlers();
    }

    // Clean up any existing SSE connections before setting up new one
    cleanupExistingSSE();
    setupSSE();

    return () => {
      window.removeEventListener('resize', checkMobile);
      cleanupSSE();

      // Clear any pending reconnection timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [sessionId]); // Re-run when sessionId changes

  const setupUpdateHandlers = useCallback(async () => {
    try {
      const response = await fetch(`/api/setup-updates/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (result.success) {
        console.log('✅ ChatInterface: MTProto update handlers setup successfully');
      } else {
        console.error('❌ ChatInterface: Failed to setup update handlers:', result.message);
      }
    } catch (error) {
      console.error('❌ ChatInterface: Error setting up update handlers:', error);
    }
  }, [sessionId]);

  const setupSSE = useCallback(() => {
    // Prevent multiple connections
    if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
      return;
    }

    try {
      setSseStatus('connecting');
      const newEventSource = new EventSource(`/api/updates/${sessionId}`);

      newEventSource.onopen = () => {
        setSseStatus('connected');
        // Reset any reconnection attempts
        sseReconnectAttemptsRef.current = 0;
      };

      newEventSource.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          handleSSEUpdate(update);
        } catch (error) {
          console.error('ChatInterface: Error parsing SSE update:', error);
        }
      };

      newEventSource.onerror = (error) => {
        setSseStatus('error');

        // Handle reconnection only if connection is actually closed
        if (newEventSource.readyState === EventSource.CLOSED) {
          setSseStatus('disconnected');
          // Delay reconnection to prevent rapid reconnection loops
          setTimeout(() => {
            handleSSEReconnection();
          }, 2000);
        }
      };

      setEventSource(newEventSource);
    } catch (error) {
      console.error('ChatInterface: Failed to setup SSE:', error);
      handleSSEReconnection();
    }
  }, [sessionId]);

  const cleanupSSE = useCallback(() => {
    if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
      eventSource.close();
      setEventSource(null);
    }
  }, [eventSource]);

  const cleanupExistingSSE = useCallback(() => {
    // Clean up any existing global SSE connections that might interfere
    const existingConnections = document.querySelectorAll('[data-sse-connection]');
    existingConnections.forEach(element => {
      const connection = (element as any).__sseConnection;
      if (connection && connection.close) {
        console.log('🧹 Cleaning up existing SSE connection');
        connection.close();
      }
    });
  }, []);

  const handleSSEReconnection = useCallback(() => {
    if (sseReconnectAttemptsRef.current >= maxReconnectAttempts) {

      return;
    }

    sseReconnectAttemptsRef.current++;
    const delay = Math.min(1000 * Math.pow(2, sseReconnectAttemptsRef.current - 1), 30000); // Max 30 seconds



    reconnectTimeoutRef.current = setTimeout(() => {
      cleanupSSE();
      setupSSE();
    }, delay);
  }, [cleanupSSE, setupSSE]);

  const handleSSEUpdate = useCallback((update: any) => {


    if (update.type === 'message') {
      // Store the update to trigger re-renders and pass to ChatList
      setLastUpdate(update);

      // Emit event for all components to receive
      eventBus.emit(EVENTS.NEW_MESSAGE, update.data);
    } else if (update.type === 'llm_result') {
      // Emit LLM result event
      eventBus.emit(EVENTS.LLM_RESULT, update.data);
      console.log('🤖 ChatInterface: LLM result broadcasted via event bus');
    } else if (update.type === 'auth_error') {
      // Handle authentication errors
      console.log('🚨 ChatInterface: Received auth error:', update.data);

      if (update.data?.shouldLogout) {
        console.log('🚪 ChatInterface: Auth error requires logout, redirecting...');

        // Clear local storage
        localStorage.removeItem('telegram_session_id');
        localStorage.removeItem('telegram_user_info');
        localStorage.removeItem('telegram_user_id');

        // Show error message and redirect to login
        alert(`Authentication Error: ${update.data.message}\n\nYou will be redirected to the login page.`);

        // Reload the page to trigger auth state check
        window.location.reload();
      } else {
        // Show error but don't logout
        console.log('⚠️ ChatInterface: Auth error (no logout required):', update.data.message);
        alert(`Warning: ${update.data.message}`);
      }
    }
  }, [selectedChat]);

  const handleMessagesRead = useCallback((chatId: number, maxId: number) => {
    console.log(`📖 ChatInterface: Messages marked as read in chat ${chatId} up to ${maxId}`);

    // Create a read update to pass to ChatList
    const readUpdate = {
      type: 'messagesRead',
      data: {
        chatId,
        maxId
      }
    };

    // Update state to trigger ChatList re-render
    setLastUpdate(readUpdate);
  }, []);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* SSE Status Indicator */}
      <div className="flex-shrink-0 px-4 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs">
            <div className={`w-2 h-2 rounded-full ${
              sseStatus === 'connected' ? 'bg-green-500' :
              sseStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              sseStatus === 'error' ? 'bg-red-500' :
              'bg-gray-400'
            }`}></div>
            <span className="text-gray-600 dark:text-gray-400">
              Updates: {sseStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Chat List - Always visible on desktop, hidden when chat selected on mobile */}
        <div className={`${
          isMobile
            ? (selectedChat ? 'hidden' : 'w-full')
            : 'w-1/3 border-r border-gray-200 dark:border-gray-700'
        } h-full min-h-0`}>
          <ChatList
            ref={chatListRef}
            sessionId={sessionId}
            onChatSelect={handleChatSelect}
            selectedChatId={selectedChat?.id}
            lastUpdate={lastUpdate}
          />
        </div>

      {/* Chat View - Show when chat is selected */}
      <div className={`${
        isMobile
          ? (selectedChat ? 'w-full' : 'hidden')
          : 'flex-1'
      } h-full min-h-0`}>
        {selectedChat ? (
          <div className="h-full flex flex-col">
            {/* Mobile back button */}
            {isMobile && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <button
                  onClick={handleBackToList}
                  className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  Back to chats
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0">
              <ChatView
                ref={chatViewRef}
                sessionId={sessionId}
                chat={selectedChat}
                userInfo={userInfo}
                onMessagesRead={handleMessagesRead}
              />
            </div>
          </div>
        ) : (
          // Empty state when no chat is selected (desktop only)
          !isMobile && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Select a chat
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Choose a chat from the list to view messages
                </p>
              </div>
            </div>
          )
        )}
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
