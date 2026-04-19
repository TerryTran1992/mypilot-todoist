import { contextBridge, ipcRenderer } from 'electron';

export type ApiResponse = {
  status: number;
  ok: boolean;
  data: unknown;
  setCookie: string[];
};

contextBridge.exposeInMainWorld('api', {
  request: (args: {
    method: string;
    path: string;
    body?: unknown;
    token?: string | null;
    cookie?: string | null;
  }): Promise<ApiResponse> => ipcRenderer.invoke('api:request', args),
  hideQuickAdd: () => ipcRenderer.send('quick-add:hide'),
  notifyTodoCreated: () => ipcRenderer.send('quick-add:created'),
  onTodosRefresh: (callback: () => void) => {
    ipcRenderer.on('todos:refresh', callback);
    return () => ipcRenderer.removeListener('todos:refresh', callback);
  },
  platform: process.platform,
});
