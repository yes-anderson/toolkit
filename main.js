const { app, BrowserWindow } = require('electron');

function createWindow() {
  // Increase width/height so no content line-breaks prematurely
  const mainWindow = new BrowserWindow({
    width: 1200,   // for example, wider than the default 800
    height: 800,   // for example, taller than the default 600
    // You can also configure other BrowserWindow options here.
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

