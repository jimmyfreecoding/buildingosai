// 聊天消息类型
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 聊天会话类型
export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// 命令执行结果类型
export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
}

// WebSocket消息类型
export type WebSocketMessageType = 
  | 'terminal-command' 
  | 'output' 
  | 'error' 
  | 'command-complete';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  command?: string;
  data?: string;
  error?: string;
}