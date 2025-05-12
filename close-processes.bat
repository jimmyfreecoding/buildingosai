@echo off
echo 正在关闭所有 Electron 相关进程...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM BuildingOS.exe >nul 2>&1
echo 进程已关闭