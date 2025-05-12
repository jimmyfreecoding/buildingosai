<template>
  <div id="app">
  <el-menu
    :default-active="activeIndex"
    class="el-menu-demo"
    mode="horizontal"
    :ellipsis="false"
    @select="handleSelect"
  >
    <el-menu-item index="0">
      <img
        style="width: 30px"
        src="/public/images/buildingoslogo.png"
        alt="Element logo"
      />
      <span style="padding-left: 10px;">BuildingOS.ai</span>
    </el-menu-item>
    <el-menu-item index="1">Processing Center</el-menu-item>
    <el-sub-menu index="2">
      <template #title>Workspace</template>
      <el-menu-item index="2-1">item one</el-menu-item>
      <el-menu-item index="2-2">item two</el-menu-item>
      <el-menu-item index="2-3">item three</el-menu-item>
      <el-sub-menu index="2-4">
        <template #title>item four</template>
        <el-menu-item index="2-4-1">item one</el-menu-item>
        <el-menu-item index="2-4-2">item two</el-menu-item>
        <el-menu-item index="2-4-3">item three</el-menu-item>
      </el-sub-menu>
    </el-sub-menu>
  </el-menu>
  <splitpanes class="default-theme" :push-other-panes="false">
    <pane :size="20">
      <el-tabs
        v-model="activeName"
        type="border-card"
        style="
          height: 100%;
          padding: 0px;
          margin-bottom: 0px;
          position: relative;
        "
      >
        <el-tab-pane
          label="AI"
          name="first"
          style="height: 100%; margin-bottom: 0px; position: relative"
        >
          <Chat />
        </el-tab-pane>
        <el-tab-pane
          label="Config"
          name="second"
          style="overflow: auto; height: 100%; padding: 0px"
        >
          Config
        </el-tab-pane>
      </el-tabs>
    </pane>
    <pane :size="65">
      <splitpanes
        class="default-theme"
        horizontal
        :push-other-panes="false"
        @resize="resizeT"
      >
        <pane :size="23">
          <el-tabs
            v-model="activeName"
            type="border-card"
            style="
              height: 100%;
              padding: 0px;
              margin-bottom: 0px;
              position: relative;
            "
          >
            <el-tab-pane
              label="System"
              name="first"
              style="height: 100%; position: relative; position: relative"
            >
              <Dashbord />
            </el-tab-pane>
            <el-tab-pane
              label="Config"
              name="second"
              style="overflow: auto; height: 100%; padding: 0px"
            >
              Config
            </el-tab-pane>
            <el-tab-pane
              label="Data"
              name="third"
              style="overflow: auto; height: 100%; padding: 0px"
            >
              Role
            </el-tab-pane>
            <el-tab-pane
              label="Task"
              name="fourth"
              style="overflow: auto; height: 100%; padding: 0px"
            >
              Task
            </el-tab-pane>
          </el-tabs>
        </pane>
        <pane :size="77">
          <el-tabs
            v-model="activeName"
            type="border-card"
            style="
              height: 100%;
              padding: 0px;
              margin-bottom: 0px;
              position: relative;
            "
          >
            <el-tab-pane
              label="Terminal"
              name="first"
              style="height: 100%; position: relative; position: relative"
            >
              <TerminalX ref="terminalRef" />
            </el-tab-pane>
            <el-tab-pane
              label="Log"
              name="second"
              style="overflow: auto; height: 100%; padding: 0px"
            >
              Config
            </el-tab-pane>
          </el-tabs>
        </pane>
      </splitpanes>
    </pane>
        <pane :size="15">
      <el-tabs
        v-model="activeName"
        type="border-card"
        style="
          height: 100%;
          padding: 0px;
          margin-bottom: 0px;
          position: relative;
        "
      >
        <el-tab-pane
          label="AI"
          name="first"
          style="height: 100%; margin-bottom: 0px; position: relative"
        >
          <!-- <Chat /> -->
           Chat
        </el-tab-pane>
        <el-tab-pane
          label="Config"
          name="second"
          style="overflow: auto; height: 100%; padding: 0px"
        >
          Config
        </el-tab-pane>
      </el-tabs>
    </pane>
  </splitpanes>
  </div>
</template>

