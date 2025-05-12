export interface WebSocketMessage {
  type: string;
  data?: string;
  error?: string;
  command?: string;
  // Tab 补全相关字段
  text?: string;
  cursorPosition?: number;
  completions?: string[];
  startIndex?: number;
  endIndex?: number;
}