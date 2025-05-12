<template>
  <div id="terminal"></div> 
</template>

<script>
import { onMounted, onUnmounted, ref, inject } from "vue";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
// import emitter from '@/utils/eventBus'; // 导入共享的事件总线，而不是从chat组件导入

export default {
  name: "App",
  setup() {
    // 注入从App.vue提供的状态和方法
    // const terminalCommands = inject('terminalCommands', ref([]));
    let term;
    let fitAddon;
    const isExecutingCommand = ref(false);
    const currentCommand = ref("");
    const isConnected = ref(false);
    const commandOutput = ref("");
    const reconnectAttempts = ref(0);
    const maxReconnectAttempts = 5;
    // 保存高度比例设置
    const heightRatio = ref(0.8); // 默认为30%高度
    // 监听终端命令变化
    // watch(terminalCommands, (newCommands, oldCommands) => {
    //   console.log('TerminalX: terminalCommands changed', 
    //     'old length:', oldCommands?.length, 
    //     'new length:', newCommands.length,
    //     'new commands:', JSON.stringify(newCommands)
    //   );
      
    //     const lastCommand = newCommands[newCommands.length - 1];
    //     console.log('TerminalX: Received new command from App:', lastCommand);
        
    //     // 执行命令
    //     if (lastCommand && lastCommand.command) {
    //       // 打印到控制台
    //       console.log(`TerminalX: Executing command: ${lastCommand.command}`);
          
    //       // 如果终端已连接，发送命令到终端
    //       if (term) {
    //         sendCommand(lastCommand.command);
    //       } else {
    //         console.warn('TerminalX: Terminal not connected, cannot execute command');
    //       }
    //     }
    // }, { deep: true, immediate: true });
    // provide('socket', socket);
    // 注入从父组件提供的socket
    const socket = inject('socket');    // 发送命令到后端
        // 注入从父组件提供的方法
    const sendSocketMessage = inject('sendSocketMessage');
    const sendCommand = (command) => {
      if (!command || command.trim() === "") return;
      console.log('revice command to terminal:', command);
      // 在终端显示命令
      if (term) {
        term.write(`${command}`);
      }
      // // 发送命令到WebSocket
      // try {
      //   // 尝试以JSON格式发送
      //   socket.send(JSON.stringify({
      //     type: 'input',
      //     command: command
      //   }));
      // } catch (e) {
      //   console.error('Error sending command as JSON:', e);
      //   // 如果JSON格式发送失败，直接发送命令文本
      //   socket.send(command);
      // }
    };
        // 执行特定命令并返回结果
    const executeCommand = (command, autoExecute = true) => {
      console.log('TerminalX: executeCommand', command, 'autoExecute:', autoExecute);
      
      return new Promise((resolve) => {
        isExecutingCommand.value = true;
        currentCommand.value = command;
        commandOutput.value = "";
        
        // 在终端显示命令
        term.write(command);
        
        // 如果需要自动执行，添加回车
        if (autoExecute) {
          term.write('\r\n');
          
          // 发送命令到后端，标记为自动执行命令
          sendSocketMessage(JSON.stringify({
            type: 'auto-command',
            command: command
          }));
        } else {
          // 不自动执行，只显示命令，等待用户手动回车
          // 更新输入缓冲区
          inputBuffer.value = command;
          cursorPosition.value = command.length;
        }
        
        // 设置超时
        const timeout = setTimeout(() => {
          isExecutingCommand.value = false;
          sendSocketMessage(JSON.stringify({ 
            type: "command-complete" 
          }));
          resolve(commandOutput.value || "Command execution timed out");
        }, 30000); // 30秒超时
        
        // 检测命令是否完成的定时器
        const checkInterval = setInterval(() => {
          // 简单的启发式方法：如果输出中包含提示符且最后一行不是命令本身，认为命令已完成
          const lines = commandOutput.value.split("\n");
          const lastLine = lines[lines.length - 1].trim();
          
          if (lastLine.endsWith("$") || lastLine.endsWith("#") || lastLine.endsWith(">")) {
            if (lastLine !== command) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              isExecutingCommand.value = false;
              console.log('Command completed:', commandOutput.value);
              sendSocketMessage(JSON.stringify({ 
                type: "command-complete" 
              }));
              resolve(commandOutput.value);
            }
          }
        }, 500);
      });
    };
    const monitorTerminal = () => {
  
    }
    // 初始化终端
    const initTerminal = () => {
      // 命令历史相关变量
      const commandHistory = ref([]);
      const historyIndex = ref(-1);
      const savedCommand = ref('');
      
      // 检测是否在编辑器模式
      const isInEditorMode = () => {
        const output = commandOutput.value.toLowerCase();
        return output.includes('nano') || 
               output.includes('vim') || 
               output.includes('vi ') || 
               output.includes('editor');
      };
      
      // 导航命令历史
      const navigateHistory = (direction) => {
        // 如果历史为空，不执行任何操作
        if (commandHistory.value.length === 0) return;
        
        // 第一次按上键时保存当前命令
        if (historyIndex.value === -1) {
          savedCommand.value = inputBuffer.value;
        }
        
        if (direction === 'up') {
          // 向上导航历史
          if (historyIndex.value < commandHistory.value.length - 1) {
            historyIndex.value++;
            
            // 清除当前行并显示历史命令
            clearCurrentLine();
            inputBuffer.value = commandHistory.value[commandHistory.value.length - 1 - historyIndex.value];
            cursorPosition.value = inputBuffer.value.length;
            term.write(inputBuffer.value);
          }
        } else if (direction === 'down') {
          // 向下导航历史
          if (historyIndex.value > 0) {
            historyIndex.value--;
            
            // 清除当前行并显示历史命令
            clearCurrentLine();
            inputBuffer.value = commandHistory.value[commandHistory.value.length - 1 - historyIndex.value];
            cursorPosition.value = inputBuffer.value.length;
            term.write(inputBuffer.value);
          } else if (historyIndex.value === 0) {
            // 回到保存的命令
            historyIndex.value = -1;
            clearCurrentLine();
            inputBuffer.value = savedCommand.value;
            cursorPosition.value = inputBuffer.value.length;
            term.write(inputBuffer.value);
          }
        }
      };
      
      // 清除当前行
      const clearCurrentLine = () => {
        // 计算需要退格的次数
        const backspaces = '\b'.repeat(inputBuffer.value.length);
        // 用空格覆盖
        const spaces = ' '.repeat(inputBuffer.value.length);
        // 再次退格
        const backspacesAgain = '\b'.repeat(inputBuffer.value.length);
        
        // 执行清除
        term.write(backspaces + spaces + backspacesAgain);
      };
      
      // 添加命令到历史
      const addToHistory = (command) => {
        // 忽略空命令和重复命令
        if (!command.trim() || 
            (commandHistory.value.length > 0 && 
             commandHistory.value[commandHistory.value.length - 1] === command)) {
          return;
        }
        
        // 添加到历史
        commandHistory.value.push(command);
        
        // 限制历史大小
        if (commandHistory.value.length > 100) {
          commandHistory.value.shift();
        }
        
        // 重置历史索引
        historyIndex.value = -1;
      };
      
      // 初始化 xterm.js
      term = new Terminal({
        cursorBlink: true,
        scrollOnUserInput: true,
        theme: {
          background: "#1d1e1f",
          foreground: "#f0f0f0",
          cursor: "#f0f0f0",
        },
        // 添加以下配置使光标保持在中部
        viewportMargin: 50,
        scrollSensitivity: 1
      });
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      // 挂载终端到 DOM
      term.open(document.getElementById("terminal"));
      
      // 使用setTimeout确保DOM完全渲染后再调整大小
      setTimeout(() => {
        // 先使用fitAddon自动调整以获取正确的列数
        fitAddon.fit();
        
        // 然后应用自定义高度
        applyCustomHeight();
      }, 1000);
      term.write("Initializing terminal...\r\n");
      // 在 setup 函数中添加输入缓冲区
      const inputBuffer = ref('');
      const cursorPosition = ref(0);
      // 监听终端输入
      term.onData((data) => {
        // if (!isConnected.value) return;
        
        // 检查是否是回车键
        if (data === '\r') {
          // 在终端显示回车
          term.write('\r\n');
          
          // 发送完整命令到后台
          if (inputBuffer.value.trim()) {
            console.log('Sending command:', inputBuffer.value);
            // 添加到命令历史
            addToHistory(inputBuffer.value);
            // 发送命令到后端，但不包含回车，因为我们已经在终端显示了回车
            sendSocketMessage(inputBuffer.value);
          } else {
            // 空命令，只发送回车
            sendSocketMessage('\r');
          }
          
          // 清空缓冲区
          inputBuffer.value = '';
          cursorPosition.value = 0;
          return;
        }
        
        // 处理退格键
        if (data === '\x7f') {
          if (cursorPosition.value > 0) {
            // 从缓冲区删除字符
            const before = inputBuffer.value.substring(0, cursorPosition.value - 1);
            const after = inputBuffer.value.substring(cursorPosition.value);
            inputBuffer.value = before + after;
            cursorPosition.value--;
            
            // 在终端中显示退格效果
            term.write('\b \b');
          }
          return;
        }
        
        // 处理 Tab 键
        if (data === '\t') {
          console.log('Tab key pressed, current input:', inputBuffer.value);
          // 实现自动补全功能
          if (inputBuffer.value.trim()) {
            // 发送 Tab 补全请求到后端
            const tabRequest = {
              type: 'tab-completion',
              text: inputBuffer.value,
              cursorPosition: cursorPosition.value
            };
            console.log('Sending tab completion request:', tabRequest);
            sendSocketMessage(JSON.stringify(tabRequest));
          } else {
            // 空输入时，只发送 Tab 字符
            sendSocketMessage('\t');
            term.write('\t');
          }
          return;
        }
        
        // 处理方向键和其他控制字符
        if (data.length > 1 && data.startsWith('\x1b')) {
          // 检测是否在编辑器模式
          const isInEditor = commandOutput.value.includes('nano') || 
                            commandOutput.value.includes('vim') || 
                            commandOutput.value.includes('vi ');
          
          // 上箭头
          if (data === '\x1b[A') {
            if (isInEditor) {
              // 在编辑器中，直接发送上箭头
              sendSocketMessage('\x1b[A');
              term.write(data);
            } else {
              // 命令历史 - 上一条
              navigateHistory('up');
            }
            return;
          } 
          // 下箭头
          else if (data === '\x1b[B') {
            if (isInEditor) {
              // 在编辑器中，直接发送下箭头
              sendSocketMessage('\x1b[B');
              term.write(data);
            } else {
              // 命令历史 - 下一条
              navigateHistory('down');
            }
            return;
          } 
          // 右箭头
          else if (data === '\x1b[C') {
            if (isInEditor) {
              // 在编辑器中，直接发送右箭头
              sendSocketMessage('\x1b[C');
              term.write(data);
            } else if (cursorPosition.value < inputBuffer.value.length) {
              // 移动光标向右
              cursorPosition.value++;
              term.write(data);
            }
            return;
          } 
          // 左箭头
          else if (data === '\x1b[D') {
            if (isInEditor) {
              // 在编辑器中，直接发送左箭头
              sendSocketMessage('\x1b[D');
              term.write(data);
            } else if (cursorPosition.value > 0) {
              // 移动光标向左
              cursorPosition.value--;
              term.write(data);
            }
            return;
          }
          
          // 其他控制序列直接发送到终端
          sendSocketMessage(data);
          term.write(data);
          return;
        }
        
        // 处理 Ctrl+C
        if (data === '\x03') {
          // 发送中断信号
          sendSocketMessage('\x03');
          inputBuffer.value = '';
          cursorPosition.value = 0;
          return;
        }
        
        // 处理普通可打印字符
        if (data.length === 1 && data.charCodeAt(0) >= 32) {
          // 在光标位置插入字符
          const before = inputBuffer.value.substring(0, cursorPosition.value);
          const after = inputBuffer.value.substring(cursorPosition.value);
          inputBuffer.value = before + data + after;
          cursorPosition.value++;
          
          // 在终端中显示字符
          term.write(data);
        }
      });
    // 执行特定命令并返回结果
    // const executeCommand = (command) => {
    //   // if (!isConnected.value) {
    //   //   return Promise.resolve("Terminal not connected");
    //   // }
      
    //   return new Promise((resolve) => {
    //     isExecutingCommand.value = true;
    //     currentCommand.value = command;
    //     commandOutput.value = "";
        
    //     // 发送命令到终端
    //     socket.send(command);
        
    //     // 设置超时
    //     const timeout = setTimeout(() => {
    //       isExecutingCommand.value = false;
    //       socket.send(JSON.stringify({ 
    //         type: "command-complete" 
    //       }));
    //       resolve(commandOutput.value || "Command execution timed out");
    //     }, 30000); // 30秒超时
        
    //     // 检测命令是否完成的定时器
    //     const checkInterval = setInterval(() => {
    //       // 简单的启发式方法：如果输出中包含提示符且最后一行不是命令本身，认为命令已完成
    //       const lines = commandOutput.value.split("\n");
    //       const lastLine = lines[lines.length - 1].trim();
          
    //       if (lastLine.endsWith("$") || lastLine.endsWith("#") || lastLine.endsWith(">")) {
    //         if (lastLine !== command) {
    //           clearInterval(checkInterval);
    //           clearTimeout(timeout);
    //           isExecutingCommand.value = false;
    //           socket.send(JSON.stringify({ 
    //             type: "command-complete" 
    //           }));
    //           resolve(commandOutput.value);
    //         }
    //       }
    //     }, 500);
    //   });
    // };
    };
    
    // 应用自定义高度的方法
    const applyCustomHeight = () => {
      const container = document.getElementById("terminal");
      if (!container || !term) return;
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // 计算调整后的高度
      const adjustedHeight = Math.floor(containerHeight * heightRatio.value);
      
      // 根据容器宽度计算列数（近似值）
      const fontSize = parseInt(window.getComputedStyle(container).fontSize);
      const charWidth = fontSize * 0.7; // 字符宽度近似值
      const cols = Math.floor(containerWidth / charWidth);
      
      // 计算行数
      const rows = Math.floor(adjustedHeight / fontSize);
      
      // 设置终端大小
      console.log(cols,rows)
      // term.resize(cols, rows);
    };

    // 连接WebSocket
    // const connectWebSocket = () => {
    //   // 初始化 WebSocket 连接
    //   socket = new WebSocket("ws://127.0.0.1:3003");

    //   socket.onopen = () => {
    //     isConnected.value = true;
    //     reconnectAttempts.value = 0;
    //     term.write("Terminal connected. Ready for commands.\r\n");
    //   };

    //   // 监听 WebSocket 消息
    //   socket.onmessage = (event) => {
    //     try {
    //       const data = JSON.parse(event.data);
          
    //       if (data.type === "output") {
    //         term.write(data.data);
            
    //         // 如果正在执行命令，收集输出
    //         if (isExecutingCommand.value) {
    //           commandOutput.value += data.data;
    //         }
    //       } else if (data.type === "error") {
    //         term.write(`\r\n\x1B[31m错误: ${data.error}\x1B[0m\r\n`);
    //       } else if (data.type === "terminal-command") {
    //         // 从聊天界面收到的命令
    //         executeCommand(data.command);
    //       }
    //     } catch (e) {
    //       // 如果不是JSON格式，直接显示
    //       term.write(event.data);
    //     }
    //   };

    //   // 处理连接关闭
    //   socket.onclose = () => {
    //     isConnected.value = false;
    //     term.write("\r\n\x1B[33mConnection closed. Attempting to reconnect...\x1B[0m\r\n");
        
    //     // 尝试重新连接
    //     if (reconnectAttempts.value < maxReconnectAttempts) {
    //       reconnectAttempts.value++;
    //       setTimeout(connectWebSocket, 3000); // 3秒后重试
    //     } else {
    //       term.write("\r\n\x1B[31mFailed to reconnect after multiple attempts. Please refresh the page.\x1B[0m\r\n");
    //     }
    //   };

    //   // 处理连接错误
    //   socket.onerror = (error) => {
    //     console.error("WebSocket error:", error);
    //     term.write(`\r\n\x1B[31mWebSocket error. Check console for details.\x1B[0m\r\n`);
    //   };
    //   // 在 setup 函数中添加输入缓冲区
    //   const inputBuffer = ref('');
    //   const cursorPosition = ref(0);
    //         // 监听终端输入
    //  term.onData((data) => {
    //     if (!isConnected.value) return;
        
    //     // 检查是否是回车键
    //     if (data === '\r') {
    //       // 发送完整命令到后台
    //       if (inputBuffer.value.trim()) {
    //         console.log('Sending command:', inputBuffer.value);
    //         socket.send(inputBuffer.value + '\r');
    //       } else {
    //         // 空命令，只发送回车
    //         socket.send('\r');
    //       }
          
    //       // 清空缓冲区
    //       inputBuffer.value = '';
    //       cursorPosition.value = 0;
    //       return;
    //     }
        
    //     // 处理退格键
    //     if (data === '\x7f') {
    //       if (cursorPosition.value > 0) {
    //         // 从缓冲区删除字符
    //         const before = inputBuffer.value.substring(0, cursorPosition.value - 1);
    //         const after = inputBuffer.value.substring(cursorPosition.value);
    //         inputBuffer.value = before + after;
    //         cursorPosition.value--;
            
    //         // 在终端中显示退格效果
    //         term.write('\b \b');
    //       }
    //       return;
    //     }
        
    //     // 处理方向键和其他控制字符
    //     if (data.length > 1 && data.startsWith('\x1b')) {
    //       // 这是一个转义序列，可能是方向键等
    //       if (data === '\x1b[A') { // 上箭头
    //         // 可以实现命令历史功能
    //       } else if (data === '\x1b[B') { // 下箭头
    //         // 可以实现命令历史功能
    //       } else if (data === '\x1b[C') { // 右箭头
    //         if (cursorPosition.value < inputBuffer.value.length) {
    //           cursorPosition.value++;
    //           term.write(data); // 移动光标
    //         }
    //         return;
    //       } else if (data === '\x1b[D') { // 左箭头
    //         if (cursorPosition.value > 0) {
    //           cursorPosition.value--;
    //           term.write(data); // 移动光标
    //         }
    //         return;
    //       }
          
    //       // 其他控制序列直接发送到终端显示
    //       term.write(data);
    //       return;
    //     }
        
    //     // 处理 Ctrl+C
    //     if (data === '\x03') {
    //       // 发送中断信号
    //       socket.send('\x03');
    //       inputBuffer.value = '';
    //       cursorPosition.value = 0;
    //       return;
    //     }
        
    //     // 处理 Tab 键
    //     if (data === '\t') {
    //       // 可以实现自动补全功能
    //       // 暂时只显示 Tab 字符
    //       term.write(data);
    //       return;
    //     }
        
    //     // 处理普通可打印字符
    //     if (data.length === 1 && data.charCodeAt(0) >= 32) {
    //       // 在光标位置插入字符
    //       const before = inputBuffer.value.substring(0, cursorPosition.value);
    //       const after = inputBuffer.value.substring(cursorPosition.value);
    //       inputBuffer.value = before + data + after;
    //       cursorPosition.value++;
          
    //       // 在终端中显示字符
    //       term.write(data);
    //     }
    //   });
    // };

    // 在 setup 函数中定义 resize 函数
    const resize = () => {
      if (fitAddon && term) {
        fitAddon.fit();
        // applyCustomHeight();
      }
    };

    onMounted(() => {
      initTerminal();
      // 监听 WebSocket 消息
      console.log('socket', socket);
      if (socket && socket.value) {
        socket.value.onmessage = (event) => {
          console.log('Received WebSocket message:', event.data);
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === "output") {
              // 检查输出是否是命令回显
              const output = data.data;
              // 如果输出以提示符结尾，不显示命令部分
              if (output.includes('\r\n')) {
                const lines = output.split('\r\n');
                // 过滤掉可能是命令回显的行
                const filteredLines = lines.filter(line => 
                  !line.trim().startsWith(inputBuffer.value.trim()) && 
                  line.trim() !== inputBuffer.value.trim()
                );
                // 只显示过滤后的输出
                term.write(filteredLines.join('\r\n'));
              } else {
                term.write(output);
              }
              
              // 如果正在执行命令，收集输出
              if (isExecutingCommand.value) {
                commandOutput.value += data.data;
              }
            } else if (data.type === "error") {
              term.write(`\r\n\x1B[31m错误: ${data.error}\x1B[0m\r\n`);
            } else if (data.type === "terminal-command") {
              // 从聊天界面收到的命令
              executeCommand(data.command);
            } else if (data.type === "tab-completion") {
              console.log('Received tab completion response:', data);
              // 处理 Tab 补全结果
              if (data.completions && data.completions.length > 0) {
                if (data.completions.length === 1) {
                  // 单个补全结果，直接应用
                  const completion = data.completions[0];
                  const before = inputBuffer.value.substring(0, data.startIndex);
                  const after = inputBuffer.value.substring(data.endIndex);
                  
                  // 清除当前行
                  clearCurrentLine();
                  
                  // 更新输入缓冲区
                  const newInput = before + completion + after;
                  inputBuffer.value = newInput;
                  cursorPosition.value = before.length + completion.length;
                  
                  // 显示新命令
                  term.write(newInput);
                  
                  // 如果是目录，自动添加斜杠
                  if (data.isPathCompletion && completion.endsWith('/')) {
                    // 自动触发下一次补全
                    const tabRequest = {
                      type: 'tab-completion',
                      text: newInput,
                      cursorPosition: cursorPosition.value
                    };
                    console.log('Auto-triggering next completion:', tabRequest);
                    sendSocketMessage(JSON.stringify(tabRequest));
                  }
                } else {
                  // 多个补全结果，显示所有可能的补全
                  term.write('\r\n');
                  
                  // 计算每行可以显示的补全数量
                  const termWidth = term.cols;
                  const maxCompletionLength = Math.max(...data.completions.map(c => c.length));
                  const completionsPerRow = Math.floor(termWidth / (maxCompletionLength + 2));
                  
                  // 显示补全结果
                  for (let i = 0; i < data.completions.length; i++) {
                    const completion = data.completions[i].padEnd(maxCompletionLength + 2);
                    term.write(completion);
                    
                    // 换行
                    if ((i + 1) % completionsPerRow === 0) {
                      term.write('\r\n');
                    }
                  }
                  
                  // 如果最后一行没有换行，添加换行
                  if (data.completions.length % completionsPerRow !== 0) {
                    term.write('\r\n');
                  }
                  
                  // 重新显示提示符和当前命令
                  term.write('$ ' + inputBuffer.value);
                }
              } else {
                // 没有补全结果，只显示 Tab 字符
                console.log('No completions available');
                term.write('\t');
              }
            }
          } catch (e) {
            // 如果不是JSON格式，直接显示
            console.error('Error parsing WebSocket message:', e);
            term.write(event.data);
          }
        };
      }
      
      // 监听窗口大小变化
      window.addEventListener("resize", resize);
    });

    onUnmounted(() => {
      // 移除事件监听
      // emitter.off('execute-terminal-command');
      window.removeEventListener("resize", resize);
      
      // // 关闭 WebSocket 连接
      // if (socket) {
      //   socket.close();
      // }
    });

    // 自定义调整大小方法，可以指定高度缩放比例
    const customResize = (newHeightRatio = 0.3) => {
      if (!term || !fitAddon) return;
      
      // 更新高度比例
      heightRatio.value = newHeightRatio;
      
      // 先使用fitAddon自动调整以获取正确的列数
      fitAddon.fit();
      
      // 然后应用自定义高度
      // applyCustomHeight();
    };

    return {
      term,
      resize,
      customResize, // 暴露自定义调整大小方法
      executeCommand, // 暴露执行命令方法供外部调用
      sendCommand,
      isConnected,
      isExecutingCommand,
      currentCommand,
      commandOutput
    };
  },
};
</script>

<style lang="scss" scoped>
#terminal {
  width: 100%;
  height: 100%;
  background-color: #1d1e1f;
  color: white;
  padding: 10px;
  box-sizing: border-box;
  text-align: left;
}
.xterm-viewport {
  background-color: #1d1e1f !important;
}
</style>
