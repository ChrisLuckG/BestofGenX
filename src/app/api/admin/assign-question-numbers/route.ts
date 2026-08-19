import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Question from '@/models/Question';

/**
 * Assign sequential question numbers to all questions that don't have one
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { dryRun = true } = await request.json();
    
    // Find questions without a number, sorted by createdAt
    const questionsWithoutNumber = await Question.find({ 
      $or: [
        { questionNumber: { $exists: false } },
        { questionNumber: null }
      ]
    }).sort({ createdAt: 1 }).lean();
    
    // Get the highest existing number
    const lastNumbered = await Question.findOne({ questionNumber: { $exists: true, $ne: null } })
      .sort({ questionNumber: -1 })
      .lean();
    
    let nextNumber = (lastNumbered?.questionNumber || 0) + 1;
    let assigned = 0;
    
    if (!dryRun) {
      for (const q of questionsWithoutNumber) {
        await Question.updateOne(
          { _id: q._id },
          { $set: { questionNumber: nextNumber } }
        );
        nextNumber++;
        assigned++;
      }
    }
    
    return NextResponse.json({
      success: true,
      dryRun,
      questionsWithoutNumber: questionsWithoutNumber.length,
      startingNumber: (lastNumbered?.questionNumber || 0) + 1,
      assigned: dryRun ? questionsWithoutNumber.length : assigned,
    });
    
  } catch (error: any) {
    console.error('Assign numbers error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await dbConnect();
    
    const total = await Question.countDocuments({});
    const withNumber = await Question.countDocuments({ 
      questionNumber: { $exists: true, $ne: null } 
    });
    const withoutNumber = total - withNumber;
    
    const highest = await Question.findOne({ questionNumber: { $exists: true } })
      .sort({ questionNumber: -1 })
      .select('questionNumber')
      .lean();
    
    return NextResponse.json({
      success: true,
      total,
      withNumber,
      withoutNumber,
      highestNumber: highest?.questionNumber || 0,
    });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
