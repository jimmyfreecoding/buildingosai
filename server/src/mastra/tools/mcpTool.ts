import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import eventBus from '../../utils/eventBus';

// 执行命令并等待结果
const executeCommand = async (command: string): Promise<string> => {
  console.log(`executeCommand called with: "${command}"`);
  
  return new Promise((resolve) => {
    // 发送命令到终端
    eventBus.emit('execute-command', command);
    console.log(`Command emitted to eventBus: "${command}"`);
    
    // 监听命令执行结果
    const resultListener = (output: string) => {
      console.log(`Received result for command "${command}"`);
      resolve(output);
    };
    
    // 注册监听器
    eventBus.once(`command-result-${command}`, resultListener);
    console.log(`Listener registered for command "${command}"`);
    
    // 设置超时
    setTimeout(() => {
      // 移除监听器
      eventBus.removeListener(`command-result-${command}`, resultListener);
      console.log(`Timeout for command "${command}"`);
      resolve('Command execution timed out after 30 seconds.');
    }, 30000);
  });
};

// 定义MCP工具
export const mcpTool = createTool({
  id: 'Execute Server Command',
  description: 'Execute a command on the server and return the result',
  inputSchema: z.object({
    command: z.string().describe('The command to execute on the server')
  }),
  execute: async (input: any) => {
    try {
      console.log('mcpTool.execute called with input:', input);
      
      // 从input.context.command获取命令
      let command = null;
      
      if (input && typeof input === 'object') {
        if (input.context && input.context.command) {
          command = input.context.command;
          console.log('Found command in input.context.command:', command);
        }
      }
      
      if (!command) {
        console.error('No command found in input');
        return { result: 'Error: No command provided' };
      }
      
      // 执行命令并获取结果
      const result = await executeCommand(command);
      
      console.log(`Command result: ${result.substring(0, 100)}${result.length > 100 ? '...' : ''}`);
      
      return { result };
    } catch (error) {
      console.error('Error executing command:', error);
      return { 
        result: `Error executing command: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
});










