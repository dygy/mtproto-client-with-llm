// @ts-nocheck
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PinnedChatsState {
  pinnedChats: Set<string>; // Set of chat IDs (as strings)
  isPinned: (chatId: string | number) => boolean;
  togglePin: (chatId: string | number) => void;
  pinChat: (chatId: string | number) => void;
  unpinChat: (chatId: string | number) => void;
  getPinnedChatsArray: () => string[];
}

export const usePinnedChatsStore = create<PinnedChatsState>()(
  persist(
    (set, get) => ({
      pinnedChats: new Set<string>(),

      isPinned: (chatId: string | number) => {
        const id = String(chatId);
        const state = get();
        return state.pinnedChats.has(id);
      },

      togglePin: (chatId: string | number) => {
        const id = String(chatId);
        const { pinnedChats } = get();
        const newPinnedChats = new Set(pinnedChats);

        if (newPinnedChats.has(id)) {
          newPinnedChats.delete(id);
          console.log(`📌 Unpinned chat ${id}`);
        } else {
          newPinnedChats.add(id);
          console.log(`📌 Pinned chat ${id}`);
        }

        set({ pinnedChats: newPinnedChats });
        console.log(`📌 Current pinned chats:`, Array.from(newPinnedChats));
      },

      pinChat: (chatId: string | number) => {
        const id = String(chatId);
        const { pinnedChats } = get();
        const newPinnedChats = new Set(pinnedChats);
        newPinnedChats.add(id);
        set({ pinnedChats: newPinnedChats });
      },

      unpinChat: (chatId: string | number) => {
        const id = String(chatId);
        const { pinnedChats } = get();
        const newPinnedChats = new Set(pinnedChats);
        newPinnedChats.delete(id);
        set({ pinnedChats: newPinnedChats });
      },

      getPinnedChatsArray: () => {
        return Array.from(get().pinnedChats);
      },
    }),
    {
      name: 'pinned-chats-storage',
      // Custom storage implementation to handle Set serialization
      storage: {
        getItem: (name: string) => {
          const str = localStorage.getItem(name);
          if (!str) {
            console.log('📌 No pinned chats found in localStorage');
            return null;
          }

          try {
            const parsed = JSON.parse(str);
            // Convert array back to Set
            if (parsed.state && Array.isArray(parsed.state.pinnedChats)) {
              parsed.state.pinnedChats = new Set(parsed.state.pinnedChats);
              console.log('📌 Loaded pinned chats from localStorage:', Array.from(parsed.state.pinnedChats));
            }
            return parsed;
          } catch (error) {
            console.error('Error parsing pinned chats from localStorage:', error);
            return null;
          }
        },
        setItem: (name: string, value: any) => {
          try {
            // Convert Set to array for serialization
            const serializable = {
              ...value,
              state: {
                ...value.state,
                pinnedChats: Array.from(value.state.pinnedChats)
              }
            };
            localStorage.setItem(name, JSON.stringify(serializable));
            console.log('📌 Saved pinned chats to localStorage:', serializable.state.pinnedChats);
          } catch (error) {
            console.error('Error saving pinned chats to localStorage:', error);
          }
        },
        removeItem: (name: string) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);

// Helper function to sort chats with pinned chats first
export function sortChatsWithPinned<T extends { id: string | number; lastMessage?: { date: string } }>(
  chats: T[],
  pinnedChatIds: string[]
): T[] {
  return chats.sort((a, b) => {
    const aId = String(a.id);
    const bId = String(b.id);
    const aIsPinned = pinnedChatIds.includes(aId);
    const bIsPinned = pinnedChatIds.includes(bId);

    // Pinned chats come first
    if (aIsPinned && !bIsPinned) return -1;
    if (!aIsPinned && bIsPinned) return 1;

    // Within pinned or unpinned groups, sort by last message date (newest first)
    const aDate = a.lastMessage?.date ? new Date(a.lastMessage.date).getTime() : 0;
    const bDate = b.lastMessage?.date ? new Date(b.lastMessage.date).getTime() : 0;
    
    return bDate - aDate;
  });
}
