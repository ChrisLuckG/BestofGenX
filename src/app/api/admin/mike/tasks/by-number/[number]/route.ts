import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import MikeTask from '@/models/MikeTask';

// GET ticket by number
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    await dbConnect();
    const { number } = await params;
    const ticketNumber = parseInt(number, 10);
    
    const task = await MikeTask.findOne({ ticketNumber });
    
    if (!task) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Failed to fetch ticket:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch ticket' }, { status: 500 });
  }
}

// UPDATE ticket by number
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    await dbConnect();
    const { number } = await params;
    const ticketNumber = parseInt(number, 10);
    const body = await request.json();
    
    const task = await MikeTask.findOneAndUpdate(
      { ticketNumber },
      { $set: { ...body, updatedAt: new Date() } },
      { new: true }
    );
    
    if (!task) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Failed to update ticket:', error);
    return NextResponse.json({ success: false, error: 'Failed to update ticket' }, { status: 500 });
  }
}
