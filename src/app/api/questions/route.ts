import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Question from '@/models/Question';
import crypto from 'crypto';

// GET questions - with optional filters
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const theme = searchParams.get('theme');
    const difficulty = searchParams.get('difficulty');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Build query
    const query: any = { active: true };
    if (theme) query.theme = theme;
    if (difficulty) query.difficulty = difficulty;
    
    // Get questions
    const questions = await Question.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    
    // Get total count
    const total = await Question.countDocuments(query);
    
    // Get counts by theme
    const themeCounts = await Question.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$theme', count: { $sum: 1 } } }
    ]);
    
    // Get counts by difficulty
    const difficultyCounts = await Question.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);
    
    return NextResponse.json({ 
      success: true, 
      questions,
      total,
      themeCounts: Object.fromEntries(themeCounts.map(t => [t._id, t.count])),
      difficultyCounts: Object.fromEntries(difficultyCounts.map(d => [d._id, d.count])),
    });
    
  } catch (error: any) {
    console.error('Error fetching questions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST create new question
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const data = await request.json();
    
    // Validate
    if (!data.question || !data.options || data.options.length !== 4 || !data.correctAnswer) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: question, options (4), correctAnswer' 
      }, { status: 400 });
    }
    
    if (!data.options.includes(data.correctAnswer)) {
      return NextResponse.json({ 
        success: false, 
        error: 'correctAnswer must be one of the options' 
      }, { status: 400 });
    }
    
    // Generate hash
    const questionHash = crypto.createHash('md5')
      .update(data.question.toLowerCase().trim())
      .digest('hex');
    
    // Check for duplicate
    const existing = await Question.findOne({ questionHash });
    if (existing) {
      return NextResponse.json({ 
        success: false, 
        error: 'Question already exists',
        existingId: existing._id,
      }, { status: 409 });
    }
    
    // Create
    const question = await Question.create({
      ...data,
      questionHash,
      active: true,
    });
    
    return NextResponse.json({ success: true, question });
    
  } catch (error: any) {
    console.error('Error creating question:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
