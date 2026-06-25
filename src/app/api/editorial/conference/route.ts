import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import ConferenceSession from '@/models/ConferenceSession';
import Article from '@/models/Article';
import Poll from '@/models/Poll';
import TVVideo from '@/models/TVVideo';

// GET - last session OR full list
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const list = searchParams.get('list') === 'true';

    if (list) {
      const sessions = await ConferenceSession.find().sort({ createdAt: -1 }).limit(20).lean();
      return NextResponse.json({ success: true, sessions });
    }

    const session = await ConferenceSession.findOne().sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create a new conference session (call at START with status: running)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { campaignTopic, conferenceType, results, status } = body;

    const session = await ConferenceSession.create({
      campaignTopic,
      conferenceType,
      results: results || [],
      status: status || 'running',
    });
    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - push a reporter result or update status on existing session
export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { sessionId, result, status } = body;

    if (!sessionId) return NextResponse.json({ success: false, error: 'Missing sessionId' }, { status: 400 });

    const update: any = {};
    if (status) update.status = status;
    if (result) {
      update.$push = { results: result };
    }

    const session = await ConferenceSession.findByIdAndUpdate(
      sessionId,
      result ? { ...update } : { $set: { status } },
      { new: true }
    );
    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - delete a session and all its created content
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Missing session id' }, { status: 400 });
    }

    const session = await ConferenceSession.findById(sessionId).lean() as any;
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    let deleted = { articles: 0, polls: 0, tvVideos: 0 };

    for (const result of (session.results || [])) {
      if (result.articleId) {
        await Article.findByIdAndDelete(result.articleId);
        deleted.articles++;
      }
      if (result.pollId) {
        await Poll.findByIdAndDelete(result.pollId);
        deleted.polls++;
      }
      for (const tvId of (result.tvVideoIds || [])) {
        await TVVideo.findByIdAndDelete(tvId);
        deleted.tvVideos++;
      }
    }

    await ConferenceSession.findByIdAndDelete(sessionId);

    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
