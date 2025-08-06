// @ts-nocheck
import React, { useState } from 'react';

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface MessageReactionsProps {
  messageId: number;
  reactions?: Reaction[];
  onReactionAdd?: (emoji: string) => void;
  onReactionRemove?: (emoji: string) => void;
  className?: string;
}

const MessageReactions: React.FC<MessageReactionsProps> = ({
  reactions = [],
  onReactionAdd,
  onReactionRemove,
  className = ''
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥'];

  const handleReactionClick = (reaction: Reaction) => {
    if (reaction.hasReacted) {
      onReactionRemove?.(reaction.emoji);
    } else {
      onReactionAdd?.(reaction.emoji);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    onReactionAdd?.(emoji);
    setShowEmojiPicker(false);
  };

  if (reactions.length === 0 && !showEmojiPicker) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-1 mt-1 ${className}`}>
      {/* Existing Reactions */}
      {reactions.map((reaction, index) => (
        <button
          key={`${reaction.emoji}-${index}`}
          onClick={() => handleReactionClick(reaction)}
          className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
            reaction.hasReacted
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
          title={`${reaction.users.join(', ')} reacted with ${reaction.emoji}`}
        >
          <span>{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}

      {/* Add Reaction Button */}
      <div className="relative">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Add reaction"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowEmojiPicker(false)}
            />
            <div className="absolute bottom-full left-0 mb-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2">
              <div className="grid grid-cols-4 gap-1">
                {commonEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiSelect(emoji)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MessageReactions;
