const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  
  if (electronPlatformName === 'win32') {
    console.log('Running afterPack hook for Windows');
    
    // 复制 node.exe 到资源目录
    const nodeExePath = process.execPath; // 当前运行的 Node.js 可执行文件路径
    const destNodeExePath = path.join(appOutDir, 'resources', 'node.exe');
    
    console.log(`Copying Node.js executable: ${nodeExePath} -> ${destNodeExePath}`);
    fs.copyFileSync(nodeExePath, destNodeExePath);
    console.log('Node.js executable copied successfully');
  }
};