import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import TVCategory from '@/models/TVCategory';

// GET - Fetch all categories
export async function GET() {
  try {
    await dbConnect();
    const categories = await TVCategory.find({ active: true }).sort({ order: 1, name: 1 });
    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create new category
export async function POST(request: Request) {
  try {
    await dbConnect();
    const { name } = await request.json();
    
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Name required' }, { status: 400 });
    }
    
    // Get max order
    const maxOrder = await TVCategory.findOne().sort({ order: -1 });
    const order = (maxOrder?.order || 0) + 1;
    
    const category = await TVCategory.create({ name: name.trim(), order });
    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json({ success: false, error: 'Category already exists' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update category
export async function PUT(request: Request) {
  try {
    await dbConnect();
    const { _id, name, order, active } = await request.json();
    
    const category = await TVCategory.findByIdAndUpdate(
      _id,
      { name, order, active },
      { new: true }
    );
    
    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - Reorder categories (bulk update)
export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const { orderedIds } = await request.json();
    
    if (!orderedIds || !Array.isArray(orderedIds)) {
      return NextResponse.json({ success: false, error: 'orderedIds array required' }, { status: 400 });
    }
    
    // Update order for each category
    const updates = orderedIds.map((id: string, index: number) => 
      TVCategory.findByIdAndUpdate(id, { order: index })
    );
    
    await Promise.all(updates);
    
    const categories = await TVCategory.find({ active: true }).sort({ order: 1 });
    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete category
export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    
    await TVCategory.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
