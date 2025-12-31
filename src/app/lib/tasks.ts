
export interface Task {
    id: string;
    status: 'queued' | 'downloading' | 'processing' | 'finished' | 'error';
    progress: number;
    logs: string[];
    filename: string | null;
    error: string | null;
}

// Use globalThis to persist across reloads in dev
const globalAny: any = global;

if (!globalAny.downloadTasks) {
    globalAny.downloadTasks = new Map<string, Task>();
}

export const tasks = globalAny.downloadTasks as Map<string, Task>;