<script setup>
import { ref, provide, onMounted, onUnmounted } from 'vue';
import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";
import TerminalX from "./TerminalX.vue";
import Chat from "./chat.vue";
import Dashbord from "./dashboard.vue";

const activeName = ref("first");
const activeIndex = ref('1');
const isConnected = ref(false);
const reconnectAttempts = ref(0);
const maxReconnectAttempts = 5;
const socketRef = ref(null);
const terminalRef = ref(null);
const handleSelect = (key, keyPath) => {
  console.log(key, keyPath)
};

// const socket = ref(null);
let socket = null;
// 提供给子组件的方法和状态
provide('socket', socketRef);

// 连接WebSocket
const connectWebSocket = () => {
  // 初始化 WebSocket 连接
  const ws = new WebSocket("ws://127.0.0.1:3003");
  socketRef.value = ws;
  ws.onopen = () => {
    isConnected.value = true;
    reconnectAttempts.value = 0;
  };

  // 监听 WebSocket 消息
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "output") {
        console.log('Received output:', data.data);
        // 只发送实际的数据部分，而不是整个 JSON
        if (terminalRef.value && terminalRef.value.sendCommand) {
          terminalRef.value.sendCommand(data.data);
        }
        
        // 如果正在执行命令，收集输出
        if (terminalRef.value && terminalRef.value.isExecutingCommand) {
          terminalRef.value.commandOutput += data.data;
        }
      } else if (data.type === "error") {
        if (terminalRef.value && terminalRef.value.sendCommand) {
          terminalRef.value.sendCommand(`\r\n\x1B[31m错误: ${data.error}\x1B[0m\r\n`);
        }
      } else if (data.type === "terminal-command") {
        // 从聊天界面收到的命令
        console.log('Home executeCommand', data.command);
        if (terminalRef.value && terminalRef.value.executeCommand) {
          // 默认自动执行，除非明确指定不自动执行
          const autoExecute = data.autoExecute !== false;
          terminalRef.value.executeCommand(data.command, autoExecute);
        }
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
      // 如果不是JSON格式，直接显示
      if (terminalRef.value && terminalRef.value.sendCommand) {
        terminalRef.value.sendCommand(event.data);
      }
    }
  };

  // 处理连接关闭
  ws.onclose = () => {
    isConnected.value = false;
    // handleExecuteCommand("\r\n\x1B[33mConnection closed. Attempting to reconnect...\x1B[0m\r\n");
    // term.write("\r\n\x1B[33mConnection closed. Attempting to reconnect...\x1B[0m\r\n");
    // 尝试重新连接
    if (reconnectAttempts.value < maxReconnectAttempts) {
      reconnectAttempts.value++;
      setTimeout(connectWebSocket, 3000); // 3秒后重试
    } else {
      // term.write("\r\n\x1B[31mFailed to reconnect after multiple attempts. Please refresh the page.\x1B[0m\r\n");
      // handleExecuteCommand("\r\n\x1B[31mFailed to reconnect after multiple attempts. Please refresh the page.\x1B[0m\r\n");
    }
  };

  // 处理连接错误
  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    // term.write(`\r\n\x1B[31mWebSocket error. Check console for details.\x1B[0m\r\n`);
    // handleExecuteCommand(`\r\n\x1B[31mWebSocket error. Check console for details.\x1B[0m\r\n`);
  };
  // 在 setup 函数中添加输入缓冲区
  // const inputBuffer = ref('');
  // const cursorPosition = ref(0);
        // 监听终端输入
  // term.onData((data) => {
  //   if (!isConnected.value) return;
    
  //   // 检查是否是回车键
  //   if (data === '\r') {
  //     // 发送完整命令到后台
  //     if (inputBuffer.value.trim()) {
  //       console.log('Sending command:', inputBuffer.value);
  //       socket.send(inputBuffer.value + '\r');
  //     } else {
  //       // 空命令，只发送回车
  //       socket.send('\r');
  //     }
      
  //     // 清空缓冲区
  //     inputBuffer.value = '';
  //     cursorPosition.value = 0;
  //     return;
  //   }
    
  //   // 处理退格键
  //   if (data === '\x7f') {
  //     if (cursorPosition.value > 0) {
  //       // 从缓冲区删除字符
  //       const before = inputBuffer.value.substring(0, cursorPosition.value - 1);
  //       const after = inputBuffer.value.substring(cursorPosition.value);
  //       inputBuffer.value = before + after;
  //       cursorPosition.value--;
        
  //       // 在终端中显示退格效果
  //       term.write('\b \b');
  //     }
  //     return;
  //   }
    
  //   // 处理方向键和其他控制字符
  //   if (data.length > 1 && data.startsWith('\x1b')) {
  //     // 这是一个转义序列，可能是方向键等
  //     if (data === '\x1b[A') { // 上箭头
  //       // 可以实现命令历史功能
  //     } else if (data === '\x1b[B') { // 下箭头
  //       // 可以实现命令历史功能
  //     } else if (data === '\x1b[C') { // 右箭头
  //       if (cursorPosition.value < inputBuffer.value.length) {
  //         cursorPosition.value++;
  //         term.write(data); // 移动光标
  //       }
  //       return;
  //     } else if (data === '\x1b[D') { // 左箭头
  //       if (cursorPosition.value > 0) {
  //         cursorPosition.value--;
  //         term.write(data); // 移动光标
  //       }
  //       return;
  //     }
      
  //     // 其他控制序列直接发送到终端显示
  //     term.write(data);
  //     return;
  //   }
    
  //   // 处理 Ctrl+C
  //   if (data === '\x03') {
  //     // 发送中断信号
  //     socket.send('\x03');
  //     inputBuffer.value = '';
  //     cursorPosition.value = 0;
  //     return;
  //   }
    
  //   // 处理 Tab 键
  //   if (data === '\t') {
  //     // 可以实现自动补全功能
  //     // 暂时只显示 Tab 字符
  //     term.write(data);
  //     return;
  //   }
    
  //   // 处理普通可打印字符
  //   if (data.length === 1 && data.charCodeAt(0) >= 32) {
  //     // 在光标位置插入字符
  //     const before = inputBuffer.value.substring(0, cursorPosition.value);
  //     const after = inputBuffer.value.substring(cursorPosition.value);
  //     inputBuffer.value = before + data + after;
  //     cursorPosition.value++;
      
  //     // 在终端中显示字符
  //     term.write(data);
  //   }
  // });


};
// 创建一个方法用于发送 socket 消息
const sendSocketMessage = (message) => {
  console.log('Home: Sending socket message:', message);
  
  if (socketRef.value && socketRef.value.readyState === WebSocket.OPEN) {
    try {
      socketRef.value.send(message);
      return true;
    } catch (error) {
      console.error('Error sending socket message:', error);
      return false;
    }
  } else {
    console.error('Socket not connected');
    return false;
  }
};
// 提供发送 socket 消息的方法给子组件
provide('sendSocketMessage', sendSocketMessage);
onMounted(() => {
  connectWebSocket();
});
onUnmounted(() => {
  console.log('App: Component unmounted');
 // 关闭WebSocket连接
  if (socketRef.value) {
    console.log('Closing WebSocket connection');
    socketRef.value.close();
    socketRef.value = null;
  }
});
</script>
<style scoped lang="scss">
//必须设置这样，否则滚动的话，会连tabs的标题栏一起滚动
:deep(.el-tabs__content) {
  position: relative;
  height: 100%;
  padding: 0px;
}
.el-menu--horizontal > .el-menu-item:nth-child(1) {
      left: -21px;
    bottom: 4px;
  margin-right: auto;
}
.el-menu-demo{
  height: 25px;
}


</style>
<style>
.default-theme {
  /* height: 100vh; */
  height: calc(-45px + 100vh);
  margin-bottom: 0px;
}
.splitpanes.default-theme .splitpanes__splitter {
  background-color: #000000;
}

.default-theme.splitpanes--vertical > .splitpanes__splitter,
.default-theme .splitpanes--vertical > .splitpanes__splitter {
  width: 7px;
  border-left: 1px solid #000000;
  margin-left: -1px;
}
.default-theme.splitpanes--horizontal > .splitpanes__splitter,
.default-theme .splitpanes--horizontal > .splitpanes__splitter {
  height: 7px;
  border-top: 1px solid #444444;
  margin-top: -1px;
}
.splitpanes.default-theme .splitpanes__splitter:before,
.splitpanes.default-theme .splitpanes__splitter:after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  background-color: hsl(0deg 0% 34.79%);
  transition: background-color 0.3s;
}






</style>
