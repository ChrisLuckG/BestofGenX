import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import MikeTask from '@/models/MikeTask';

export async function GET() {
  try {
    await dbConnect();
    const tasks = await MikeTask.find().sort({ createdAt: -1 }).lean();
    
    // Ensure chatMessages exists on all tasks
    const tasksWithChat = tasks.map(task => ({
      ...task,
      chatMessages: task.chatMessages || []
    }));
    
    return NextResponse.json({ success: true, tasks: tasksWithChat });
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    
    const task = await MikeTask.create({
      title: body.title,
      description: body.description || '',
      originalRequest: body.originalRequest || '',
      chatHistory: body.chatHistory || '',
      category: body.category || 'Frontend',
      priority: body.priority || 'Medium',
      status: body.status || 'Draft',
      complexity: body.complexity || 'Medium',
      notes: body.notes || '',
      aiSuggestions: body.aiSuggestions || '',
      relatedPromptSection: body.relatedPromptSection || '',
      attachments: body.attachments || [],
    });
    
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 });
  }
}
