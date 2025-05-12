import { Router, Request, Response } from 'express';
import { chatAgent } from '../mastra/agents/chatAgent';
import { ChatMessage } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// 存储聊天历史
const chatHistory: Record<string, ChatMessage[]> = {};

// 处理聊天请求
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    console.log('Received chat request:', { message, sessionId });
    
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing sessionId or message' });
    }
    
    // 获取或创建会话历史
    if (!chatHistory[sessionId]) {
      chatHistory[sessionId] = [];
    }
    
    // 添加用户消息到历史
    chatHistory[sessionId].push({ role: 'user', content: message });
    
    try {
      // 调用AI生成回复
      console.log('Generating response with chatAgent...');
      const response = await chatAgent.generate(chatHistory[sessionId]);
      console.log('Response generated:', response);
      
      // 添加AI回复到历史
      chatHistory[sessionId].push({ role: 'assistant', content: response.text });
      
      // 检查是否有工具调用，特别是命令执行
      let messageType = 'text';
      let commandToExecute = null;
      
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log('Tool calls detected:', response.toolCalls);
        
        for (const toolCall of response.toolCalls) {
          console.log('Processing tool call:', toolCall);
          
          // 使用 toolName 代替 name
          if (toolCall.toolName === 'Execute Server Command' || toolCall.toolName === 'mcpTool') {
            messageType = 'command';
            console.log('Command execution tool detected');
            
            // 从工具调用中提取命令，使用 args 代替 input
            if (toolCall.args && toolCall.args.command) {
              commandToExecute = toolCall.args.command;
              console.log('Command extracted from args.command:', commandToExecute);
            } else if (toolCall.args && toolCall.args.context && toolCall.args.context.command) {
              commandToExecute = toolCall.args.context.command;
              console.log('Command extracted from args.context.command:', commandToExecute);
            }
            break;
          }
        }
      }
      
      // 构建响应对象
      const responseObj = { 
        message: response.text,
        sessionId: sessionId,
        type: messageType,
        command: commandToExecute
      };
      
      console.log('Sending response to client:', responseObj);
      
      // 返回AI回复，包含消息类型和可能的命令
      res.json(responseObj);
    } catch (error) {
      console.error('Error generating response:', error);
      // 添加错误消息到历史
      chatHistory[sessionId].push({ 
        role: 'assistant', 
        content: 'I encountered an error processing your request. Please try again.' 
      });
      
      // 返回错误消息
      res.json({
        message: 'I encountered an error processing your request. Please try again.',
        sessionId: sessionId,
        type: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      type: 'error'
    });
  }
});

// 获取聊天历史
router.get('/history/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  if (!chatHistory[sessionId]) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ 
    sessionId,
    messages: chatHistory[sessionId]
  });
});

// 清除聊天历史
router.delete('/history/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  if (chatHistory[sessionId]) {
    delete chatHistory[sessionId];
  }
  
  res.json({ success: true });
});

export default router;



