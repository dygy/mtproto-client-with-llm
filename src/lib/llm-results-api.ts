// @ts-nocheck
// Client library for LLM Results API

export interface LLMResult {
  id: number;
  messageId: number;
  chatId: number;
  chatTitle: string;
  sessionId?: string;
  provider: string;
  model: string;
  response: string;
  prompt?: string;
  processingTime: number;
  createdAt: string;
  userId: number;
}

export interface LLMResultsResponse {
  success: boolean;
  data: {
    results: LLMResult[];
    pagination: {
      limit: number;
      offset?: number;
      count: number;
      total?: number;
      hasMore: boolean;
    };
    statistics: {
      totalResults: number;
      uniqueChats: number;
      uniqueProviders: number;
      averageProcessingTime: number;
      oldestResult: string;
      newestResult: string;
    };
    filters: {
      sessionId?: string;
      chatId?: string;
      userId?: string;
      provider?: string;
      model?: string;
      since?: string;
      includePrompt?: boolean;
      format?: string;
    };
  };
  timestamp: string;
}

export interface LLMStatsResponse {
  success: boolean;
  data: {
    timeframe: string;
    groupBy: string;
    overall: {
      totalResults: number;
      uniqueChats: number;
      uniqueUsers: number;
      uniqueProviders: number;
      uniqueModels: number;
      averageProcessingTime: number;
      minProcessingTime: number;
      maxProcessingTime: number;
      totalProcessingTime: number;
      oldestResult: string;
      newestResult: string;
    };
    groupedData: any[];
    topModels: Array<{
      provider: string;
      model: string;
      usageCount: number;
      averageProcessingTime: number;
      minProcessingTime: number;
      maxProcessingTime: number;
    }>;
    filters: {
      sessionId?: string;
      chatId?: string;
      timeframe: string;
      groupBy: string;
    };
  };
  timestamp: string;
}

export class LLMResultsAPI {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get latest LLM results with filtering options
   */
  async getLatestResults(options: {
    sessionId?: string;
    chatId?: string;
    userId?: string;
    limit?: number;
    provider?: string;
    model?: string;
    since?: string;
    includePrompt?: boolean;
    format?: 'detailed' | 'summary';
  } = {}): Promise<LLMResultsResponse> {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(`${this.baseUrl}/api/llm-results/latest?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get LLM results for a specific session
   */
  async getSessionResults(sessionId: string, options: {
    chatId?: string;
    limit?: number;
    offset?: number;
    provider?: string;
    model?: string;
    since?: string;
    includePrompt?: boolean;
  } = {}): Promise<LLMResultsResponse> {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(`${this.baseUrl}/api/llm-results/${sessionId}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get LLM usage statistics
   */
  async getStatistics(options: {
    sessionId?: string;
    chatId?: string;
    timeframe?: '1h' | '24h' | '7d' | '30d' | 'all';
    groupBy?: 'provider' | 'model' | 'chat' | 'hour' | 'day';
  } = {}): Promise<LLMStatsResponse> {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await fetch(`${this.baseUrl}/api/llm-results/stats?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a real-time stream connection for LLM results
   */
  createStream(options: {
    sessionId?: string;
    chatId?: string;
    userId?: string;
    provider?: string;
    model?: string;
  } = {}): LLMResultsStream {
    return new LLMResultsStream(this.baseUrl, options);
  }
}

export class LLMResultsStream {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private baseUrl: string;
  private filters: any;

  constructor(baseUrl: string, filters: any) {
    this.baseUrl = baseUrl;
    this.filters = filters;
  }

  /**
   * Connect to the LLM results stream
   */
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    const params = new URLSearchParams();
    Object.entries(this.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const url = `${this.baseUrl}/api/llm-results/stream?${params}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.emit('connected', { timestamp: new Date().toISOString() });
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
        
        if (data.type === 'llm_result') {
          this.emit('result', data.data);
        }
      } catch (error) {
        console.error('Error parsing stream message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      this.emit('error', error);
    };
  }

  /**
   * Disconnect from the stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.emit('disconnected', { timestamp: new Date().toISOString() });
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Check if stream is connected
   */
  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }
}

// Default instance
export const llmResultsAPI = new LLMResultsAPI();
