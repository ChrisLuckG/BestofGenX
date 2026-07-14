import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import NotificationLog from '@/models/NotificationLog';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const source = searchParams.get('source');
    const userId = searchParams.get('userId');
    
    const query: any = {};
    if (source) query.source = source;
    if (userId) query.userId = userId;
    
    const logs = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    // Get unique sources for filter dropdown
    const sources = await NotificationLog.distinct('source');
    
    // Get stats
    const stats = await NotificationLog.aggregate([
      {
        $group: {
          _id: '$source',
          total: { $sum: 1 },
          successful: { $sum: { $cond: ['$success', 1, 0] } },
          failed: { $sum: { $cond: ['$success', 0, 1] } },
        }
      },
      { $sort: { total: -1 } }
    ]);
    
    return NextResponse.json({ 
      success: true, 
      logs,
      sources,
      stats,
      total: await NotificationLog.countDocuments(query)
    });
  } catch (error: any) {
    console.error('[notification-logs] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
