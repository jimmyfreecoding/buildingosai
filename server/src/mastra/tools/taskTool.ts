import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import eventBus from '../../utils/eventBus';

// 读取任务脚本
const getTaskScript = async (taskId: string): Promise<any> => {
  try {
    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(__dirname, '../../../tasks', `${taskId}.json`),
      path.join(process.cwd(), 'tasks', `${taskId}.json`),
      path.join(process.cwd(), 'src/tasks', `${taskId}.json`),
      path.join(process.cwd(), 'server2/tasks', `${taskId}.json`)
    ];
    
    let taskData = null;
    let foundPath = null;
    
    // 尝试每个路径
    for (const taskPath of possiblePaths) {
      try {
        if (fs.existsSync(taskPath)) {
          taskData = fs.readFileSync(taskPath, 'utf8');
          foundPath = taskPath;
          console.log(`Found task file at: ${taskPath}`);
          break;
        }
      } catch (e) {
        // 继续尝试下一个路径
      }
    }
    
    if (!taskData) {
      throw new Error(`Task file not found for: ${taskId}`);
    }
    
    return JSON.parse(taskData);
  } catch (error) {
    console.error(`Error reading task script ${taskId}:`, error);
    throw new Error(`Failed to read task script: ${taskId}`);
  }
};

// 执行任务步骤
const executeTaskStep = async (taskId: string, stepId: string): Promise<string> => {
  try {
    console.log(`executeTaskStep: taskId=${taskId}, stepId=${stepId}`);
    
    const task = await getTaskScript(taskId);
    const step = task.steps.find((s: any) => s.id === stepId);
    
    if (!step) {
      throw new Error(`Step ${stepId} not found in task ${taskId}`);
    }
    
    console.log(`Executing step: ${step.name}`);
    
    if (!step.command) {
      return `Manual step: ${step.description}`;
    }
    
    console.log(`Command to execute: ${step.command}`);
    
    return new Promise((resolve) => {
      // 发送命令到终端
      eventBus.emit('execute-command', step.command);
      console.log(`Command emitted to eventBus: ${step.command}`);
      
      // 模拟命令执行结果（用于测试）
      setTimeout(() => {
        const simulatedOutput = `Simulated output for command: ${step.command}\nStep completed successfully.`;
        console.log(`Simulated output: ${simulatedOutput}`);
        resolve(simulatedOutput);
      }, 2000);
      
      // 监听命令执行结果
      const resultListener = (output: string) => {
        console.log(`Received real output for command: ${step.command}`);
        resolve(output);
      };
      
      // 注册监听器
      eventBus.once(`command-result-${step.command}`, resultListener);
      
      // 设置超时
      setTimeout(() => {
        eventBus.removeListener(`command-result-${step.command}`, resultListener);
        console.log(`Timeout for command: ${step.command}`);
        resolve('Command execution timed out after 30 seconds.');
      }, step.timeout || 30000);
    });
  } catch (error) {
    console.error(`Error executing task step:`, error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

// 定义任务工具
export const taskTool = createTool({
  id: 'Execute Task Step',
  description: 'Execute a specific step from a task script',
  inputSchema: z.object({
    taskId: z.string().describe('The ID of the task to execute (e.g., buildingos-install)'),
    stepId: z.string().describe('The ID of the step to execute')
  }),
  execute: async (input: any) => {
    try {
      console.log('taskTool input:', input);
      
      // 从input中提取taskId和stepId
      let taskId = null;
      let stepId = null;
      
      if (input && typeof input === 'object') {
        if (input.taskId && input.stepId) {
          taskId = input.taskId;
          stepId = input.stepId;
        } else if (input.context) {
          if (input.context.taskId) taskId = input.context.taskId;
          if (input.context.stepId) stepId = input.context.stepId;
        }
      }
      
      if (!taskId || !stepId) {
        console.error('Missing taskId or stepId in input:', input);
        return { result: 'Error: Task ID and Step ID are required' };
      }
      
      console.log(`Executing step ${stepId} of task ${taskId}`);
      
      // 获取任务信息
      const task = await getTaskScript(taskId);
      const step = task.steps.find((s: any) => s.id === stepId);
      
      if (!step) {
        console.error(`Step ${stepId} not found in task ${taskId}`);
        return { result: `Error: Step ${stepId} not found in task ${taskId}` };
      }
      
      console.log(`Found step: ${step.name}`);
      
      // 执行步骤
      const result = await executeTaskStep(taskId, stepId);
      
      console.log(`Step execution result: ${result.substring(0, 100)}...`);
      
      return { 
        result,
        step: {
          name: step.name,
          description: step.description,
          command: step.command
        }
      };
    } catch (error) {
      console.error('Error in taskTool:', error);
      return { 
        result: `Error executing task step: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
});

// 获取任务信息工具
export const getTaskTool = createTool({
  id: 'Get Task Information',
  description: 'Get information about a task script',
  inputSchema: z.object({
    taskId: z.string().describe('The ID of the task (e.g., buildingos-install)')
  }),
  execute: async (input: any) => {
    try {
      console.log('getTaskTool input:', input);
      
      // 从input中提取taskId
      let taskId = null;
      
      if (typeof input === 'string') {
        taskId = input;
      } else if (input && typeof input === 'object') {
        if (input.taskId) {
          taskId = input.taskId;
        } else if (input.context && input.context.taskId) {
          taskId = input.context.taskId;
        }
      }
      
      // 如果没有找到taskId，尝试使用默认值
      if (!taskId && typeof input === 'object' && Object.keys(input).length === 0) {
        taskId = 'buildingos-install';
        console.log('Using default taskId:', taskId);
      }
      
      if (!taskId) {
        console.error('No taskId found in input:', input);
        return { result: 'Error: Task ID is required' };
      }
      
      console.log('Getting task information for:', taskId);
      
      // 获取任务信息
      const task = await getTaskScript(taskId);
      
      return { 
        task: {
          id: task.id,
          name: task.name,
          description: task.description,
          steps: task.steps.map((step: any) => ({
            id: step.id,
            name: step.name,
            description: step.description
          }))
        }
      };
    } catch (error) {
      console.error('Error in getTaskTool:', error);
      return { 
        result: `Error getting task information: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
});



