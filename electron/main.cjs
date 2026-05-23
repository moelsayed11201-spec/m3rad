// This creates an Electron entry point
const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath);

if (!isDev) {
  // In production (packaged), spin up the backend express server
  try {
    require('../dist/server.cjs');
  } catch (e) {
    console.error('Failed to start local server', e);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
    },
    title: 'معرض الخطاب - إدارة الأقساط والمخازن'
  });

  // We wait a second to ensure express has started listening on 3000
  setTimeout(() => {
    win.loadURL('http://localhost:3000');
  }, 1000);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
