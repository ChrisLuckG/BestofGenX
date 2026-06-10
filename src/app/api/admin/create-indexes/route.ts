import { NextResponse } from 'next/server';
import { ensureIndexes } from '@/lib/db-indexes';

export async function POST() {
  try {
    const success = await ensureIndexes();
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'All indexes created successfully' 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to create some indexes' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating indexes:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to create indexes' 
  });
}
