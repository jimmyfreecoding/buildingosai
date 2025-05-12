<template>
  <div class="chat-container">
    <ConfigProvider :theme="darktheme">
      <div class="chat-messages" ref="messagesContainer">
        <!-- 调试信息 -->
        <div v-if="false" style="color: white; background-color: #333; padding: 10px; margin-bottom: 10px;">
          <p>Messages count: {{ messages.length }}</p>
          <div v-for="(msg, i) in messages" :key="i">
            <p>Message {{ i }}: {{ msg.role }} - Type: {{ msg.type }} - Command: {{ msg.command }}</p>
          </div>
        </div>

        <!-- 使用 Prompts 组件显示消息 -->
        <div v-for="(msg, index) in messages" :key="index" :class="['message-container', msg.role]">
          <!-- 助手消息 -->
          <div class="message-content">
            <Prompts
              v-if="msg.role === 'assistant'"
              :items="[{
                key: index.toString(),
                description: msg.content,
                icon: createIcon(SmileOutlined, '#1890FF'),
                disabled: false
              }]"
              class="message assistant"
            />
            
            <!-- 用户消息 -->
            <Prompts
              v-else-if="msg.role === 'user'"
              :items="[{
                key: index.toString(),
                description: msg.content,
                icon: createIcon(UserOutlined, '#FFD700'),
                disabled: false
              }]"
              class="message user"
            />
            
            <!-- 系统消息 -->
            <div v-else-if="msg.role === 'system'" class="message system">
              {{ msg.content }}
            </div>
            
            <!-- 命令框 -->
            <div v-if="msg.type === 'command-box'" class="command-box">
              <div class="command-header">
                <span>Terminal Command</span>
                <Button type="primary" size="small" @click="executeCommand(msg.command)">
                  Execute
                </Button>
              </div>
              <div class="command-content">
                <pre>{{ msg.command }}</pre>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 原来的消息显示方式（注释掉） -->
        <!-- 
        <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
          <div class="message-content" :class="{ 'error': msg.isError }">{{ msg.content }}</div>
        </div>
        -->
      </div>
      
      <Flex vertical>
        <Sender
          ref="senderRef"
          v-model:value="inputMessage"
          style="background-color: #1e1e1e; border: 1px solid #4e4e4e; color: white !important;"
          placeholder="Ask me anything..."
          @submit="handleSubmit"
          :loading="isLoading"
          class="white-text-input"
        />
      </Flex>
    </ConfigProvider>
  </div>
</template>

<script setup lang="ts">
import {
  BulbOutlined,
  CheckCircleOutlined,
  CoffeeOutlined,
  FireOutlined,
  InfoCircleOutlined,
  RocketOutlined,
  SmileOutlined,
  WarningOutlined,
  LinkOutlined,
  CloudUploadOutlined,
  MoreOutlined,
  UserOutlined, // 添加 UserOutlined 图标
} from "@ant-design/icons-vue";
import { Card, ConfigProvider, Flex, Button, Typography } from "ant-design-vue";
import { Welcome, Prompts, type PromptsProps } from "ant-design-x-vue";
import {
  ThoughtChain,
  type ThoughtChainItem,
  type ThoughtChainProps,
} from "ant-design-x-vue";

import { theme, Sender } from "ant-design-x-vue";

import { cloneVNode, h, isVNode } from "vue";
import axios from "axios";
// import mitt from 'mitt'; // 需要安装: npm install mitt
// import emitter from '@/utils/eventBus'; // 导入共享的事件总线

import { ref, onMounted, nextTick, watch } from 'vue';

const { Paragraph, Text } = Typography;
const daskbackground = {
  "background-color": "#1e1e1e",
  border: "1px solid #4e4e4e",
};
// 创建基础配置项
const baseItem: Omit<ThoughtChainItem, "status"> = {
  title: "Thought Chain Item Title",
  description: "description",
  icon: h(CheckCircleOutlined),
  extra: h(Button, { type: "text", icon: h(MoreOutlined) }),
  footer: h(Button, { block: true }, "Thought Chain Item Footer"),
  content: h(Typography, null, [
    h(Paragraph, null, [
      "In the process of internal desktop applications development, many different design specs and ",
      "implementations would be involved, which might cause designers and developers difficulties ",
      "and duplication and reduce the efficiency of development.",
    ]),
    h(Paragraph, null, [
      "After massive project practice and summaries, Ant Design, a design language for background ",
      "applications, is refined by Ant UED Team, which aims to ",
      h(Text, { strong: true }, [
        "uniform the user interface specs for internal background projects, lower the unnecessary ",
        "cost of design differences and implementation and liberate the resources of design and ",
        "front-end development",
      ]),
    ]),
  ]),
};

