import { Client, ClientChannel } from 'ssh2';
import WebSocket from 'ws';
import { WebSocketMessage } from '../types';
import eventBus from '../utils/eventBus';
import defaultConfig from '../config/default';
import * as fs from 'fs';
import * as path from 'path';

// SSH 配置
interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export class TerminalService {
  private sshConfig!: SSHConfig;
  
  constructor() {
    // 构造函数中不初始化配置，而是在每次连接时获取最新配置
  }
  
  // 获取最新的SSH配置
  private getSSHConfig(): SSHConfig {
    // 优先使用环境变量，如果不可用则使用默认配置
    return {
      host: process.env.SSH_HOST || defaultConfig.ssh.host,
      port: parseInt(process.env.SSH_PORT || defaultConfig.ssh.port.toString()),
      username: process.env.SSH_USERNAME || defaultConfig.ssh.username,
      password: process.env.SSH_PASSWORD || defaultConfig.ssh.password,
    };
  }
  
  // 初始化WebSocket连接
  public initWebSocket(ws: WebSocket): void {
    console.log('WebSocket client connected');
    
    // 获取最新的SSH配置
    this.sshConfig = this.getSSHConfig();
    
    // 打印 SSH 配置（不包含密码）
    console.log('SSH Config:', {
      host: this.sshConfig.host,
      port: this.sshConfig.port,
      username: this.sshConfig.username,
      password: this.sshConfig.password ? '******' : 'not set'
    });
    
    // 验证SSH配置
    if (!this.sshConfig.host) {
      console.error('SSH host is not set');
      ws.send(JSON.stringify({
        type: 'error',
        error: 'SSH host is not configured. Please check server configuration.'
      } as WebSocketMessage));
      return;
    }
    
    // 存储当前命令和结果
    let currentCommand: string | null = null;
    let commandOutput = '';
    
    // 创建SSH客户端
    const ssh = new Client();
    
    // 连接到SSH服务器
    ssh.on('ready', () => {
      console.log('SSH connection established');
      
      // 通知客户端 SSH 连接成功
      ws.send(JSON.stringify({
        type: 'output',
        data: 'SSH connection established successfully.\r\n'
      } as WebSocketMessage));
      
      // 监听来自聊天界面的命令执行请求
      eventBus.on('execute-command', (command: string) => {
        currentCommand = command;
        commandOutput = '';
        
        // 发送命令到终端
        ws.send(JSON.stringify({ 
          type: 'terminal-command', 
          command 
        } as WebSocketMessage));
      });
      
      // 打开shell会话
      ssh.shell((err, stream) => {
        if (err) {
          console.error('Failed to open shell:', err);
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: `Failed to open shell: ${err.message}` 
          } as WebSocketMessage));
          return;
        }
        
        // 将SSH输出发送到WebSocket客户端
        stream.on('data', (data: Buffer) => {
          const output = data.toString();
          ws.send(JSON.stringify({ 
            type: 'output', 
            data: output 
          } as WebSocketMessage));
          
          // 如果是来自命令执行的输出，则收集结果
          if (currentCommand) {
            commandOutput += output;
          }
        });
        
        // 将WebSocket客户端的输入转发到SSH
        ws.on('message', (message: WebSocket.RawData) => {
          try {
            // 尝试解析为JSON
            const msgStr = message.toString();
            let data: WebSocketMessage;
            
            try {
              data = JSON.parse(msgStr) as WebSocketMessage;
              
              // 如果是命令执行完成的通知
              if (data.type === 'command-complete' && currentCommand) {
                // 发送命令执行结果到事件总线
                eventBus.emit(`command-result-${currentCommand}`, commandOutput);
                currentCommand = null;
                commandOutput = '';
              } else if (data.command) {
                // 普通终端输入
                stream.write(data.command);
              }
            } catch (e) {
              // 如果不是JSON格式，当作普通终端输入处理
              stream.write(msgStr);
            }
          } catch (e) {
            console.error('Error processing message:', e);
            ws.send(JSON.stringify({
              type: 'error',
              error: `Error processing message: ${e instanceof Error ? e.message : String(e)}`
            } as WebSocketMessage));
          }
        });
        
        // 处理SSH流关闭
        stream.on('close', () => {
          console.log('SSH stream closed');
          ws.send(JSON.stringify({
            type: 'output',
            data: '\r\nSSH connection closed.\r\n'
          } as WebSocketMessage));
          ws.close();
        });
        
        // 处理SSH流错误
        stream.on('error', (err: Error) => {
          console.error('SSH stream error:', err);
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: `SSH stream error: ${err.message}` 
          } as WebSocketMessage));
        });
      });
    });
    
    // 处理SSH连接错误
    ssh.on('error', (err: Error) => {
      console.error('SSH connection error:', err);
      ws.send(JSON.stringify({ 
        type: 'error', 
        error: `SSH connection error: ${err.message}` 
      } as WebSocketMessage));
    });
    
    // 连接到SSH服务器
    try {
      console.log('Attempting to connect to SSH server...');
      ssh.connect(this.sshConfig);
    } catch (err) {
      console.error('Error connecting to SSH server:', err);
      ws.send(JSON.stringify({
        type: 'error',
        error: `Error connecting to SSH server: ${err instanceof Error ? err.message : String(err)}`
      } as WebSocketMessage));
    }
    
    // 处理WebSocket关闭
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      ssh.end();
    });

    // 添加处理任务列表和任务详情的逻辑
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // 处理获取任务列表请求
        if (data.type === "get-task-list") {
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
          
          ws.send(JSON.stringify({
            type: "task-list",
            tasks: tasks
          }));
          console.log("已发送任务列表");
        }
        
        // 处理获取任务详情请求
        else if (data.type === "get-task-detail") {
          const taskId = data.taskId;
          const tasksDir = path.join(__dirname, '../../tasks');
          
          // 确保任务目录存在
          if (!fs.existsSync(tasksDir)) {
            fs.mkdirSync(tasksDir, { recursive: true });
            ws.send(JSON.stringify({
              type: "error",
              error: "Task not found"
            }));
            return;
          }
          
          const files = fs.readdirSync(tasksDir);
          
          const taskFile = files.find(file => {
            if (!file.endsWith('.json')) return false;
            const data = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf8'));
            return data.id === taskId;
          });
          
          if (!taskFile) {
            ws.send(JSON.stringify({
              type: "error",
              error: "Task not found"
            }));
            return;
          }
          
          const taskData = JSON.parse(fs.readFileSync(path.join(tasksDir, taskFile), 'utf8'));
          ws.send(JSON.stringify({
            type: "task-detail",
            task: taskData,
            requestId: data.requestId
          }));
          console.log("已发送任务详情:", taskId);
        }
      } catch (e) {
        console.error("处理WebSocket消息时出错:", e);
      }
    });
  }
}

export default new TerminalService();



