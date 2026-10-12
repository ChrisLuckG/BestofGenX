import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Poll from '@/models/Poll';
import Article from '@/models/Article';

// GET - Get single poll
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const poll = await Poll.findById(params.id).lean();
    
    if (!poll) {
      return NextResponse.json({ success: false, error: 'Poll not found' }, { status: 404 });
    }

    // Find the article this rankroll belongs to. In practice the link lives in the
    // article HTML - the "Vote Now" CTA carries data-rankroll-id="<pollId>" - and
    // neither poll.linkedArticleId nor article.linkedContentId is set. The id is a
    // 24-char hex ObjectId (validated by findById above), so it is regex-safe.
    let linkedArticle: { _id: string; title: string } | null = null;
    const or: Record<string, unknown>[] = [
      { content: { $regex: `data-rankroll-id="${params.id}"` } },
      { linkedContentId: params.id },
    ];
    if ((poll as any).linkedArticleId) or.push({ _id: (poll as any).linkedArticleId });
    const article = await Article.findOne({ $or: or }).sort({ publishedAt: -1, createdAt: -1 }).select('title').lean();
    if (article) {
      linkedArticle = { _id: (article as any)._id.toString(), title: (article as any).title };
    }
    
    return NextResponse.json({ success: true, poll, linkedArticle });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - Update poll
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const body = await request.json();
    
    const poll = await Poll.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true }
    );
    
    if (!poll) {
      return NextResponse.json({ success: false, error: 'Poll not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, poll });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete poll
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    await Poll.findByIdAndDelete(params.id);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
