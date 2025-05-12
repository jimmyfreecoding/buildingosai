import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import chatRouter from './api/chat';
import terminalService from './services/terminalService';
import './utils/eventBus'; // 初始化事件总线

// 加载环境变量 - 使用绝对路径
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 打印环境变量以验证加载
console.log('Environment variables loaded:');
console.log('PORT:', process.env.PORT);
console.log('SSH_HOST:', process.env.SSH_HOST);
console.log('SSH_PORT:', process.env.SSH_PORT);
console.log('SSH_USERNAME:', process.env.SSH_USERNAME);
console.log('SSH_PASSWORD:', process.env.SSH_PASSWORD ? '******' : 'not set');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '******' : 'not set');

// 设置 OpenAI API 密钥
if (process.env.OPENAI_API_KEY) {
  process.env.AI_SDK_OPENAI_API_KEY = process.env.OPENAI_API_KEY;
}

// 创建Express应用
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 提供web客户端文件
app.use(express.static(path.join(__dirname, 'web')));

// API路由
app.use('/api', chatRouter);

// 健康检查
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 所有未匹配的路由都返回index.html (SPA支持)
app.get('*', (req, res) => {
  // 排除API路由和WebSocket请求
  if (!req.path.startsWith('/api') && !req.path.startsWith('/socket')) {
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
  }
});

// WebSocket连接处理
wss.on('connection', (ws) => {
  terminalService.initWebSocket(ws);
});

// 在文件顶部添加以下代码，检测是否在Electron环境中运行
const isElectron = process.env.ELECTRON_RUN === 'true';

// 启动服务器
const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Web client available at http://localhost:${PORT}`);
  
  // 如果在Electron环境中运行，输出特定消息以便Electron主进程捕获
  if (isElectron) {
    console.log(`ELECTRON_SERVER_READY:${PORT}`);
  }
});

// 优雅关闭
const gracefulShutdown = () => {
  console.log('\nGracefully shutting down...');
  
  wss.clients.forEach((client) => {
    client.close();
  });
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // 强制关闭
  setTimeout(() => {
    console.error('Forcing shutdown');
    process.exit(1);
  }, 5000);
};

// 注册信号处理程序
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// 全局错误处理
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error(
    '[Unhandled Rejection]',
    reason instanceof Error ? reason.message : reason
  );
});



