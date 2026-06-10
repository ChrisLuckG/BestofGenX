import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';

// GET - Fix article order (temporary endpoint) - bypasses Mongoose model
export async function GET() {
  try {
    await dbConnect();
    
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ success: false, error: 'No DB connection' }, { status: 500 });
    }
    
    // Direct MongoDB update - bypasses Mongoose schema
    const result1 = await db.collection('articles').updateOne(
      { _id: new mongoose.Types.ObjectId('6a0eed35bfac80ee76f41807') },
      { $set: { order: 0 } }
    );
    
    const result2 = await db.collection('articles').updateOne(
      { _id: new mongoose.Types.ObjectId('6a0ef3e2bfac80ee76f41812') },
      { $set: { order: 1 } }
    );
    
    // Verify
    const articles = await db.collection('articles').find({}).sort({ order: 1 }).toArray();
    
    return NextResponse.json({ 
      success: true, 
      updates: [result1, result2],
      articles: articles.map(a => ({ title: a.title, order: a.order }))
    });
  } catch (error: unknown) {
    console.error('Failed to fix order:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
