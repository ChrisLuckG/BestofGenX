import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Question from '@/models/Question';

// GET single question
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const question = await Question.findById(id);
    if (!question) {
      return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, question });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT update question
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const data = await request.json();
    
    // Validate if options/correctAnswer changed
    if (data.options && data.correctAnswer) {
      if (!data.options.includes(data.correctAnswer)) {
        return NextResponse.json({ 
          success: false, 
          error: 'correctAnswer must be one of the options' 
        }, { status: 400 });
      }
    }
    
    const question = await Question.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    );
    
    if (!question) {
      return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, question });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE question
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const question = await Question.findByIdAndDelete(id);
    if (!question) {
      return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, deleted: true });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
