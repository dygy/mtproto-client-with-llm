// @ts-nocheck
const API_BASE_URL = (typeof window !== 'undefined' && (window as any).location)
  ? '/api'
  : 'http://localhost:4321/api';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    };

    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Check if this is an auth error that requires logout
      if (errorData.shouldLogout) {
        console.log(`🚪 API Client: Auth error requires logout: ${errorData.errorCode} - ${errorData.message}`);

        // Clear local storage
        localStorage.removeItem('telegram_session_id');
        localStorage.removeItem('telegram_user_info');
        localStorage.removeItem('telegram_user_id');

        // Show error message and reload
        alert(`Authentication Error: ${errorData.message}\n\nYou will be redirected to the login page.`);
        window.location.reload();
        return;
      }

      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Also check for auth errors in successful responses (status 200 but shouldLogout: true)
    if (data.shouldLogout) {


      // Clear local storage
      localStorage.removeItem('telegram_session_id');
      localStorage.removeItem('telegram_user_info');
      localStorage.removeItem('telegram_user_id');

      // Show error message and reload
      alert(`Authentication Error: ${data.message}\n\nYou will be redirected to the login page.`);
      window.location.reload();
      return;
    }

    return data;
  }

  async sendCode(phoneNumber: string): Promise<ApiResponse> {
    return this.request('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  }

  async verifyCode(
    phoneNumber: string,
    code: string,
    phoneCodeHash: string,
    sessionId: string
  ): Promise<ApiResponse> {
    return this.request('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber,
        code,
        phoneCodeHash,
        sessionId,
      }),
    });
  }

  async getSessionInfo(sessionId: string): Promise<ApiResponse> {
    return this.request(`/session/${sessionId}`);
  }

  async getMessages(sessionId: string, limit: number = 50): Promise<ApiResponse> {
    return this.request(`/messages/${sessionId}?limit=${limit}`);
  }

  async getChats(sessionId: string, limit: number = 50): Promise<ApiResponse> {
    return this.request(`/chats/${sessionId}?limit=${limit}`);
  }

  async getChatMessages(sessionId: string, chatId: string, limit: number = 50, offsetId?: number, afterId?: number): Promise<ApiResponse> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (offsetId) {
      params.append('offsetId', offsetId.toString());
    }
    if (afterId) {
      params.append('afterId', afterId.toString());
    }
    return this.request(`/chats/${sessionId}/${chatId}/messages?${params}`);
  }

  async deleteSession(sessionId: string): Promise<ApiResponse> {
    return this.request(`/session/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async healthCheck(): Promise<ApiResponse> {
    return this.request('/health');
  }

  async listSessions(): Promise<ApiResponse> {
    return this.request('/sessions');
  }

  async getChatSettings(sessionId: string, chatId: string): Promise<ApiResponse> {
    return this.request(`/chat-settings/${sessionId}/${chatId}`);
  }

  async updateChatSettings(sessionId: string, chatId: string, settings: {
    llmEnabled: boolean;
    llmProvider: string;
    llmModel: string;
    llmPrompt: string;
    autoReply: boolean;
    keywords: string[];
    notifications: boolean;
  }): Promise<ApiResponse> {
    try {
      // Use JSON instead of FormData for better API consistency
      const response = await this.request('/chat-settings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          chatId,
          llmEnabled: settings.llmEnabled,
          llmProvider: settings.llmProvider,
          llmModel: settings.llmModel,
          llmPrompt: settings.llmPrompt,
          autoReply: settings.autoReply,
          keywords: settings.keywords,
          notifications: settings.notifications
        }),
      });
      return response;
    } catch (error) {
      console.error('Error updating chat settings:', error);
      throw error;
    }
  }

  getUserAvatar(sessionId: string, userId: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    const url = `${this.baseUrl}/avatars/${sessionId}/${userId}?size=${size}`;
    return url;
  }

  async setupUpdates(sessionId: string): Promise<ApiResponse> {
    return this.request(`/debug/setup-updates/${sessionId}`, {
      method: 'POST',
    });
  }

  async testClient(sessionId: string): Promise<ApiResponse> {
    return this.request(`/debug/test-client/${sessionId}`);
  }

  async markMessagesAsRead(sessionId: string, chatId: string, maxId: number): Promise<ApiResponse> {
    return this.request(`/messages/${sessionId}/${chatId}/read`, {
      method: 'POST',
      body: JSON.stringify({ maxId }),
    });
  }

  getMediaUrl(sessionId: string, chatId: string, messageId: number, thumbnail = false): string {
    const params = thumbnail ? '?thumbnail=true' : '';
    return `${this.baseUrl}/media/${sessionId}/${chatId}/${messageId}${params}`;
  }

  async sendMessage(sessionId: string, chatId: string, text: string, replyToMsgId?: number): Promise<ApiResponse> {
    return this.request(`/messages/${sessionId}/${chatId}/send`, {
      method: 'POST',
      body: JSON.stringify({
        text,
        replyToMsgId
      }),
    });
  }

  async sendMediaMessage(sessionId: string, chatId: string, file: File, caption?: string): Promise<ApiResponse> {
    const formData = new FormData();
    formData.append('media', file);
    if (caption) {
      formData.append('caption', caption);
    }

    return this.request(`/messages/${sessionId}/${chatId}/send-media`, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
      },
    });
  }

  async deleteMessage(sessionId: string, chatId: string, messageId: number): Promise<ApiResponse> {
    return this.request(`/messages/${sessionId}/${chatId}/${messageId}`, {
      method: 'DELETE',
    });
  }

  async editMessage(sessionId: string, chatId: string, messageId: number, newText: string): Promise<ApiResponse> {
    return this.request(`/messages/${sessionId}/${chatId}/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ text: newText }),
    });
  }
}

export const apiClient = new ApiClient();

// Helper functions for localStorage
export const storage = {
  setSessionId: (sessionId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('telegram_session_id', sessionId);
    }
  },

  getSessionId: (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('telegram_session_id');
    }
    return null;
  },

  removeSessionId: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('telegram_session_id');
    }
  },

  setUserInfo: (userInfo: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('telegram_user_info', JSON.stringify(userInfo));
    }
  },

  getUserInfo: () => {
    if (typeof window !== 'undefined') {
      const userInfo = localStorage.getItem('telegram_user_info');
      return userInfo ? JSON.parse(userInfo) : null;
    }
    return null;
  },

  removeUserInfo: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('telegram_user_info');
    }
  },

  clear: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('telegram_session_id');
      localStorage.removeItem('telegram_user_info');
    }
  }
};
