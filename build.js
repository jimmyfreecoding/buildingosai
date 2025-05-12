import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 颜色输出函数
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
};

// 日志函数
const log = {
  info: (message) => console.log(message),
  success: (message) => console.log(colors.green(message)),
  warn: (message) => console.log(colors.yellow(message)),
  error: (message) => console.log(colors.red(message)),
  section: (message) => {
    console.log(colors.yellow(message));
    console.log('----------------------------------------');
  },
};

// 执行命令并输出结果
function runCommand(command, cwd = process.cwd()) {
  try {
    log.info(`执行命令: ${command}`);
    const output = execSync(command, { cwd, stdio: 'pipe' }).toString();
    log.info(output);
    return output;
  } catch (error) {
    log.error(`命令执行失败: ${error.message}`);
    throw error;
  }
}

// 复制目录
function copyDir(src, dest) {
  // 确保目标目录存在
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // 读取源目录
  const entries = fs.readdirSync(src, { withFileTypes: true });

  // 复制每个文件/目录
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 清理目录
function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    log.info(`清理目录: ${dir}`);
    try {
      // 在Windows上尝试关闭可能使用这些文件的进程
      if (process.platform === 'win32') {
        try {
          // 终止可能锁定文件的进程
          execSync('taskkill /F /IM electron.exe', { stdio: 'ignore' });
          execSync('taskkill /F /IM BuildingOS.exe', { stdio: 'ignore' });
          // 注意：不要终止 VSCode 进程，因为它会关闭当前的编辑器
          // 但可以尝试终止 VSCode 的文件监视进程
          execSync('taskkill /F /IM Code.exe /FI "WINDOWTITLE ne *Visual Studio Code*"', { stdio: 'ignore' });
        } catch (e) {
          // 忽略错误，可能进程不存在
        }
      }
      
      // 等待一会儿，让进程完全关闭
      log.info('等待进程关闭...');
      // 使用同步延迟而不是 setTimeout
      const waitUntil = Date.now() + 2000;
      while (Date.now() < waitUntil) {
        // 空循环等待
      }
      
      // 删除目录
      fs.rmSync(dir, { recursive: true, force: true });
      log.success(`目录已清理: ${dir}`);
    } catch (error) {
      log.warn(`清理目录失败: ${error.message}`);
      log.warn('将尝试继续构建...');
    }
  }
}

// 主构建函数
function build() {
  try {
    log.success('BuildingOS 构建脚本');
    log.info('========================================');
    
    // 0. 清理之前的构建
    log.section('0. 清理之前的构建...');
    const buildReleasePath = path.join(process.cwd(), 'build', 'release');
    cleanDir(buildReleasePath);
    
    // 1. 构建客户端
    log.section('1. 构建客户端...');
    runCommand('npm run build');
    log.success('客户端构建成功');
    
    // 2. 构建服务端
    log.section('2. 构建服务端...');
    runCommand('npm run build', path.join(process.cwd(), 'server'));
    log.success('服务端构建成功');
    
    // 3. 复制客户端构建结果到服务端
    log.section('3. 复制客户端构建结果到服务端...');
    const clientDistPath = path.join(process.cwd(), 'dist');
    const serverWebPath = path.join(process.cwd(), 'server', 'dist', 'web');
    
    copyDir(clientDistPath, serverWebPath);
    log.success('客户端构建结果已复制到 server/dist/web');
    
    // 4. 准备Electron应用
    log.section('4. 准备Electron应用...');
    const buildPath = path.join(process.cwd(), 'build');
    const serverDistPath = path.join(process.cwd(), 'server', 'dist');
    const electronDistPath = path.join(buildPath, 'dist');
    
    // 清理并重新创建 build/dist 目录
    cleanDir(electronDistPath);
    if (!fs.existsSync(electronDistPath)) {
      fs.mkdirSync(electronDistPath, { recursive: true });
    }
    
    // 复制服务端dist到Electron应用
    copyDir(serverDistPath, electronDistPath);
    log.success('服务端构建结果已复制到 build/dist');
    
    // 5. 安装Electron依赖
    log.section('5. 安装Electron依赖...');
    runCommand('npm install', buildPath);
    log.success('Electron依赖安装成功');
    
    // 6. 构建Electron应用
    log.section('6. 构建Electron应用...');
    // 在Windows上，使用额外的清理步骤
    if (process.platform === 'win32') {
      log.info('在Windows上执行额外的清理步骤...');
      try {
        execSync('taskkill /F /IM electron.exe', { stdio: 'ignore' });
        execSync('taskkill /F /IM BuildingOS.exe', { stdio: 'ignore' });
        
        // 清理 electron-builder 缓存
        log.info('清理 electron-builder 缓存...');
        execSync('powershell -Command "Remove-Item -Path \\"$env:USERPROFILE\\AppData\\Local\\electron-builder\\Cache\\" -Recurse -Force -ErrorAction SilentlyContinue"', { stdio: 'ignore' });
        log.success('electron-builder 缓存已清理');
      } catch (e) {
        // 忽略错误，可能进程不存在或缓存目录不存在
        log.warn(`清理过程中出现非致命错误: ${e.message}`);
      }
    }

    // 等待一会儿，确保所有进程都已关闭
    log.info('等待进程关闭...');
    // 使用同步延迟而不是 setTimeout
    const waitUntil = Date.now() + 2000;
    while (Date.now() < waitUntil) {
      // 空循环等待
    }

    try {
      runCommand('npm run build', buildPath);
      log.success('Electron应用构建成功');
      
      // 完成
      log.info('========================================');
      log.success('构建完成!');
      log.info('Windows可执行文件位于: build/release');
    } catch (error) {
      log.error(`构建Electron应用失败: ${error.message}`);
      log.info('尝试手动构建:');
      log.info('1. 关闭所有Electron相关进程');
      log.info('2. 删除 build/release 目录');
      log.info('3. 进入 build 目录并运行 npm run build');
      process.exit(1);
    }
    
  } catch (error) {
    log.error(`构建失败: ${error.message}`);
    process.exit(1);
  }
}

// 执行构建
build();