// 克隆并处理VNode
const processItem = (item: ThoughtChainItem) => {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [
      key,
      isVNode(value) ? cloneVNode(value) : value,
    ])
  ) as ThoughtChainItem;
};

// 生成最终项目列表
const processedItems: ThoughtChainProps["items"] = [
  { ...processItem(baseItem), status: "success" },
  { ...processItem(baseItem), status: "error" },
  { ...processItem(baseItem), status: "pending" },
];

const { token } = theme.useToken();
// const { message } = App.useApp();
const open = ref(false);
// 配置暗黑主题
const darktheme = ref({
  algorithm: theme.darkAlgorithm, // 使用暗色算法
  background:
    "linear-gradient(97deg, rgba(90,196,255,0.12) 0%, rgba(174,136,255,0.12) 100%)",
  token: {
    colorPrimary: "#region ", // 可自定义主色
  },
});

// 创建图标的辅助函数
const createIcon = (IconComponent, color) => {
  return h(IconComponent, { style: { color } });
};

// 配置项
const items: PromptsProps["items"] = [
  {
    key: "1",
    icon: createIcon(BulbOutlined, "#FFD700"),
    description: "Got any sparks for a new project?",
  },
  {
    key: "2",
    icon: createIcon(InfoCircleOutlined, "#1890FF"),
    description: "Help me understand the background of this topic.",
  },
  {
    key: "3",
    icon: createIcon(WarningOutlined, "#FF4D4F"),
    description: "How to solve common issues? Share some tips!",
  },
  {
    key: "4",
    icon: createIcon(RocketOutlined, "#722ED1"),
    description: "How can I work faster and better?",
  },
  {
    key: "5",
    icon: createIcon(CheckCircleOutlined, "#52C41A"),
    description: "What are some tricks for getting tasks done?",
  },
  {
    key: "6",
    icon: createIcon(CoffeeOutlined, "#964B00"),
    description: "How to rest effectively after long hours of work?",
  },
  {
    key: "7",
    icon: createIcon(SmileOutlined, "#FAAD14"),
    description: "What are the secrets to maintaining a positive mindset?",
  },
  {
    key: "8",
    icon: createIcon(FireOutlined, "#FF4D4F"),
    description: "How to stay calm under immense pressure?",
  },
];

// 聊天消息
const messages = ref([]);
const messagesContainer = ref(null);
const sessionId = ref(Date.now().toString());
const isLoading = ref(false);
// 添加 ref 引用
const senderRef = ref(null);
const inputMessage = ref('');

// 添加自动执行标记
const autoExecuteCommands = ref(true);

