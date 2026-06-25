import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';

export async function POST() {
  try {
    await dbConnect();
    
    // Get sample titles to debug
    const samples = await Article.find({}).limit(5).select('title category');
    
    // Update all articles with month names in title to history AND published
    const result = await Article.updateMany(
      { title: { $regex: '(January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d+', $options: 'i' } },
      { $set: { category: 'history', status: 'published' } }
    );
    
    return NextResponse.json({ 
      success: true, 
      matched: result.matchedCount,
      modified: result.modifiedCount,
      sampleTitles: samples.map(a => ({ title: a.title, category: a.category }))
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
