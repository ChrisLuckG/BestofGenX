import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import MikeTask from '@/models/MikeTask';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();
    
    const task = await MikeTask.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );
    
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const task = await MikeTask.findByIdAndDelete(id);
    
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 });
  }
}
