import { contextBridge, ipcRenderer } from 'electron';

export type ApiResponse = { status: number; ok: boolean; data: unknown };

contextBridge.exposeInMainWorld('api', {
  request: (args: {
    method: string;
    path: string;
    body?: unknown;
    token?: string | null;
  }): Promise<ApiResponse> => ipcRenderer.invoke('api:request', args),
});
