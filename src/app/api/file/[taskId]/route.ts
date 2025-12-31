import { NextResponse } from 'next/server';
import { tasks } from '../../../lib/tasks';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: Request,
    { params }: { params: { taskId: string } }
) {
    const { taskId } = await params;

    const task = tasks.get(taskId);
    if (!task || !task.filename) {
        return NextResponse.json({ message: 'File not ready' }, { status: 400 });
    }

    const filePath = task.filename;
    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ message: 'File missing on disk' }, { status: 404 });
    }

    // To stream the file in Next.js App Router:
    const stats = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);

    const filename = path.basename(filePath);
    // Remove UUID prefix
    // {uuid}_{title} -> {title}
    let downloadName = filename;
    if (filename.startsWith(taskId + '_')) {
        downloadName = filename.substring(taskId.length + 1);
    }

    // @ts-ignore: ReadableStream mismatch with node stream but works in Next.js response
    return new NextResponse(fileStream, {
        headers: {
            'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadName)}"`,
            'Content-Length': stats.size.toString(),
        },
    });
}
