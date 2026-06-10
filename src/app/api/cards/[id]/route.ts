import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Card from '@/models/Card';

// GET single card
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const card = await Card.findById(params.id);
    
    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, card });
  } catch (error: any) {
    console.error('Error fetching card:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch card' },
      { status: 500 }
    );
  }
}

// PUT update card
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const data = await request.json();
    
    const card = await Card.findByIdAndUpdate(
      params.id,
      data,
      { new: true, runValidators: true }
    );
    
    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, card });
  } catch (error: any) {
    console.error('Error updating card:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update card' },
      { status: 500 }
    );
  }
}

// DELETE card
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await dbConnect();
    const card = await Card.findByIdAndDelete(params.id);
    
    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'Card deleted' });
  } catch (error: any) {
    console.error('Error deleting card:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete card' },
      { status: 500 }
    );
  }
}
