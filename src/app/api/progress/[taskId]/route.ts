import { NextResponse } from 'next/server';
import { tasks } from '../../../lib/tasks';

export async function GET(
    request: Request,
    { params }: { params: { taskId: string } }
) {
    const { taskId } = await params; // Next.js 15+ Params are async or sync depending on version, generic is safer

    const task = tasks.get(taskId);
    if (!task) {
        return NextResponse.json({ message: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
}
