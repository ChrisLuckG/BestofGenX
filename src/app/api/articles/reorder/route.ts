import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// POST - Reorder articles using DIRECT MongoDB (bypasses Mongoose schema)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { userId, articleIds } = body;
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    if (!articleIds || !Array.isArray(articleIds)) {
      return NextResponse.json({ success: false, error: 'Missing articleIds array' }, { status: 400 });
    }
    
    // Verify user is admin
    const user = await User.findById(userId).select('isAdmin').lean();
    if (!user?.isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }
    
    // DIRECT MongoDB update - bypasses Mongoose schema caching
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ success: false, error: 'No DB connection' }, { status: 500 });
    }
    
    const results = [];
    for (let i = 0; i < articleIds.length; i++) {
      const result = await db.collection('articles').updateOne(
        { _id: new mongoose.Types.ObjectId(articleIds[i]) },
        { $set: { order: i } }
      );
      results.push({ id: articleIds[i], order: i, modified: result.modifiedCount });
    }
    
    return NextResponse.json({ success: true, message: `Updated ${articleIds.length} articles`, results });
  } catch (error: unknown) {
    console.error('Failed to reorder articles:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
