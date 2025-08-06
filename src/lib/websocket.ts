// @ts-nocheck
export interface WebSocketMessage {
  type: 'message' | 'auth' | 'error' | 'status';
  data: any;
  timestamp: string;
}

export interface TelegramMessage {
  id: number;
  text: string;
  date: string;
  fromId?: number;
  chatId: number;
  chatTitle?: string;
  fromName?: string;
  isOutgoing?: boolean;
  mediaType?: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private sessionId: string | null = null;

  constructor(url: string = `ws://${window.location.host}/ws`) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.ws = null;

          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  private handleMessage(message: WebSocketMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
    }

    // Also trigger a general message handler
    const generalHandler = this.messageHandlers.get('*');
    if (generalHandler) {
      generalHandler(message);
    }
  }

  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  subscribeToSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.send({
      type: 'subscribe',
      sessionId
    });
  }

  unsubscribeFromSession(): void {
    if (this.sessionId) {
      this.send({
        type: 'unsubscribe',
        sessionId: this.sessionId
      });
      this.sessionId = null;
    }
  }

  ping(): void {
    this.send({ type: 'ping' });
  }

  onMessage(handler: (message: TelegramMessage) => void): void {
    this.messageHandlers.set('message', handler);
  }

  onAuth(handler: (data: { isAuthenticated: boolean; userInfo?: any }) => void): void {
    this.messageHandlers.set('auth', handler);
  }

  onError(handler: (error: { message: string }) => void): void {
    this.messageHandlers.set('error', handler);
  }

  onStatus(handler: (status: any) => void): void {
    this.messageHandlers.set('status', handler);
  }

  onAny(handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.set('*', handler);
  }

  removeHandler(type: string): void {
    this.messageHandlers.delete(type);
  }

  disconnect(): void {
    if (this.sessionId) {
      this.unsubscribeFromSession();
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.messageHandlers.clear();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get connectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'unknown';
    }
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();
