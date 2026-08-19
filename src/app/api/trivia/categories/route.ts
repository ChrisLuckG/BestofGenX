import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Question from '@/models/Question';

export async function GET() {
  try {
    await dbConnect();
    
    // Get counts per theme
    const counts = await Question.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$theme', count: { $sum: 1 } } }
    ]);
    
    const countMap = Object.fromEntries(counts.map((c: any) => [c._id, c.count]));
    const themes = counts.map((c: any) => c._id).filter(Boolean);
    
    // Total count
    const total = counts.reduce((sum, c) => sum + c.count, 0);
    
    return NextResponse.json({ 
      success: true, 
      themes,
      counts: countMap,
      total,
    });

  } catch (error: any) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
