import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const QUEUE_FILE = path.join(process.cwd(), 'src', 'cascade-queue.json');

// Read queue status
export async function GET() {
  try {
    if (!fs.existsSync(QUEUE_FILE)) {
      return NextResponse.json({ status: 'idle', tasks: [] });
    }
    
    const content = fs.readFileSync(QUEUE_FILE, 'utf-8');
    const data = JSON.parse(content);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Queue read error:', error);
    return NextResponse.json({ status: 'idle', tasks: [] });
  }
}

// Write to queue (from Mike UI)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const queueData = {
      status: body.status || 'pending',
      tasks: body.tasks || [],
      lastUpdated: new Date().toISOString(),
      response: null,
    };
    
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queueData, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Queue write error:', error);
    return NextResponse.json({ success: false, error: 'Failed to write queue' }, { status: 500 });
  }
}

// Update queue (from Cascade when done)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    let queueData: { status: string; tasks: any[]; response: string | null; lastUpdated: string | null } = { status: 'idle', tasks: [], response: null, lastUpdated: null };
    
    if (fs.existsSync(QUEUE_FILE)) {
      const content = fs.readFileSync(QUEUE_FILE, 'utf-8');
      queueData = JSON.parse(content);
    }
    
    queueData.status = body.status || queueData.status;
    queueData.response = body.response || queueData.response;
    queueData.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queueData, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Queue update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update queue' }, { status: 500 });
  }
}
