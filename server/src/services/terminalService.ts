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
  private stream: ClientChannel | null = null; // 添加类级别的 stream 变量
  
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
        console.log('Received command from eventBus:', command);
        currentCommand = command;
        commandOutput = '';
        
        // 发送命令到终端
        try {
          // 如果WebSocket连接存在，发送命令
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'terminal-command', 
              command 
            } as WebSocketMessage));
            
            // 检查stream是否存在并可写入
            if (this.stream && this.stream.writable) {
              this.stream.write(command + '\n');
            } else {
              console.warn('SSH stream not available or not writable');
              // 如果stream不可用，返回错误信息
              setTimeout(() => {
                eventBus.emit(`command-result-${command}`, 'SSH connection not available. Please try again later.');
              }, 100);
            }
          } else {
            console.error('WebSocket not open, cannot send command');
            eventBus.emit(`command-result-${command}`, 'Error: WebSocket connection not open');
          }
        } catch (e) {
          console.error('Error sending command to terminal:', e);
          eventBus.emit(`command-result-${command}`, `Error: ${e instanceof Error ? e.message : String(e)}`);
        }
      });
      
      // 打开shell会话
      ssh.shell((err, shellStream) => {
        if (err) {
          console.error('Failed to open shell:', err);
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: `Failed to open shell: ${err.message}` 
          } as WebSocketMessage));
          return;
        }
        
        // 将shellStream赋值给类级别的stream变量
        this.stream = shellStream;
        console.log('SSH shell stream established and assigned to this.stream');
        
        // 将SSH输出发送到WebSocket客户端
        this.stream.on('data', (data: Buffer) => {
          const output = data.toString();
          
          // 发送输出到客户端，不包含命令回显
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
            console.log('Received message from WebSocket:', msgStr);
            
            // 尝试解析JSON
            try {
              const data = JSON.parse(msgStr) as WebSocketMessage;
              console.log('Parsed message type:', data.type);
              
              // 如果是命令执行完成的通知
              if (data.type === 'command-complete' && currentCommand) {
                // 发送命令执行结果到事件总线
                eventBus.emit(`command-result-${currentCommand}`, commandOutput);
                currentCommand = null;
                commandOutput = '';
              } 
              // 如果是 Tab 补全请求 - 暂时禁用
              else if (data.type === 'tab-completion' && data.text !== undefined) {
                console.log('Tab completion temporarily disabled');
                ws.send(JSON.stringify({
                  type: 'output',
                  data: '\t' // 只发送一个 Tab 字符
                } as WebSocketMessage));
              }
              // 如果是手动输入的命令
              if (data.type === 'manual-command' && data.command !== undefined) {
                console.log('Processing manual command:', data.command);
                
                // 发送命令到SSH
                if (this.stream && this.stream.writable) {
                  // 添加换行符
                  this.stream.write(data.command + '\n');
                } else {
                  console.error('Cannot execute command: SSH stream is null or not writable');
                  ws.send(JSON.stringify({
                    type: 'error',
                    error: 'Terminal session not initialized properly'
                  } as WebSocketMessage));
                }
              }
              // 如果是自动执行的命令
              else if (data.type === 'auto-command' && data.command) {
                // 自动执行的命令，直接发送到SSH
                if (this.stream && this.stream.writable) {
                  this.stream.write(data.command + '\n');
                } else {
                  console.error('Cannot execute command: SSH stream is null or not writable');
                  ws.send(JSON.stringify({
                    type: 'error',
                    error: 'Terminal session not initialized properly'
                  } as WebSocketMessage));
                }
              }
              // 兼容旧的命令格式
              else if (data.command) {
                // 普通终端输入
                if (this.stream && this.stream.writable) {
                  this.stream.write(data.command + '\n');
                } else {
                  console.error('Cannot execute command: SSH stream is null or not writable');
                  ws.send(JSON.stringify({
                    type: 'error',
                    error: 'Terminal session not initialized properly'
                  } as WebSocketMessage));
                }
              }
            } catch (e) {
              // 如果不是JSON格式，当作普通终端输入处理
              console.log('Processing non-JSON input:', msgStr);
              
              if (this.stream && this.stream.writable) {
                   this.stream.write(msgStr + '\n');
              } else {
                console.error('Cannot process input: SSH stream is null or not writable');
                ws.send(JSON.stringify({
                  type: 'error',
                  error: 'Terminal session not initialized properly'
                } as WebSocketMessage));
              }
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
        this.stream.on('close', () => {
          console.log('SSH stream closed');
          this.stream = null; // 清除stream引用
          ws.send(JSON.stringify({
            type: 'output',
            data: '\r\nSSH connection closed.\r\n'
          } as WebSocketMessage));
          ws.close();
        });
        
        // 处理SSH流错误
        this.stream.on('error', (err: Error) => {
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
      if (this.stream) {
        this.stream = null; // 清除stream引用
      }
      ssh.end();
    });

    // // 添加处理任务列表和任务详情的逻辑
    // ws.on('message', (message) => {
    //   try {
    //     const data = JSON.parse(message.toString());
        
    //     // 处理获取任务列表请求
    //     if (data.type === "get-task-list") {
    //       const tasksDir = path.join(__dirname, '../../tasks');
          
    //       // 确保任务目录存在
    //       if (!fs.existsSync(tasksDir)) {
    //         fs.mkdirSync(tasksDir, { recursive: true });
    //       }
          
    //       const files = fs.readdirSync(tasksDir);
          
    //       const tasks = files
    //         .filter(file => file.endsWith('.json'))
    //         .map(file => {
    //           const taskData = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf8'));
    //           return {
    //             id: taskData.id,
    //             name: taskData.name,
    //             description: taskData.description,
    //             version: taskData.version
    //           };
    //         });
          
    //       ws.send(JSON.stringify({
    //         type: "task-list",
    //         tasks: tasks
    //       }));
    //       console.log("已发送任务列表");
    //     }
        
    //     // 处理获取任务详情请求
    //     else if (data.type === "get-task-detail") {
    //       const taskId = data.taskId;
    //       const tasksDir = path.join(__dirname, '../../tasks');
          
    //       // 确保任务目录存在
    //       if (!fs.existsSync(tasksDir)) {
    //         fs.mkdirSync(tasksDir, { recursive: true });
    //         ws.send(JSON.stringify({
    //           type: "error",
    //           error: "Task not found"
    //         }));
    //         return;
    //       }
          
    //       const files = fs.readdirSync(tasksDir);
          
    //       const taskFile = files.find(file => {
    //         if (!file.endsWith('.json')) return false;
    //         const data = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf8'));
    //         return data.id === taskId;
    //       });
          
    //       if (!taskFile) {
    //         ws.send(JSON.stringify({
    //           type: "error",
    //           error: "Task not found"
    //         }));
    //         return;
    //       }
          
    //       const taskData = JSON.parse(fs.readFileSync(path.join(tasksDir, taskFile), 'utf8'));
    //       ws.send(JSON.stringify({
    //         type: "task-detail",
    //         task: taskData,
    //         requestId: data.requestId
    //       }));
    //       console.log("已发送任务详情:", taskId);
    //     }
    //   } catch (e) {
    //     console.error("处理WebSocket消息时出错:", e);
    //   }
    // });
  }

  // 处理 Tab 补全请求
  private handleTabCompletion(ws: WebSocket, text: string, cursorPosition: number): void {
    console.log(`Handling tab completion for: "${text}" at position ${cursorPosition}`);
    
    // 如果 SSH 流不可用，返回错误
    if (!this.stream) {
      console.error('Cannot handle tab completion: SSH stream is null');
      ws.send(JSON.stringify({
        type: 'error',
        error: 'SSH connection not available'
      } as WebSocketMessage));
      return;
    }
    
    // 获取当前单词
    const words = text.split(' ');
    const currentWord = words[words.length - 1] || '';
    console.log('Current word for completion:', currentWord);
    
    // 创建一个临时文件来存储补全结果
    const tempFile = `/tmp/tab_completion_${Date.now()}.txt`;
    
    // 构建补全命令
    // 使用 bash 的 compgen 命令获取补全结果
    const completionCommand = `compgen -c "${currentWord}" > ${tempFile} 2>/dev/null || echo "No completions" > ${tempFile}\n`;
    console.log('Sending completion command:', completionCommand);
    
    // 发送命令到 SSH
    this.stream.write(completionCommand);
    
    // 等待命令执行完成
    setTimeout(() => {
      // 读取补全结果
      const catCommand = `cat ${tempFile} && rm ${tempFile}\n`;
      
      // 创建一个临时缓冲区来收集补全结果
      let completionOutput = '';
      let dataHandler: (data: Buffer) => void;
      
      // 创建数据处理函数
      dataHandler = (data: Buffer) => {
        const output = data.toString();
        completionOutput += output;
        
        // 检查是否收集完成
        if (output.includes('\n$') || output.includes('\n#')) {
          // 移除监听器
          if (this.stream) {
            this.stream.removeListener('data', dataHandler);
          }
          
          // 处理补全结果
          const completions = completionOutput
            .split('\n')
            .filter(line => line.trim() !== '' && !line.includes('$') && !line.includes('#'))
            .map(line => line.trim());
          
          console.log('Completions found:', completions);
          
          // 发送补全结果到客户端
          ws.send(JSON.stringify({
            type: 'tab-completion',
            completions,
            startIndex: text.lastIndexOf(' ') + 1,
            endIndex: cursorPosition
          } as WebSocketMessage));
        }
      };
      
      // 添加临时数据处理器
      if (this.stream) {
        this.stream.on('data', dataHandler);
        
        // 发送读取命令
        this.stream.write(catCommand);
        
        // 设置超时，确保我们不会永远等待
        setTimeout(() => {
          if (this.stream) {
            this.stream.removeListener('data', dataHandler);
          }
          
          // 如果没有收到任何补全结果，发送空结果
          if (completionOutput === '') {
            ws.send(JSON.stringify({
              type: 'tab-completion',
              completions: [],
              startIndex: text.lastIndexOf(' ') + 1,
              endIndex: cursorPosition
            } as WebSocketMessage));
          }
        }, 2000);
      }
    }, 500);
  }
}

export default new TerminalService();






















