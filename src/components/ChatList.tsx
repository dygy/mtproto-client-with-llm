// @ts-nocheck
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../lib/api';
import LLMIndicator from './LLMIndicator';
import Avatar from './Avatar';
import { avatarCache } from '../lib/avatar-cache';

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
    isOutgoing?: boolean;
  };
  info: any;
  isArchived: boolean;
  isPinned: boolean;
}

interface ChatListProps {
  sessionId: string;
  onChatSelect: (chat: Chat) => void;
  selectedChatId?: number;
  lastUpdate?: any;
}

const ChatList = React.forwardRef<any, ChatListProps>(({ sessionId, onChatSelect, selectedChatId, lastUpdate }, ref) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    chatId: number | null;
  }>({ show: false, x: 0, y: 0, chatId: null });

  // Note: We now use Telegram's native isPinned from the API instead of localStorage
  // const { getPinnedChatsArray, isPinned, togglePin } = usePinnedChatsStore();

  const loadChats = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await apiClient.getChats(sessionId);

      if (response.success) {
        const chats = response.chats || [];
        setChats(chats);

        // Preload avatars for better UX
        chats.forEach((chat: Chat) => {
          avatarCache.preloadAvatar(sessionId, chat.id.toString(), 'medium');
        });
      } else {
        setError(response.message || 'Failed to load chats');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    // Handle different types of updates
    if (lastUpdate?.type === 'message') {
      handleNewMessage(lastUpdate.data);
    } else if (lastUpdate?.type === 'messagesRead') {
      handleMessagesRead(lastUpdate.data);
    }
  }, [lastUpdate]);

  const handleNewMessage = useCallback((message: any) => {
    if (!message || !message.chatId) return;

    console.log('📝 ChatList: Handling new message for chat', message.chatId);

    // Update the chat list to reflect the new message and resort
    setChats(prevChats => {
      const updatedChats = prevChats.map(chat => {
        if (chat.id === message.chatId) {
          return {
            ...chat,
            lastMessage: {
              id: message.id,
              text: message.text,
              date: message.date,
              fromId: message.fromId,
              fromName: message.fromName
            },
            unreadCount: chat.unreadCount + (message.isOutgoing ? 0 : 1)
          };
        }
        return chat;
      });

      // Resort chats with pinned chats first (using Telegram's isPinned), then by last message date
      return updatedChats.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const aDate = a.lastMessage?.date ? new Date(a.lastMessage.date).getTime() : 0;
        const bDate = b.lastMessage?.date ? new Date(b.lastMessage.date).getTime() : 0;
        return bDate - aDate;
      });
    });
  }, []);

  const handleMessagesRead = useCallback((readData: any) => {
    if (!readData || !readData.chatId) return;

    console.log('📖 ChatList: Handling messages read for chat', readData.chatId);

    // Update the chat list to reset unread count
    setChats(prevChats => {
      const updatedChats = prevChats.map(chat => {
        if (chat.id === readData.chatId) {
          return {
            ...chat,
            unreadCount: 0 // Reset unread count when messages are marked as read
          };
        }
        return chat;
      });

      return updatedChats; // No need to resort for read updates
    });
  }, []);



  const getChatIcon = (chat: Chat) => {
    // Try to use avatar for all chat types
    return (
      <Avatar
        sessionId={sessionId}
        userId={chat.id.toString()}
        userName={chat.title}
        size="medium"
      />
    );
  };



  const handleContextMenu = useCallback((e: React.MouseEvent, chatId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      chatId
    });
  }, []);

  const handlePinToggle = useCallback(async (chatId: number) => {
    try {
      // Call Telegram API to pin/unpin the chat
      const chat = chats.find(c => c.id === chatId);
      if (!chat) return;

      const response = await apiClient.request(`/chats/${sessionId}/pin`, {
        method: 'POST',
        body: JSON.stringify({
          chatId: chatId.toString(),
          pin: !chat.isPinned
        })
      });

      if (response.success) {
        // Update local state
        setChats(prevChats => prevChats.map(c =>
          c.id === chatId ? { ...c, isPinned: !c.isPinned } : c
        ).sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          const aDate = a.lastMessage?.date ? new Date(a.lastMessage.date).getTime() : 0;
          const bDate = b.lastMessage?.date ? new Date(b.lastMessage.date).getTime() : 0;
          return bDate - aDate;
        }));
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    } finally {
      setContextMenu({ show: false, x: 0, y: 0, chatId: null });
    }
  }, [chats, sessionId]);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ show: false, x: 0, y: 0, chatId: null });
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    if (contextMenu.show) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.show, closeContextMenu]);

  // Filter and sort chats whenever they change or search query changes
  const filteredAndSortedChats = useMemo(() => {
    let filteredChats = chats;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredChats = chats.filter(chat =>
        chat.title.toLowerCase().includes(query) ||
        chat.lastMessage?.text.toLowerCase().includes(query) ||
        (chat.info.username && chat.info.username.toLowerCase().includes(query))
      );
    }

    // Sort with pinned chats first (using Telegram's isPinned)
    return filteredChats.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const aDate = a.lastMessage?.date ? new Date(a.lastMessage.date).getTime() : 0;
      const bDate = b.lastMessage?.date ? new Date(b.lastMessage.date).getTime() : 0;
      return bDate - aDate;
    });
  }, [chats, searchQuery]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Loading chats...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <button
            onClick={loadChats}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-gray-600 dark:text-gray-400">No chats found</p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Start a conversation to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chats</h2>
        </div>

        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 h-0 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
        {filteredAndSortedChats.length === 0 && searchQuery ? (
          <div className="p-4 text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">No chats found</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Try a different search term</p>
          </div>
        ) : (
          filteredAndSortedChats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onChatSelect(chat)}
            onContextMenu={(e) => handleContextMenu(e, chat.id)}
            className={`group p-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 relative ${
              selectedChatId === chat.id
                ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500'
                : ''
            }`}
          >
            {/* Pin icon in top-left corner */}
            {chat.isPinned && (
              <div className="absolute top-2 left-2 z-10">
                <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 6.707 6.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            <div className="flex items-center space-x-3">
              {getChatIcon(chat)}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {chat.title}
                  </p>
                  <div className="flex items-center space-x-1">
                    {chat.lastMessage && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(chat.lastMessage.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {chat.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                        {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>

                {chat.lastMessage && (
                  <div className="flex items-center gap-1 mt-1">
                    {/* Read indicator for outgoing messages */}
                    {chat.lastMessage.isOutgoing && (
                      <div className="flex-shrink-0">
                        {chat.unreadCount === 0 ? (
                          // Double checkmark (read) - blue
                          <div className="flex -space-x-1" title="Read">
                            <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        ) : (
                          // Double checkmark (delivered) - gray
                          <div className="flex -space-x-1" title="Delivered">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )}
                    <p className={`text-sm truncate max-w-full overflow-hidden ${
                      chat.unreadCount > 0 ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {chat.lastMessage.fromName && chat.type !== 'private' && (
                        <span className="font-medium">{chat.lastMessage.fromName}: </span>
                      )}
                      {chat.lastMessage.text}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      chat.type === 'private' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      chat.type === 'bot' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      chat.type === 'group' || chat.type === 'supergroup' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {chat.type}
                    </span>

                    {chat.info.participantsCount && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {chat.info.participantsCount} members
                      </span>
                    )}
                  </div>

                  {/* LLM Status Indicator */}
                  <LLMIndicator
                    sessionId={sessionId}
                    chatId={chat.id.toString()}
                  />
                </div>
              </div>
            </div>
          </div>
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.show && contextMenu.chatId && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-[120px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handlePinToggle(contextMenu.chatId!)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 6.707 6.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{chats.find(c => c.id === contextMenu.chatId)?.isPinned ? 'Unpin Chat' : 'Pin Chat'}</span>
          </button>
        </div>
      )}
    </div>
  );
});

ChatList.displayName = 'ChatList';

export default ChatList;
