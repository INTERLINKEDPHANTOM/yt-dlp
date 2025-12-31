import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { tasks } from '../../lib/tasks';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp';
const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

// Ensure download dir exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

export async function POST(req: Request) {
    const body = await req.json();
    const { url, format_id } = body;

    if (!url) return NextResponse.json({ message: "URL required" }, { status: 400 });

    const taskId = uuidv4();

    // Initialize Task
    tasks.set(taskId, {
        id: taskId,
        status: 'queued',
        progress: 0,
        logs: ['[system] Task initialized...'],
        filename: null,
        error: null
    });

    // Start Background Process
    startDownload(taskId, url, format_id);

    return NextResponse.json({ task_id: taskId });
}

function startDownload(taskId: string, url: string, format_id: string) {
    const task = tasks.get(taskId);
    if (!task) return;

    const outTmpl = path.join(DOWNLOAD_DIR, `${taskId}_%(title)s.%(ext)s`);

    const args = [
        '--newline', // Important for parsing
        '--progress',
        '--no-colors', // Easier to regex
        '-o', outTmpl,
        url
    ];

    if (format_id) {
        args.unshift('-f', format_id);
    } else {
        args.unshift('-f', 'best');
    }

    task.logs.push(`[system] Spawning yt-dlp with args: ${args.join(' ')}`);

    const child = spawn(YT_DLP_PATH, args);

    child.stdout.on('data', (data) => {
        const str = data.toString();
        // Parse progress
        // Example: [download]  24.5% of 10.00MiB at  2.50MiB/s ETA 00:03
        const percentMatch = str.match(/(\d+\.\d+)%/);
        if (percentMatch) {
            task.progress = parseFloat(percentMatch[1]);
            task.status = 'downloading';
        }

        // Add to logs (trim to avoid overflow)
        const lines = str.split('\n').filter((l: string) => l.trim());
        task.logs.push(...lines);
        if (task.logs.length > 50) task.logs = task.logs.slice(-50);
    });

    child.stderr.on('data', (data) => {
        task.logs.push(`[stderr] ${data.toString()}`);
    });

    child.on('close', (code) => {
        if (code === 0) {
            task.status = 'finished';
            task.progress = 100;
            task.logs.push('[system] Download complete!');

            // Find the file
            try {
                const files = fs.readdirSync(DOWNLOAD_DIR);
                const found = files.find(f => f.startsWith(`${taskId}_`));
                if (found) {
                    task.filename = path.join(DOWNLOAD_DIR, found);
                    task.logs.push(`[system] File ready: ${found}`);
                } else {
                    task.error = "File not found after download";
                }
            } catch (e) {
                task.error = "Error finding file";
            }
        } else {
            task.status = 'error';
            task.error = `Process exited with code ${code}`;
        }
    });
}
