import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import RadioStation from '@/models/RadioStation';

// GET - Fetch all radio stations
export async function GET() {
  try {
    await dbConnect();
    const stations = await RadioStation.find({ active: true }).sort({ order: 1 }).lean();
    return NextResponse.json({ success: true, stations });
  } catch (error: unknown) {
    console.error('Failed to fetch radio stations:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST - Create new radio station
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { name, description, playlistId, imageUrl } = await request.json();
    
    if (!name || !playlistId) {
      return NextResponse.json({ success: false, error: 'Name and playlistId required' }, { status: 400 });
    }
    
    // Get max order
    const maxOrder = await RadioStation.findOne().sort({ order: -1 }).select('order').lean();
    const order = (maxOrder?.order || 0) + 1;
    
    const station = await RadioStation.create({
      name,
      description: description || '',
      playlistId,
      imageUrl: imageUrl || '',
      order,
      active: true,
    });
    
    return NextResponse.json({ success: true, station });
  } catch (error: unknown) {
    console.error('Failed to create radio station:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PUT - Update radio station
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const { id, name, description, playlistId, imageUrl, active, order } = await request.json();
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Station ID required' }, { status: 400 });
    }
    
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (playlistId !== undefined) updates.playlistId = playlistId;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (active !== undefined) updates.active = active;
    if (order !== undefined) updates.order = order;
    
    const station = await RadioStation.findByIdAndUpdate(id, updates, { new: true });
    
    if (!station) {
      return NextResponse.json({ success: false, error: 'Station not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, station });
  } catch (error: unknown) {
    console.error('Failed to update radio station:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE - Delete radio station
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Station ID required' }, { status: 400 });
    }
    
    await RadioStation.findByIdAndDelete(id);
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to delete radio station:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
