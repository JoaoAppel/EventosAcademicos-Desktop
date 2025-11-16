const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const fs = require('fs');

let Store;
let store;

async function initStore() {
  if (!Store) {
    Store = await import('electron-store').then(mod => mod.default);
  }
  if (!store) {
    // Pre-scan userData JSON files and move corrupt ones aside (parse to verify)
    try {
      const userData = app.getPath('userData');
      const dirFiles = fs.readdirSync(userData || '.');
      for (const f of dirFiles) {
        if (!f.toLowerCase().endsWith('.json')) continue;
        const full = path.join(userData, f);
        try {
          let raw = fs.readFileSync(full, 'utf8');
          // Remove BOM if present for testing
          if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
          JSON.parse(raw);
        } catch (e) {
          try { fs.renameSync(full, full + '.broken'); console.warn('initStore: moved invalid JSON file:', full); } catch(_){}
        }
      }
    } catch (e) {
      // ignore scanning errors
    }

    // Finally attempt to create the store
    try {
      store = new Store();
    } catch (err2) {
      console.error('initStore: unable to initialize store after cleanup:', err2 && err2.message);
      // give up but rethrow so caller sees error
      throw err2;
    }
  }
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.fixed.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// =====================
// IPC: Persistent settings
// =====================
ipcMain.handle('settings:get', async (event, key, fallback) => {
  await initStore();
  return store.get(key, fallback);
});

ipcMain.handle('settings:set', async (event, key, value) => {
  await initStore();
  store.set(key, value);
  return true;
});

// =====================
// IPC: Serial ports list/open
// =====================
ipcMain.handle('serial:list', async () => {
  const ports = await SerialPort.list();
  return ports;
});

let activePort = null;

ipcMain.handle('serial:open', async (event, pathName, baudRate=9600) => {
  if (activePort) {
    try { activePort.close(); } catch(e){}
    activePort = null;
  }
  return new Promise((resolve, reject) => {
    try {
      activePort = new SerialPort({ path: pathName, baudRate }, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
      activePort.on('data', (data) => {
        event.sender.send('serial:data', data.toString('utf8'));
      });
      activePort.on('error', (err) => {
        event.sender.send('serial:error', String(err));
      });
    } catch (e) {
      reject(e);
    }
  });
});

ipcMain.handle('serial:close', async () => {
  if (activePort) {
    await new Promise((res)=> activePort.close(()=>res()));
    activePort = null;
  }
  return true;
});

// =====================
// IPC: Save file (exports)
// =====================
ipcMain.handle('fs:save-dialog', async (event, defaultPath, bufferBase64) => {
  const { filePath } = await dialog.showSaveDialog({ defaultPath });
  if (!filePath) return null;
  const data = Buffer.from(bufferBase64, 'base64');
  fs.writeFileSync(filePath, data);
  return filePath;
});
