import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';

const isDev = process.env.NODE_ENV === 'development';
const API_BASE = process.env.API_BASE || 'https://api.mypilot.life';

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  if (!isDev) setupAutoUpdate();
});

function setupAutoUpdate() {
  autoUpdater.on('update-downloaded', async (info) => {
    const res = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      title: 'Update ready',
      message: `Version ${info.version} downloaded. Restart to install.`,
    });
    if (res.response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err) => {
    console.error('[auto-update] error:', err?.message ?? err);
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[auto-update] initial check failed:', err?.message ?? err);
  });

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 60 * 60 * 1000);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC: proxy HTTP requests via Node fetch to bypass Chromium TLS/CORS quirks.
ipcMain.handle('api:request', async (_e, args: {
  method: string;
  path: string;
  body?: unknown;
  token?: string | null;
  cookie?: string | null;
}) => {
  const { method, path: urlPath, body, token, cookie } = args;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;

  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${urlPath}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      // Extract Set-Cookie headers (Node fetch: getSetCookie() returns array)
      const setCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];

      return { status: res.status, ok: res.ok, data, setCookie };
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }
    }
  }
  return {
    status: 0,
    ok: false,
    data: { message: lastErr instanceof Error ? lastErr.message : 'Network error' },
    setCookie: [],
  };
});
