// @ts-nocheck
// Database types for SQLite results

export interface ChatSettingsRow {
  id: number;
  session_id: string;
  chat_id: string;
  llm_enabled: number; // SQLite stores booleans as integers
  llm_provider: string; // LLM provider (openai, claude, mistral, gemini)
  llm_model: string; // Specific model name
  llm_prompt: string;
  auto_reply: number; // SQLite stores booleans as integers
  keywords: string;
  notifications: number; // SQLite stores booleans as integers
  created_at: string;
  updated_at: string;
}

export interface LLMProcessingLogRow {
  id: number;
  session_id: string;
  chat_id: string;
  message_id: string;
  original_message: string;
  llm_prompt: string;
  llm_response: string | null;
  processing_time_ms: number;
  success: number; // SQLite stores booleans as integers
  error_message: string | null;
  auto_replied: number; // SQLite stores booleans as integers
  created_at: string;
}

export interface LLMStatsRow {
  id: number;
  session_id: string;
  chat_id: string;
  total_processed: number;
  total_replied: number;
  last_activity: string;
}

// API Response types
export interface ApiResponse {
  success: boolean;
  message?: string;
  phoneCodeHash?: string;
  sessionId?: string;
  token?: string;
  expires?: number;
  healthy?: boolean;
  authenticated?: boolean;
  expired?: boolean;
  sessions?: any[];
  userInfo?: any;
  chats?: any[];
  messages?: any[];
  settings?: any;
  data?: any;
}

// Chat and Message types
export interface Chat {
  id: string | number;
  title: string;
  unreadCount: number;
  lastMessage?: {
    text: string;
    date: string | number;
  };
}

export interface Message {
  id: string | number;
  text: string;
  date: number;
  out: boolean;
  fromId?: string;
}

export interface UserInfo {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
}
