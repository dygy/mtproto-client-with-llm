// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import { Bot, Eye } from 'lucide-react';
import { apiClient } from '../lib/api';
import ChatSettingsSidebar from './ChatSettingsSidebar';
import { eventBus, EVENTS } from '../lib/event-bus';
import Avatar from './Avatar';
import AvatarCacheDebug from './AvatarCacheDebug';
import MediaMessage from './MediaMessage';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import MessageReactions from './MessageReactions';
import MessageStatus from './MessageStatus';
import LLMTestModal from './LLMTestModal';
import LLMResultModal from './LLMResultModal';
import LLMDebugPanel from './LLMDebugPanel';


interface Message {
  id: number;
  text: string;
  date: string;
  fromId?: number;
  fromName?: string;
  chatId: number;
  isOutgoing: boolean;
  replyToMsgId?: number;
  hasMedia?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  mediaType?: string;
  mediaInfo?: {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    duration?: number;
    width?: number;
    height?: number;
  };
  reactions?: Array<{
    emoji: string;
    count: number;
    users: string[];
    hasReacted: boolean;
  }>;
}

interface Chat {
  id: number;
  title: string;
  type: 'private' | 'group' | 'supergroup' | 'channel' | 'bot';
  info: any;
}

interface ChatViewProps {
  sessionId: string;
  chat: Chat;
  userInfo: any;
  onNewMessage?: (message: any) => void;
  onMessagesRead?: (chatId: number, maxId: number) => void;
}

