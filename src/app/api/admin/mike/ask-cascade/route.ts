import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// This endpoint is called when Mike needs to ask Cascade something
// It writes to the cascade-queue.json so Cascade sees the question

export async function POST(request: NextRequest) {
  try {
    const { ticketId, question, context } = await request.json();
    
    if (!question) {
      return NextResponse.json({ success: false, error: 'No question provided' }, { status: 400 });
    }

    const queuePath = path.join(process.cwd(), 'src', 'cascade-queue.json');
    
    // Read current queue
    let queue: { status: string; tasks: unknown[]; mikeQuestion: unknown } = { status: 'idle', tasks: [], mikeQuestion: null };
    try {
      const content = fs.readFileSync(queuePath, 'utf-8');
      queue = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid
    }

    // Add Mike's question for Cascade
    queue.mikeQuestion = {
      ticketId,
      question,
      context,
      askedAt: new Date().toISOString()
    };

    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));

    return NextResponse.json({ 
      success: true, 
      message: 'Question sent to Cascade. He will see it and respond.' 
    });

  } catch (error) {
    console.error('Ask Cascade error:', error);
    return NextResponse.json({ success: false, error: 'Failed to ask Cascade' }, { status: 500 });
  }
}
