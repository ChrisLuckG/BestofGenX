import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET - Warmup endpoint to keep MongoDB connection alive
// Call this every 5 minutes via Vercel Cron to prevent cold starts
export async function GET() {
  try {
    const start = Date.now();
    
    await dbConnect();
    
    // Simple query to keep connection warm
    const count = await User.countDocuments({}).limit(1);
    
    const duration = Date.now() - start;
    
    return NextResponse.json({ 
      success: true, 
      message: 'DB connection warm',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Warmup failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
