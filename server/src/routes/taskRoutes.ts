import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const router = express.Router();

// 获取任务列表
router.get('/tasks', (req, res) => {
  try {
    const tasksDir = path.join(__dirname, '../../tasks');
    
    // 确保任务目录存在
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }
    
    const files = fs.readdirSync(tasksDir);
    
    const tasks = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const taskData = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf8'));
        return {
          id: taskData.id,
          name: taskData.name,
          description: taskData.description,
          version: taskData.version
        };
      });
    
    res.json(tasks);
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// 获取特定任务
router.get('/tasks/:id', (req, res) => {
  try {
    const taskId = req.params.id;
    const tasksDir = path.join(__dirname, '../../tasks');
    
    // 确保任务目录存在
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const files = fs.readdirSync(tasksDir);
    
    const taskFile = files.find(file => {
      if (!file.endsWith('.json')) return false;
      const data = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf8'));
      return data.id === taskId;
    });
    
    if (!taskFile) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const taskData = JSON.parse(fs.readFileSync(path.join(tasksDir, taskFile), 'utf8'));
    res.json(taskData);
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// 执行命令
router.post('/execute-command', async (req, res) => {
  try {
    const { command, timeout = 30000 } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    // 设置超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Command execution timed out')), timeout);
    });
    
    // 执行命令
    try {
      const { stdout, stderr } = await Promise.race([
        execPromise(command),
        timeoutPromise
      ]) as { stdout: string, stderr: string };
      
      // 返回结果
      res.json({
        result: stdout || stderr,
        error: stderr ? stderr : null
      });
    } catch (execError) {
      console.error('Command execution error:', execError);
      res.status(500).json({
        result: `Error: ${execError instanceof Error ? execError.message : String(execError)}`,
        error: execError instanceof Error ? execError.message : String(execError)
      });
    }
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({
      result: `Error: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// 执行脚本
router.post('/execute-script', async (req, res) => {
  try {
    const { script, timeout = 30000 } = req.body;
    
    if (!script) {
      return res.status(400).json({ error: 'Script is required' });
    }
    
    // 创建临时脚本文件
    const tempDir = path.join(__dirname, '../../temp');
    
    // 确保临时目录存在
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const scriptFile = path.join(tempDir, `script_${Date.now()}.sh`);
    fs.writeFileSync(scriptFile, script, { mode: 0o755 });
    
    // 设置超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Script execution timed out')), timeout);
    });
    
    // 执行脚本
    try {
      const { stdout, stderr } = await Promise.race([
        execPromise(`bash ${scriptFile}`),
        timeoutPromise
      ]) as { stdout: string, stderr: string };
      
      // 清理脚本文件
      try {
        if (fs.existsSync(scriptFile)) {
          fs.unlinkSync(scriptFile);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up script file:', cleanupError);
      }
      
      // 返回结果
      res.json({
        result: stdout || stderr,
        error: stderr ? stderr : null
      });
    } catch (execError) {
      // 清理脚本文件
      try {
        if (fs.existsSync(scriptFile)) {
          fs.unlinkSync(scriptFile);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up script file:', cleanupError);
      }
      
      console.error('Script execution error:', execError);
      res.status(500).json({
        result: `Error: ${execError instanceof Error ? execError.message : String(execError)}`,
        error: execError instanceof Error ? execError.message : String(execError)
      });
    }
  } catch (error) {
    console.error('Error executing script:', error);
    res.status(500).json({
      result: `Error: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;

