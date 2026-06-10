import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Page from '@/models/Page';

// GET - Fetch all pages or single page by slug
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    
    if (slug) {
      const page = await Page.findOne({ slug }).lean();
      if (!page) {
        return NextResponse.json({ success: false, error: 'Page not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, page });
    }
    
    const pages = await Page.find().sort({ order: 1 }).lean();
    return NextResponse.json({ success: true, pages });
  } catch (error: unknown) {
    console.error('Failed to fetch pages:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST - Create or update page
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const body = await request.json();
    const { slug, title, subtitle, content, coverImage, status } = body;
    
    if (!slug || !title) {
      return NextResponse.json({ success: false, error: 'Slug and title required' }, { status: 400 });
    }
    
    // Upsert - create or update
    const page = await Page.findOneAndUpdate(
      { slug },
      { slug, title, subtitle, content: content || '', coverImage, status: status || 'published' },
      { upsert: true, new: true }
    );
    
    return NextResponse.json({ success: true, page });
  } catch (error: unknown) {
    console.error('Failed to save page:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
