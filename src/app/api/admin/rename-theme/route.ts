import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Question from '@/models/Question';

/**
 * Rename a theme in all questions
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { oldTheme, newTheme, dryRun = true } = await request.json();
    
    if (!oldTheme || !newTheme) {
      return NextResponse.json({ success: false, error: 'oldTheme and newTheme required' }, { status: 400 });
    }
    
    // Count affected
    const count = await Question.countDocuments({ theme: oldTheme });
    
    if (!dryRun && count > 0) {
      await Question.updateMany(
        { theme: oldTheme },
        { $set: { theme: newTheme } }
      );
    }
    
    return NextResponse.json({
      success: true,
      dryRun,
      oldTheme,
      newTheme,
      affected: count,
    });
    
  } catch (error: any) {
    console.error('Rename theme error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
