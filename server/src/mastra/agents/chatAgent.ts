import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { mcpTool } from '../tools/mcpTool';
import { taskTool, getTaskTool } from '../tools/taskTool';
import { ChatMessage } from '../../types';
import dotenv from 'dotenv';

// 确保环境变量已加载
dotenv.config();

// 获取SSH配置
const SSH_HOST = process.env.SSH_HOST || 'localhost';
const SSH_USERNAME = process.env.SSH_USERNAME || 'user';

// 创建聊天代理
const chatAgent = new Agent({
  name: 'chat-agent',
  instructions: 
    'You are a helpful assistant that can chat with users and execute server commands when needed.response lanugage is base user input ' +
    `When a user asks you to perform an operation on the server, use the "Execute Server Command" tool. ` +
    `The default server is ${SSH_HOST} (username: ${SSH_USERNAME}), which is already configured. ` +
    'You do not need to specify connection details when executing commands. ' +
    'After executing a command, explain the results to the user in a clear and concise manner. ' +
    'Only use the command execution tool when explicitly asked to perform server operations. ' +
    '\n\n' +
    'IMPORTANT: When a user asks to execute a task like "buildingos-install", you should: ' +
    '1. First use the "Get Task Information" tool with the taskId parameter set to the task name (e.g., "buildingos-install") ' +
    '2. Then guide the user through each step using the "Execute Task Step" tool with both taskId and stepId parameters ' +
    '3. Always explain what each step does before executing it, and explain the results after execution ' +
    '\n\n' +
    'For example, if the user says "执行buildingos-install", you should: ' +
    '1. Use the "Get Task Information" tool with input: { taskId: "buildingos-install" } ' +
    '2. For the first step with ID "check-prerequisites", use the "Execute Task Step" tool with input: { taskId: "buildingos-install", stepId: "check-prerequisites" } ' +
    '3. Continue with each step in order',
  model: openai('gpt-4o-mini'),
  tools: {
    mcpTool,
    taskTool,
    getTaskTool,
  },
});

// 包装生成方法以处理错误
const generate = async (messages: ChatMessage[]) => {
  try {
    // 将消息转换为适合模型的格式
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // 调用模型生成回复
    const response = await chatAgent.generate(formattedMessages);
    return response;
  } catch (error) {
    console.error('Error in chatAgent.generate:', error);
    // 返回一个默认响应
    return {
      text: 'I encountered an error processing your request. Please try again.',
      toolCalls: []
    };
  }
};

// 导出带有错误处理的聊天代理
export const chatAgentWithErrorHandling = {
  ...chatAgent,
  generate
};

// 为了兼容性，也导出原始的chatAgent
export { chatAgent };






