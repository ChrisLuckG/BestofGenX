import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import CurrencyConfig, { DEFAULT_CURRENCY_CONFIG } from '@/models/CurrencyConfig';

// GET - Get currency config
export async function GET() {
  try {
    await dbConnect();
    
    // Get or create default config (singleton)
    let config = await CurrencyConfig.findOne();
    if (!config) {
      config = await CurrencyConfig.create({});
    }
    
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('Failed to get currency config:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Update currency config
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    
    // Update or create config (singleton)
    const config = await CurrencyConfig.findOneAndUpdate(
      {},
      { $set: body },
      { new: true, upsert: true }
    );
    
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    console.error('Failed to update currency config:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
