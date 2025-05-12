# BuildingOS AI Server

TypeScript版本的BuildingOS AI服务器，提供聊天AI和SSH终端功能。

## 功能

- AI聊天接口，基于OpenAI和Mastra
- SSH终端服务
- 命令执行工具
- WebSocket实时通信

## 安装

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 启动服务器
npm start

# 开发模式启动
npm run dev
```

## 环境变量

创建`.env`文件并设置以下变量：

```
PORT=3003
OPENAI_API_KEY=your_openai_api_key_here
SSH_HOST=your_ssh_host
SSH_PORT=22
SSH_USERNAME=your_username
SSH_PASSWORD=your_password
```

## API文档

### 聊天API

- POST `/api/chat` - 发送消息并获取AI回复
- GET `/api/history/:sessionId` - 获取聊天历史
- DELETE `/api/history/:sessionId` - 清除聊天历史

### WebSocket

连接到`ws://localhost:3003`获取SSH终端功能。

## 许可证

MIT