// 提交处理
const handleSubmit = async (message) => {
  if (!message.trim()) return;
  
  // 添加用户消息
  messages.value.push({ role: 'user', content: message });
  
  // 清空输入框
  inputMessage.value = '';
  
  // 滚动到底部
  await nextTick();
  scrollToBottom();
  
  // 设置加载状态
  isLoading.value = true;
  
  try {
    // 发送消息到服务器
    const response = await axios.post('http://localhost:3003/api/chat', {
      message,
      sessionId: sessionId.value
    });
    
    console.log('Received response:', response.data);
    
    // 添加AI回复
    messages.value.push({ 
      role: 'assistant', 
      content: response.data.message,
      isError: false,
      type: response.data.type || 'text',
      command: response.data.command || null
    });
    
    // 如果是命令类型，显示命令框
    if (response.data.type === 'command' && response.data.command) {
      console.log('Command detected:', response.data.command);
      
      // 添加命令框
      messages.value.push({
        role: 'system',
        content: `Command to execute: ${response.data.command}`,
        isCommand: true,
        type: 'command-box',
        command: response.data.command
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    
    // 添加错误消息
    messages.value.push({ 
      role: 'assistant', 
      content: 'Sorry, I encountered an error processing your request. Please try again.',
      isError: true,
      type: 'error'
    });
  } finally {
    // 关闭加载状态
    isLoading.value = false;
    
    // 滚动到底部
    await nextTick();
    scrollToBottom();
  }
};

// 滚动到底部
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// 监听消息变化，自动滚动到底部
watch(messages, async () => {
  await nextTick();
  scrollToBottom();
});

// 组件挂载时添加欢迎消息
onMounted(() => {
  messages.value.push({
    role: 'assistant',
    content: 'Hello! I\'m your AI Buildingos assistant. How can I help you today?'
  });
});

// 判断消息是否包含可执行命令
const isExecutableCommand = (content) => {
  // 检查消息是否包含命令标记，例如：```bash、```shell 或 $ 开头的行
  return content.includes('```bash') || 
         content.includes('```shell') || 
         content.includes('```sh') ||
         /\n\s*\$\s+[^\n]+/.test(content) ||
         /^top\s+/.test(content) ||  // 添加对top命令的识别
         /^ps\s+/.test(content);     // 添加对ps命令的识别
};

// 从消息中提取命令
const extractCommand = (content) => {
  // 尝试从代码块中提取命令
  const codeBlockMatch = content.match(/```(?:bash|shell|sh)\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  
  // 尝试提取 $ 开头的命令行
  const commandLineMatch = content.match(/\n\s*\$\s+([^\n]+)/);
  if (commandLineMatch) {
    return commandLineMatch[1].trim();
  }
  
  // 尝试提取直接的命令（如top、ps等）
  const directCommandMatch = content.match(/\b(top[\s-][^\n]+|ps[\s-][^\n]+)/);
  if (directCommandMatch) {
    return directCommandMatch[1].trim();
  }
  
  return '';
};

// 执行命令
const executeCommand = (command) => {
  if (!command) return;
  
  console.log('Executing command:', command, 'autoExecute:', autoExecuteCommands.value);
  
  // 使用事件总线发送命令到 TerminalX 组件
  emitter.emit('execute-terminal-command', {
    command,
    autoExecute: autoExecuteCommands.value
  });
  
  // 添加一条消息表示命令已执行
  messages.value.push({
    role: 'system',
    content: `Command ${autoExecuteCommands.value ? 'executed' : 'sent to terminal'}: ${command}`,
    isCommand: true,
    type: 'system'
  });
  
  // 滚动到底部
  nextTick(() => {
    scrollToBottom();
  });
};
</script>

<style scoped>
.chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.message {
  border-radius: 1rem;
  word-break: break-word;
}

.message.user {
  align-self: flex-end;
  color: white;
  border-bottom-right-radius: 0.25rem;
}

.message.assistant {
  align-self: flex-start;
  color: #e0e0e0;
  border-bottom-left-radius: 0.25rem;
}

.message-content {
  white-space: pre-wrap;
}

.message-content.error {
  color: #ff4d4f;
}

/* 命令框样式 */
.command-box {
  margin-top: 0.5rem;
  background-color: #2a2a2a;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid #444;
}

.command-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #333;
  border-bottom: 1px solid #444;
}

.command-content {
  padding: 0.5rem 1rem;
  max-height: 200px;
  overflow-y: auto;
}

.command-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  color: #1890ff;
}

.chat-input {
  padding: 1rem;
  border-top: 1px solid #333;
}

.command-options {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  background-color: #2d2d2d;
  border-top: 1px solid #444;
}

.auto-execute-label {
  display: flex;
  align-items: center;
  color: #ccc;
  font-size: 0.9rem;
  cursor: pointer;
}

.auto-execute-label input {
  margin-right: 0.5rem;
}
</style>
<style>
/* 自定义样式（如果需要） */
.ant-prompts .ant-prompts-item {
  background-color: #1e1e1e !important;
  border: 1px solid #4e4e4e !important;
}

/* 确保输入框文字为白色 - 增强选择器特异性 */
.ant-design-x-vue-sender-input,
.ant-design-x-vue-sender .ant-design-x-vue-sender-input,
input.ant-design-x-vue-sender-input,
textarea.ant-design-x-vue-sender-input {
  color: white !important;
}

/* 确保输入框的占位符文字也是白色（但透明度较低） */
.ant-design-x-vue-sender-input::placeholder {
  color: rgba(255, 255, 255, 0.6) !important;
}

/* 确保输入框聚焦时的文字也是白色 */
.ant-design-x-vue-sender-input:focus {
  color: white !important;
}

/* 添加一个新的类选择器 */
.white-text-input,
.white-text-input input,
.white-text-input textarea {
  color: white !important;
}

/* 确保输入框内的所有文本元素都是白色 */
.ant-design-x-vue-sender * {
  color: white !important;
}

/* 自定义 Prompts 组件样式 */
.message.assistant .ant-prompts {
  background-color: #2e2e2e;
  border-radius: 1rem;
  border-bottom-left-radius: 0.25rem;
  margin-bottom: 1rem;
  max-width: 80%;
  align-self: flex-start;
}

.message.user .ant-prompts {
  background-color: #1890ff;
  border-radius: 1rem;
  border-bottom-right-radius: 0.25rem;
  margin-bottom: 1rem;
  max-width: 80%;
  align-self: flex-end;
  margin-left: auto;
}

.message.assistant .ant-prompts-title,
.message.assistant .ant-prompts-item-description {
  color: #e0e0e0 !important;
}

.message.user .ant-prompts-title,
.message.user .ant-prompts-item-description {
  color: white !important;
}

/* 修改 Prompts 组件样式，确保内容换行 */
.message.user .ant-prompts-item-description,
.message.assistant .ant-prompts-item-description {
  white-space: pre-wrap !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  max-width: 100% !important;
}

/* 确保消息气泡有足够的宽度 */
.message.user .ant-prompts,
.message.assistant .ant-prompts {
  min-width: 50px;
  max-width: 80%;
}

/* 确保用户消息正确对齐到右侧 */
.message.user {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

/* 确保消息容器正确布局 */
.chat-messages > div {
  width: 100%;
  display: flex;
  flex-direction: column;
}
/* 添加消息容器样式 */
.message-container {
  width: 100%;
  display: flex;
  margin-bottom: 0.5rem;
}

.message-container.user {
  justify-content: flex-end;
}

.message-container.assistant {
  justify-content: flex-start;
}

/* 确保 Prompts 组件内部的内容也能正确换行 */
.ant-prompts-item-content {
  width: 100%;
  overflow-wrap: break-word;
}

/* 确保消息气泡内的文本正确显示 */
.ant-prompts-item-description {
  white-space: pre-wrap !important;
  word-break: break-word !important;
  max-width: 100% !important;
  width: 100% !important;
}

/* 强制所有可能的文本容器元素换行 */
.ant-prompts-item-description,
.ant-prompts-item-content,
.ant-prompts-item,
.ant-prompts-item-inner,
.ant-prompts-item-inner > div,
.ant-prompts-item-inner > div > div,
.ant-prompts-item-inner > div > div > div {
  white-space: pre-wrap !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  max-width: 100% !important;
  width: 100% !important;
  overflow: visible !important;
}

/* 确保消息气泡有合适的宽度和换行 */
.message.user .ant-prompts,
.message.assistant .ant-prompts {
  min-width: 50px;
  max-width: 80%;
  width: auto !important;
  overflow: visible !important;
}

/* 确保 Prompts 组件内部的文本容器有足够的宽度 */
.ant-prompts-item-content {
  width: 100% !important;
  max-width: 100% !important;
  overflow: visible !important;
}

/* 命令框样式 */
.command-box {
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  border: 1px solid #444;
  border-radius: 4px;
  overflow: hidden;
  background-color: #1e1e1e;
  width: 80%;
  align-self: flex-start;
}

.command-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: #333;
  border-bottom: 1px solid #444;
}

.command-content {
  padding: 0.5rem;
  overflow-x: auto;
}

.command-content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #d4d4d4;
}

/* 系统消息样式 */
.message-container.system {
  justify-content: center;
}

.message.system {
  background-color: #2c2c2c;
  color: #d4d4d4;
  font-style: italic;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  max-width: 80%;
  text-align: center;
}
</style>
