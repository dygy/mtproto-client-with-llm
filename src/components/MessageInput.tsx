// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { apiClient } from '../lib/api';

interface MessageInputProps {
  sessionId: string;
  chatId: string;
  onMessageSent?: (message: any) => void;
  replyToMessage?: {
    id: number;
    text: string;
    fromName?: string;
  } | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  sessionId,
  chatId,
  onMessageSent,
  replyToMessage,
  onCancelReply,
  disabled = false,
  onTypingStart,
  onTypingStop
}) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || sending || disabled) return;

    try {
      setSending(true);
      
      const response = await apiClient.sendMessage(
        sessionId,
        chatId,
        message.trim(),
        replyToMessage?.id
      );

      if (response.success) {
        setMessage('');
        if (onMessageSent) {
          onMessageSent(response.message);
        }
        if (onCancelReply) {
          onCancelReply();
        }
        
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } else {
        console.error('Failed to send message:', response.message);
        alert('Failed to send message: ' + response.message);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSending(false);
    }
  }, [message, sending, disabled, sessionId, chatId, replyToMessage, onMessageSent, onCancelReply]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  }, [handleSubmit]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setMessage(newValue);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';

    // Handle typing indicators
    if (newValue.trim() && !isTyping) {
      setIsTyping(true);
      onTypingStart?.();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    if (newValue.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTypingStop?.();
      }, 3000); // Stop typing indicator after 3 seconds of inactivity
    } else {
      setIsTyping(false);
      onTypingStop?.();
    }
  }, [isTyping, onTypingStart, onTypingStop]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleMediaUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;

    try {
      setSending(true);
      
      const response = await apiClient.sendMediaMessage(sessionId, chatId, file, message.trim() || undefined);

      if (response.success) {
        setMessage('');
        if (onMessageSent) {
          onMessageSent(response.message);
        }
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        console.error('Failed to send media:', response.message);
        alert('Failed to send media: ' + response.message);
      }
    } catch (error) {
      console.error('Error sending media:', error);
      alert('Error sending media: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSending(false);
      setShowMediaUpload(false);
    }
  }, [sessionId, chatId, message, disabled, onMessageSent]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Reply Preview */}
      {replyToMessage && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Replying to {replyToMessage.fromName || 'message'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                    {replyToMessage.text}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={onCancelReply}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex items-end space-x-2">
          {/* Media Upload Button */}
          <button
            type="button"
            onClick={() => setShowMediaUpload(!showMediaUpload)}
            disabled={disabled || sending}
            className={`p-2 rounded-full transition-colors ${
              disabled || sending
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Attach media"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? "Chat is read-only" : "Type a message..."}
              disabled={disabled || sending}
              className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                disabled || sending ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!message.trim() || sending || disabled}
            className={`p-2 rounded-full transition-colors ${
              !message.trim() || sending || disabled
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            title="Send message"
          >
            {sending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>

        {/* Media Upload Options */}
        {showMediaUpload && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center space-x-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleMediaUpload}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                className="hidden"
                disabled={disabled || sending}
              />
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || sending}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span>Upload File</span>
              </button>
              
              <button
                type="button"
                onClick={() => setShowMediaUpload(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default MessageInput;
