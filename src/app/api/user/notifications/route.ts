import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

// GET - Get notification settings
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    const user = await User.findById(userId).select('notifyBattleResults notifyBattleAccepted notifyRanking');
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      settings: {
        battleResults: user.notifyBattleResults !== false,
        battleAccepted: user.notifyBattleAccepted !== false,
        ranking: user.notifyRanking !== false
      }
    });
  } catch (error: any) {
    console.error('Failed to get notification settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Update notification settings
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { userId, settings } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
    }
    
    const updateData: any = {};
    if (typeof settings.battleResults === 'boolean') {
      updateData.notifyBattleResults = settings.battleResults;
    }
    if (typeof settings.battleAccepted === 'boolean') {
      updateData.notifyBattleAccepted = settings.battleAccepted;
    }
    if (typeof settings.ranking === 'boolean') {
      updateData.notifyRanking = settings.ranking;
    }
    
    await User.findByIdAndUpdate(userId, updateData);
    
    return NextResponse.json({ success: true, message: 'Settings updated' });
  } catch (error: any) {
    console.error('Failed to update notification settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
