import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Battle from '@/models/Battle';

// GET - Get a single battle by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    
    const battle = await Battle.findById(params.id)
      .populate('creator', 'username avatar country countryFlag points')
      .populate('opponent', 'username avatar country countryFlag points')
      .populate('winner', 'username');
    
    if (!battle) {
      return NextResponse.json({ success: false, error: 'Battle not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, battle });
  } catch (error: any) {
    console.error('Failed to get battle:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