const ChatView = React.forwardRef<any, ChatViewProps>(({ sessionId, chat, userInfo, onMessagesRead }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [lastReadMessageId, setLastReadMessageId] = useState<number | null>(null);
  const [markingAsRead, setMarkingAsRead] = useState(false);
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
    message: null as Message | null
  });
  const [llmTestModal, setLlmTestModal] = useState({
    show: false,
    message: null as Message | null
  });
  const [llmResultModal, setLlmResultModal] = useState({
    show: false,
    message: null as Message | null,
    result: null as any
  });
  const [llmDebugPanel, setLlmDebugPanel] = useState(false);
  const [llmResults, setLlmResults] = useState<{[messageId: number]: any}>({});
  const [lastUpdateReceived, setLastUpdateReceived] = useState<string | null>(null);

  const [showCacheDebug, setShowCacheDebug] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{
    id: number;
    text: string;
    fromName?: string;
  } | null>(null);
  const [typingUsers] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleNewMessage: (message: any) => {
      console.log('📨 ChatView: Handling new message for chat', message.chatId, 'current chat:', chat.id);
      console.log('📨 ChatView: Message details:', {
        id: message.id,
        text: message.text?.substring(0, 50),
        fromId: message.fromId,
        fromName: message.fromName,
        isOutgoing: message.isOutgoing
      });

      setLastUpdateReceived(`New message at ${new Date().toLocaleTimeString()}`);
      setTimeout(() => setLastUpdateReceived(null), 5000);

      // Convert chat IDs to strings for reliable comparison
      const messageChatId = message.chatId?.toString();
      const currentChatId = chat.id?.toString();

      if (messageChatId === currentChatId) {
        console.log('✅ ChatView: Message is for current chat, adding to messages');

        setMessages(prev => {
          // Check if message already exists
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            console.log('📨 Message already exists, skipping');
            return prev;
          }

          // Clean up fromName to avoid undefined display
          let cleanFromName = message.fromName;
          if (!cleanFromName || cleanFromName === 'undefined' || cleanFromName === 'null') {
            if (message.isOutgoing) {
              cleanFromName = 'You';
            } else if (chat.type === 'private') {
              // For private chats, use the chat title as the sender name
              cleanFromName = chat.title;
            } else if (message.fromId && message.fromId !== 'undefined' && message.fromId !== 'null') {
              cleanFromName = `User ${message.fromId}`;
            } else {
              cleanFromName = 'Unknown User';
            }
          }

          const newMessage = {
            id: message.id,
            text: message.text || '',
            date: message.date,
            fromId: message.fromId,
            fromName: cleanFromName,
            chatId: message.chatId,
            isOutgoing: message.isOutgoing || false,
            replyToMsgId: message.replyToMsgId,
            hasMedia: message.hasMedia,
            mediaType: message.mediaType,
            mediaInfo: message.mediaInfo,
            reactions: []
          };

          console.log('📨 ChatView: Adding new message:', newMessage);
          const newMessages = [...prev, newMessage];

          // Sort by date to maintain order
          return newMessages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });

        // Auto-scroll to bottom
        setTimeout(() => scrollToBottom('smooth'), 100);

        // Note: Removed automatic message reading - user must manually mark as read
      } else {
        console.log('⏭️ ChatView: Message is not for current chat, ignoring');
      }
    },
    handleLLMResult: (llmData: any) => {
      if (llmData.messageId && llmData.result) {
        // Ensure message ID is treated as a number for consistency
        const messageId = typeof llmData.messageId === 'string' ? parseInt(llmData.messageId, 10) : llmData.messageId;

        setLlmResults(prev => ({
          ...prev,
          [messageId]: llmData.result
        }));
      }
    }
  }));

  // Listen to event bus for new messages and LLM results
  useEffect(() => {
    const unsubscribeMessage = eventBus.on(EVENTS.NEW_MESSAGE, (message) => {
      console.log('📡 ChatView: Received message via event bus:', message.id, 'for chat:', message.chatId);

      // Convert chat IDs to strings for reliable comparison
      const messageChatId = message.chatId?.toString();
      const currentChatId = chat.id?.toString();

      if (messageChatId === currentChatId) {
        console.log('✅ ChatView: Message is for current chat, adding via event bus');

        setMessages(prev => {
          // Check if message already exists
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            console.log('📨 Message already exists, skipping');
            return prev;
          }

          // Add new message
          const newMessage = {
            id: message.id,
            text: message.text || '',
            date: message.date,
            fromId: message.fromId,
            fromName: message.fromName || 'Unknown',
            isOutgoing: message.isOutgoing || false,
            mediaType: message.mediaType
          };

          return [...prev, newMessage];
        });

        // Auto-scroll to bottom
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        }, 100);

        // Note: Removed automatic message reading - user must manually mark as read
      }
    });

    const unsubscribeLLM = eventBus.on(EVENTS.LLM_RESULT, (llmData) => {
      console.log('🤖 ChatView: Received LLM result via event bus:', llmData.messageId);

      if (llmData.messageId && llmData.result) {
        const messageId = typeof llmData.messageId === 'string' ? parseInt(llmData.messageId, 10) : llmData.messageId;

        setLlmResults(prev => ({
          ...prev,
          [messageId]: llmData.result
        }));
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeLLM();
    };
  }, [chat.id]);

  const loadMessages = useCallback(async () => {
    if (!chat) return;
    
    try {
      setLoading(true);
      setError('');
      
      const response = await apiClient.getChatMessages(sessionId, chat.id.toString());
      
      if (response.success) {
        const messagesData = response.messages || [];
        console.log(`📨 Loaded ${messagesData.length} messages for chat ${chat.title}`);
        
        // Log message direction issues
        const outgoingCount = messagesData.filter((msg: any) => msg.isOutgoing).length;
        const totalCount = messagesData.length;
        if (outgoingCount === totalCount && totalCount > 0) {
          console.log(`⚠️ All ${totalCount} messages marked as outgoing - direction issue detected`);
        }

        const processedMessages = messagesData.map((msg: any) => {
          console.log(`📨 Processing loaded message ${msg.id}:`, {
            fromName: msg.fromName,
            fromId: msg.fromId,
            isOutgoing: msg.isOutgoing,
            text: msg.text?.substring(0, 50)
          });

          // Ensure fromName is never undefined or 'undefined' string
          let cleanFromName = msg.fromName;
          if (!cleanFromName || cleanFromName === 'undefined' || cleanFromName === 'null') {
            if (msg.isOutgoing) {
              cleanFromName = 'You';
            } else if (chat.type === 'private') {
              // For private chats, use the chat title as the sender name
              cleanFromName = chat.title;
            } else if (msg.fromId && msg.fromId !== 'undefined' && msg.fromId !== 'null') {
              cleanFromName = `User ${msg.fromId}`;
            } else {
              cleanFromName = 'Unknown User';
            }
          }

          return {
            ...msg,
            fromName: cleanFromName,
            reactions: msg.reactions || []
          };
        });

        setMessages(processedMessages);
        
        // Messages loaded successfully

        // Auto-scroll to bottom after loading
        setTimeout(() => scrollToBottom('auto'), 100);

        // Mark messages as read
        setTimeout(() => markMessagesAsRead(), 500);

        // Load LLM results after messages are loaded to ensure proper matching
        setTimeout(() => loadLLMResults(), 1000);
      } else {
        setError(response.message || 'Failed to load messages');
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [sessionId, chat]);

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  const markMessagesAsRead = useCallback(async () => {
    if (!chat || messages.length === 0 || markingAsRead) return;
    
    const maxMessageId = Math.max(...messages.map(m => m.id));
    if (lastReadMessageId && maxMessageId <= lastReadMessageId) {
      return; // Already marked as read
    }
    
    try {
      setMarkingAsRead(true);
      const response = await apiClient.markMessagesAsRead(sessionId, chat.id.toString(), maxMessageId);
      
      if (response.success) {
        setLastReadMessageId(maxMessageId);
        onMessagesRead?.(chat.id, maxMessageId);
        console.log(`📖 Marked messages as read up to ${maxMessageId} in chat ${chat.title}`);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    } finally {
      setMarkingAsRead(false);
    }
  }, [sessionId, chat, messages, lastReadMessageId, markingAsRead, onMessagesRead]);

  const formatMessageDate = useCallback((dateString: string) => {
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
  }, []);

  // Load LLM processing results for messages
  const loadLLMResults = useCallback(async () => {
    if (!chat) return;

    try {
      const response = await fetch(`/api/llm-results/${sessionId}/${chat.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.results) {
          setLlmResults(data.results);
        }
      }
    } catch (error) {
      console.error('❌ ChatView: Error loading LLM results:', error);
    }
  }, [sessionId, chat?.id]);

  // Load messages when chat changes
  useEffect(() => {
    if (chat) {
      loadMessages();
      loadLLMResults();
    }
  }, [chat?.id]); // Only depend on chat ID to avoid unnecessary reloads

  // Also reload LLM results periodically to catch any missed updates
  // But only if we don't have any results yet, to avoid unnecessary loading
  useEffect(() => {
    if (chat && Object.keys(llmResults).length === 0) {
      const interval = setInterval(() => {
        console.log('🔄 ChatView: Periodic LLM results refresh (no results yet)');
        loadLLMResults();
      }, 10000); // Refresh every 10 seconds, less frequently

      return () => clearInterval(interval);
    }
  }, [chat, llmResults]); // Depend on llmResults to stop polling once we have some

  // Handle visibility change to mark messages as read
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && chat && messages.length > 0) {
        markMessagesAsRead();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [chat?.id, messages.length]); // Only depend on chat ID and message count, not the function

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, message: Message) => {
    e.preventDefault();

    // Calculate position to ensure menu stays within viewport
    const menuWidth = 200; // Approximate menu width
    const menuHeight = 150; // Approximate menu height
    const padding = 10; // Padding from screen edges

    let x = e.clientX;
    let y = e.clientY;

    // Adjust horizontal position if menu would go off-screen
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (x < padding) {
      x = padding;
    }

    // Adjust vertical position if menu would go off-screen
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }
    if (y < padding) {
      y = padding;
    }

    setContextMenu({
      show: true,
      x,
      y,
      message
    });
  }, [llmResults]);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(prev => ({ ...prev, show: false }));
  }, []);

  // LLM test handlers
  const handleLLMTest = useCallback((message: Message) => {
    setLlmTestModal({
      show: true,
      message
    });
    handleContextMenuClose();
  }, [handleContextMenuClose]);

  const handleLLMTestClose = useCallback(() => {
    setLlmTestModal({
      show: false,
      message: null
    });
  }, []);

  const handleLLMTestResult = useCallback((messageId: number, result: any) => {
    setLlmResults(prev => ({
      ...prev,
      [messageId]: result
    }));
  }, []);

  const handleViewLLMResult = useCallback((message: Message) => {
    const result = llmResults[message.id];
    if (result) {
      setLlmResultModal({
        show: true,
        message,
        result
      });
    }
    handleContextMenuClose();
  }, [llmResults, handleContextMenuClose]);

  const handleLLMResultModalClose = useCallback(() => {
    setLlmResultModal({
      show: false,
      message: null,
      result: null
    });
  }, []);

  // Message action handlers
  const handleReplyToMessage = useCallback((message: Message) => {
    setReplyToMessage({
      id: message.id,
      text: message.text,
      fromName: message.fromName
    });
    handleContextMenuClose();
  }, [handleContextMenuClose]);

  const handleCancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const handleMessageSent = useCallback((sentMessage: any) => {
    console.log('✅ Message sent successfully:', sentMessage);
    
    if (sentMessage) {
      setMessages(prev => [...prev, {
        id: sentMessage.id || Date.now(),
        text: sentMessage.text || '',
        date: sentMessage.date || new Date().toISOString(),
        fromId: sentMessage.fromId,
        fromName: sentMessage.fromName,
        mediaType: sentMessage.mediaType,
        hasMedia: sentMessage.hasMedia,
        mediaInfo: sentMessage.mediaInfo,
        chatId: chat.id,
        isOutgoing: true,
        replyToMsgId: sentMessage.replyToMsgId,
        status: 'sent' as const,
        reactions: []
      }]);

      setTimeout(() => scrollToBottom('smooth'), 100);
    }
  }, [chat.id, scrollToBottom]);

  const handleTypingStart = useCallback(() => {
    console.log('🔤 User started typing');
  }, []);

  const handleTypingStop = useCallback(() => {
    console.log('🔤 User stopped typing');
  }, []);

  const handleReactionAdd = useCallback(async (messageId: number, emoji: string) => {
    console.log(`👍 Adding reaction ${emoji} to message ${messageId}`);
    
    setMessages(prev => prev.map(message => {
      if (message.id === messageId) {
        const reactions = message.reactions || [];
        const existingReaction = reactions.find(r => r.emoji === emoji);
        
        if (existingReaction) {
          return {
            ...message,
            reactions: reactions.map(r => 
              r.emoji === emoji 
                ? { ...r, count: r.count + 1, hasReacted: true }
                : r
            )
          };
        } else {
          return {
            ...message,
            reactions: [...reactions, {
              emoji,
              count: 1,
              users: ['You'],
              hasReacted: true
            }]
          };
        }
      }
      return message;
    }));
  }, []);

  const handleReactionRemove = useCallback(async (messageId: number, emoji: string) => {
    console.log(`👎 Removing reaction ${emoji} from message ${messageId}`);
    
    setMessages(prev => prev.map(message => {
      if (message.id === messageId) {
        const reactions = message.reactions || [];
        
        return {
          ...message,
          reactions: reactions.map(r => 
            r.emoji === emoji 
              ? { ...r, count: Math.max(0, r.count - 1), hasReacted: false }
              : r
          ).filter(r => r.count > 0)
        };
      }
      return message;
    }));
  }, []);

  if (!chat) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Select a chat to start messaging
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Choose a conversation from the sidebar to view messages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Chat Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar
              sessionId={sessionId}
              userId={chat.id.toString()}
              userName={chat.title}
              size={40}
              className="flex-shrink-0"
            />
            
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {chat.title}
              </h2>
              
              {chat.info.username && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  @{chat.info.username}
                </span>
              )}

              {/* Update indicator */}
              {lastUpdateReceived && (
                <div className="text-xs text-green-600 dark:text-green-400">
                  ✅ {lastUpdateReceived}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setLlmDebugPanel(true)}
              className="p-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors"
              title="LLM Debug Panel"
            >
              <Bot className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="Chat settings"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Avatar Cache Debug */}
      {showCacheDebug && (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
          <AvatarCacheDebug />
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          >
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="text-red-500 mb-2">⚠️</div>
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                  <button
                    onClick={loadMessages}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="text-4xl mb-2">💬</div>
                  <p className="text-gray-500 dark:text-gray-400">No messages yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">Start the conversation!</p>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                // Determine message ownership using proper logic
                let isOwnMessage = false;

                if (userInfo?.id && message.fromId) {
                  // Convert both to strings for reliable comparison
                  const userIdStr = userInfo.id.toString();
                  const fromIdStr = message.fromId.toString();
                  isOwnMessage = userIdStr === fromIdStr;

                  // Log ownership detection for debugging
                  console.log(`📨 Message ${message.id}: userIdStr=${userIdStr}, fromIdStr=${fromIdStr}, isOwnMessage=${isOwnMessage}, message.isOutgoing=${message.isOutgoing}`);
                } else {
                  // Fallback to message.isOutgoing if we can't compare IDs
                  isOwnMessage = message.isOutgoing || false;
                }
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    onContextMenu={(e) => handleContextMenu(e, message)}
                  >
                    <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${
                      isOwnMessage ? 'order-2' : 'order-1'
                    }`}>
                      {!isOwnMessage && (
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                            {(() => {
                              const name = message.fromName || 'U';
                              return name.charAt(0).toUpperCase();
                            })()}
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {(() => {
                              // Smart fallback logic for sender names
                              if (message.fromName && message.fromName !== 'undefined' && message.fromName !== 'null') {
                                return message.fromName;
                              } else if (message.isOutgoing) {
                                return 'You';
                              } else if (chat.type === 'private') {
                                // For private chats, the chat title IS the person's name!
                                return chat.title;
                              } else if (message.fromId && message.fromId !== 'undefined' && message.fromId !== 'null') {
                                return `User ${message.fromId}`;
                              } else {
                                return 'Unknown User';
                              }
                            })()}
                          </span>
                        </div>
                      )}
                      
                      <div className={`rounded-2xl px-4 py-2 ${
                        isOwnMessage
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}>
                        {message.hasMedia && (
                          <MediaMessage
                            sessionId={sessionId}
                            chatId={chat.id}
                            messageId={message.id}
                            mediaType={message.mediaType}
                            mediaInfo={message.mediaInfo}
                            className="flex justify-center items-center mb-2"
                          />
                        )}
                        
                        {message.text && (
                          <p className="whitespace-pre-wrap break-words">
                            {message.text}
                          </p>
                        )}
                      </div>

                      <div className={`flex items-center justify-between mt-1 ${
                        isOwnMessage ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        <div className="flex items-center space-x-2">
                          <p className="text-xs">
                            {formatMessageDate(message.date)}
                          </p>
                          {/* LLM Processing Indicator */}
                          {llmResults[message.id] && (
                            <div className="flex items-center space-x-1">
                              <Bot className="w-3 h-3 text-blue-500" />
                              <span className="text-xs text-blue-500">LLM</span>
                            </div>
                          )}
                        </div>
                        {isOwnMessage && (
                          <MessageStatus
                            status={message.status || 'sent'}
                            className="ml-2"
                          />
                        )}
                      </div>

                      <MessageReactions
                        messageId={message.id}
                        reactions={message.reactions}
                        onReactionAdd={(emoji) => handleReactionAdd(message.id, emoji)}
                        onReactionRemove={(emoji) => handleReactionRemove(message.id, emoji)}
                      />
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          <TypingIndicator 
            typingUsers={typingUsers}
            className="px-4 py-2"
          />
        </div>

        {/* Settings Sidebar */}
        {showSettings && (
          <ChatSettingsSidebar
            sessionId={sessionId}
            chatId={chat.id.toString()}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        sessionId={sessionId}
        chatId={chat.id.toString()}
        onMessageSent={handleMessageSent}
        replyToMessage={replyToMessage}
        onCancelReply={handleCancelReply}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        disabled={chat.type === 'channel'}
      />

      {/* Context Menu */}
      {contextMenu.show && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={handleContextMenuClose}
          />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 min-w-[160px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              onClick={() => contextMenu.message && handleReplyToMessage(contextMenu.message)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span>Reply</span>
            </button>

            <button
              onClick={() => {
                if (contextMenu.message) {
                  handleReactionAdd(contextMenu.message.id, '👍');
                }
                handleContextMenuClose();
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
            >
              <span className="text-base">👍</span>
              <span>React</span>
            </button>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>

            {/* LLM Test Option */}
            <button
              onClick={() => contextMenu.message && handleLLMTest(contextMenu.message)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
            >
              <Bot className="w-4 h-4" />
              <span>Test with LLM</span>
            </button>

            {/* View LLM Result Option (only show if result exists) */}
            {contextMenu.message && llmResults[contextMenu.message.id] && (
              <button
                onClick={() => contextMenu.message && handleViewLLMResult(contextMenu.message)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
              >
                <Eye className="w-4 h-4" />
                <span>View LLM Result</span>
              </button>
            )}

            {/* Debug: Show LLM results info */}

          </div>
        </>
      )}

      {/* LLM Test Modal */}
      {llmTestModal.show && llmTestModal.message && (
        <LLMTestModal
          message={llmTestModal.message}
          sessionId={sessionId}
          chatId={chat.id.toString()}
          onClose={handleLLMTestClose}
          onResult={(result) => handleLLMTestResult(llmTestModal.message!.id, result)}
        />
      )}

      {/* LLM Result Modal */}
      {llmResultModal.show && llmResultModal.message && llmResultModal.result && (
        <LLMResultModal
          message={llmResultModal.message}
          result={llmResultModal.result}
          onClose={handleLLMResultModalClose}
        />
      )}

      {/* LLM Debug Panel */}
      <LLMDebugPanel
        sessionId={sessionId}
        chatId={chat.id.toString()}
        isOpen={llmDebugPanel}
        onClose={() => setLlmDebugPanel(false)}
      />
    </div>
  );
});

ChatView.displayName = 'ChatView';

export default ChatView;
