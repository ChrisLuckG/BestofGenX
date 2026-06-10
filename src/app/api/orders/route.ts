import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Order from '@/models/Order';

// GET - Fetch user's orders
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');

    await dbConnect();

    // Fetch single order by session ID (for success page)
    if (sessionId) {
      const order = await Order.findOne({ stripeSessionId: sessionId });
      if (!order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, order });
    }

    // Fetch all orders for user
    if (userId) {
      const orders = await Order.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50);
      
      return NextResponse.json({ success: true, orders });
    }

    return NextResponse.json({ success: false, error: 'userId or sessionId required' }, { status: 400 });
  } catch (error: any) {
    console.error('Orders API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
