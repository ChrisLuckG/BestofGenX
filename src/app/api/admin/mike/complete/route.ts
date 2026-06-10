import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import MikeTask from '@/models/MikeTask';

// Cost estimation based on complexity (EUR per hour = 50€)
const HOUR_RATE = 50;
const COMPLEXITY_HOURS: Record<string, number> = {
  'Trivial': 0.25,   // 15 min = ~12€
  'Simple': 0.5,     // 30 min = ~25€
  'Medium': 1.5,     // 1.5h = ~75€
  'Complex': 4,      // 4h = ~200€
  'Epic': 12,        // 12h = ~600€
};

// Cascade marks a ticket as complete
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { taskId, status, cascadeNotes, actualHours } = await request.json();
    
    if (!taskId) {
      return NextResponse.json({ success: false, error: 'No taskId' }, { status: 400 });
    }

    const task = await MikeTask.findById(taskId);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    // Calculate actual cost if hours provided
    const actualCost = actualHours ? actualHours * HOUR_RATE : undefined;

    const updates: Record<string, unknown> = {
      status: status || 'Completed',
      cascadeNotes: cascadeNotes || '',
    };

    if (status === 'Completed') {
      updates.completedAt = new Date();
    }

    if (actualCost !== undefined) {
      updates.actualCost = actualCost;
    }

    const updatedTask = await MikeTask.findByIdAndUpdate(taskId, updates, { new: true });
    
    return NextResponse.json({ 
      success: true, 
      task: updatedTask,
      message: `Task "${task.title}" marked as ${status || 'Completed'}`
    });
  } catch (error) {
    console.error('Complete task error:', error);
    return NextResponse.json({ success: false, error: 'Failed to complete task' }, { status: 500 });
  }
}

// Estimate cost for a task (can be called before starting)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json({ success: false, error: 'No taskId' }, { status: 400 });
    }

    const task = await MikeTask.findById(taskId);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }

    const hours = COMPLEXITY_HOURS[task.complexity] || 1;
    const cost = hours * HOUR_RATE;

    return NextResponse.json({ 
      success: true,
      taskId,
      title: task.title,
      complexity: task.complexity,
      estimatedHours: hours,
      estimatedCost: cost,
      formatted: `~${hours}h / ~${cost}€`
    });
  } catch (error) {
    console.error('Estimate error:', error);
    return NextResponse.json({ success: false, error: 'Failed to estimate' }, { status: 500 });
  }
}
