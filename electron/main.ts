import { app, BrowserWindow, ipcMain, dialog, globalShortcut, Tray, Menu, nativeImage, screen } from 'electron';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';

const isDev = process.env.NODE_ENV === 'development';
const API_BASE = process.env.API_BASE || 'https://api.mypilot.life';

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;
let quickAddWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createQuickAddWindow() {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.show();
    quickAddWindow.focus();
    return;
  }

  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width } = display.workArea;

  quickAddWindow = new BrowserWindow({
    width: 560,
    height: 180,
    x: x + Math.round((width - 560) / 2),
    y: y + 180,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    vibrancy: 'under-window',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    quickAddWindow.loadURL('http://localhost:5173/quick-add.html');
  } else {
    quickAddWindow.loadFile(path.join(__dirname, '../dist/quick-add.html'));
  }

  quickAddWindow.once('ready-to-show', () => {
    quickAddWindow?.show();
    quickAddWindow?.focus();
  });

  quickAddWindow.on('blur', () => {
    hideQuickAdd();
  });

  quickAddWindow.on('closed', () => {
    quickAddWindow = null;
  });
}

function hideQuickAdd() {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.hide();
  }
}

function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function toggleQuickAdd() {
  if (quickAddWindow && !quickAddWindow.isDestroyed() && quickAddWindow.isVisible()) {
    hideQuickAdd();
  } else {
    createQuickAddWindow();
  }
}

function createTrayIcon() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'tray-icon.png')
    : path.join(__dirname, '../build/tray-icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  icon = icon.resize({ width: 18, height: 18 });
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('MyPilot Todoist');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Add Task',
      accelerator: 'Ctrl+Space',
      click: () => toggleQuickAdd(),
    },
    { type: 'separator' },
    {
      label: 'Show Todoist',
      accelerator: 'CmdOrCtrl+Shift+T',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'CmdOrCtrl+Q',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => showMainWindow());
}

app.whenReady().then(() => {
  createWindow();
  createTrayIcon();

  globalShortcut.register('Ctrl+Space', () => toggleQuickAdd());
  globalShortcut.register('CmdOrCtrl+Shift+T', () => showMainWindow());

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

ipcMain.on('quick-add:hide', () => {
  hideQuickAdd();
});

ipcMain.on('quick-add:created', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('todos:refresh');
  }
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
