import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';

export async function POST() {
  try {
    await dbConnect();
    
    // Delete all open battles with 0.10 wager
    const result = await Battle.deleteMany({ 
      wager: 0.10, 
      status: 'open' 
    });
    
    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
    });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
