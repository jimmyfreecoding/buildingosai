const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// 保持对窗口对象的全局引用，避免JavaScript对象被垃圾回收时窗口关闭
let mainWindow;
let serverProcess;
let serverReady = false;
let serverPort = 3003; // 默认端口

// 获取正确的 Node.js 可执行文件路径
function getNodePath() {
  // 在开发环境中
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    return 'node';
  }
  
  // 在打包环境中，尝试多个可能的路径
  if (process.platform === 'win32') {
    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(process.resourcesPath, 'node.exe'),
      path.join(app.getAppPath(), 'node.exe'),
      path.join(__dirname, 'node.exe'),
      path.join(process.resourcesPath, '..', 'node.exe')
    ];
    
    for (const nodePath of possiblePaths) {
      console.log(`Checking for Node.js at: ${nodePath}`);
      if (fs.existsSync(nodePath)) {
        console.log(`Found Node.js at: ${nodePath}`);
        return nodePath;
      }
    }
    
    // 如果找不到 node.exe，记录错误并尝试使用系统 PATH 中的 node
    console.error('Node.js executable not found in expected locations');
    console.log('Attempting to use system Node.js...');
    return 'node';
  } else if (process.platform === 'darwin') {
    const macNodePath = path.join(process.resourcesPath, 'node');
    if (fs.existsSync(macNodePath)) {
      return macNodePath;
    }
    console.log('Node.js not found in resources, using system Node.js');
    return 'node';
  } else {
    const linuxNodePath = path.join(process.resourcesPath, 'node');
    if (fs.existsSync(linuxNodePath)) {
      return linuxNodePath;
    }
    console.log('Node.js not found in resources, using system Node.js');
    return 'node';
  }
}

// 创建窗口函数
function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false, // 先不显示窗口，等服务器准备好后再显示
    icon: path.join(__dirname, 'icons/icon.png')
  });

  // 显示加载中的界面
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));
  mainWindow.show();

  // 启动服务器
  startServer();

  // 当窗口关闭时触发
  mainWindow.on('closed', function () {
    mainWindow = null;
    // 关闭服务器进程
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });
}

// 启动服务器
function startServer() {
  console.log('Starting server...');
  
  // 检查dist/index.js是否存在
  const serverPath = path.join(__dirname, 'dist', 'index.js');
  if (!fs.existsSync(serverPath)) {
    dialog.showErrorBox(
      'Server Error',
      `Server file not found: ${serverPath}\nPlease make sure the server is properly built.`
    );
    app.quit();
    return;
  }

  try {
    // 获取 Node.js 路径
    const nodePath = getNodePath();
    console.log(`Using Node.js at: ${nodePath}`);
    
    // 启动Node.js服务器，确保传递PATH环境变量
    serverProcess = spawn(nodePath, [serverPath], {
      cwd: __dirname,
      env: { 
        ...process.env,  // 包含所有父进程的环境变量，包括PATH
        ELECTRON_RUN: 'true' 
      }
    });

    // 监听服务器输出
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Server output:', output);
      
      // 检查服务器是否已准备好
      if (output.includes('Server running on port')) {
        // 尝试从输出中提取端口号
        const portMatch = output.match(/Server running on port (\d+)/);
        if (portMatch && portMatch[1]) {
          serverPort = parseInt(portMatch[1], 10);
        }
        
        serverReady = true;
        console.log(`Server is ready on port ${serverPort}`);
        
        // 加载应用
        setTimeout(() => {
          if (mainWindow) {
            mainWindow.loadURL(`http://localhost:${serverPort}`);
          }
        }, 1000); // 给服务器一点额外时间来完全初始化
      }
    });

    // 监听服务器错误
    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    // 监听服务器退出
    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      if (code !== 0 && mainWindow) {
        dialog.showErrorBox(
          'Server Error',
          `Server process exited with code ${code}. Please check the logs for more information.`
        );
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    dialog.showErrorBox(
      'Server Error',
      `Failed to start server: ${error.message}`
    );
    app.quit();
  }

  // 设置超时，如果服务器在指定时间内没有准备好，则显示错误
  setTimeout(() => {
    if (!serverReady && mainWindow) {
      dialog.showErrorBox(
        'Server Timeout',
        'Server did not start within the expected time. Please check the logs for more information.'
      );
    }
  }, 30000); // 30秒超时
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(createWindow);

// 当所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  // 在macOS上，除非用户使用Cmd + Q明确退出，否则应用及其菜单栏通常会保持活动状态
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  // 在macOS上，当点击dock图标并且没有其他窗口打开时，通常会在应用程序中重新创建一个窗口
  if (mainWindow === null) createWindow();
});

// 应用退出前清理
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});


