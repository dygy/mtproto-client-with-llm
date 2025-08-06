// @ts-nocheck
// Simple event bus for managing updates across components

type EventCallback = (data: any) => void;

class EventBus {
  private events: Map<string, EventCallback[]> = new Map();

  // Subscribe to an event
  on(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    
    this.events.get(event)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.events.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // Emit an event
  emit(event: string, data?: any): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  // Remove all listeners for an event
  off(event: string): void {
    this.events.delete(event);
  }

  // Remove all listeners
  clear(): void {
    this.events.clear();
  }
}

// Export singleton instance
export const eventBus = new EventBus();

// Event types
export const EVENTS = {
  NEW_MESSAGE: 'new_message',
  LLM_RESULT: 'llm_result',
  AUTH_ERROR: 'auth_error',
  CHAT_UPDATED: 'chat_updated',
  MESSAGE_READ: 'message_read'
} as const;
