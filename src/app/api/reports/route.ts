import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Report from '@/models/Report';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { type, questionId, question, claimedAnswer, userAnswer, userId } = body;

    if (!type) {
      return NextResponse.json({ success: false, error: 'Missing type' }, { status: 400 });
    }

    const report = await Report.create({
      type,
      questionId,
      question,
      claimedAnswer,
      userAnswer,
      userId,
      status: 'pending',
    });

    console.log('New report created:', report._id, type, question?.substring(0, 50));

    return NextResponse.json({ success: true, reportId: report._id });
  } catch (error) {
    console.error('Report creation error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create report' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const reports = await Report.find(
      status === 'all' ? {} : { status }
    ).sort({ createdAt: -1 }).limit(100);

    return NextResponse.json({ success: true, reports });
  } catch (error) {
    console.error('Reports fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch reports' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { reportId, status, notes } = body;

    if (!reportId || !status) {
      return NextResponse.json({ success: false, error: 'Missing reportId or status' }, { status: 400 });
    }

    const report = await Report.findByIdAndUpdate(
      reportId,
      { status, notes },
      { new: true }
    );

    if (!report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Report update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update report' }, { status: 500 });
  }
}
