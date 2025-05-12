import { Client } from 'ssh2';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// SSH 配置
const sshConfig = {
  host: process.env.SSH_HOST || '',
  port: parseInt(process.env.SSH_PORT || '22'),
  username: process.env.SSH_USERNAME || '',
  password: process.env.SSH_PASSWORD || '',
};

console.log('Testing SSH connection with config:', {
  host: sshConfig.host,
  port: sshConfig.port,
  username: sshConfig.username,
  password: sshConfig.password ? '******' : 'not set'
});

// 创建 SSH 客户端
const ssh = new Client();

// 连接到 SSH 服务器
ssh.on('ready', () => {
  console.log('SSH connection successful!');
  
  // 执行简单命令
  ssh.exec('echo "Hello from SSH"', (err, stream) => {
    if (err) {
      console.error('Failed to execute command:', err);
      ssh.end();
      return;
    }
    
    stream.on('data', (data: Buffer) => {
      console.log('Command output:', data.toString());
    });
    
    stream.on('close', () => {
      console.log('Command execution complete');
      ssh.end();
    });
  });
});

ssh.on('error', (err) => {
  console.error('SSH connection error:', err);
  process.exit(1);
});

// 连接到 SSH 服务器
ssh.connect(sshConfig);