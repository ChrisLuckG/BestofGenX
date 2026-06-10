import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Reward from '@/models/Reward';

export async function GET() {
  try {
    await dbConnect();
    const rewards = await Reward.find({ active: true }).sort({ cost: -1 });
    return NextResponse.json({ success: true, rewards });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const data = await request.json();
    const reward = await Reward.create(data);
    return NextResponse.json({ success: true, reward });
  } catch (error) {
    console.error('Error creating reward:', error);
    return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const { id, ...data } = await request.json();
    const reward = await Reward.findByIdAndUpdate(id, data, { new: true });
    return NextResponse.json({ success: true, reward });
  } catch (error) {
    console.error('Error updating reward:', error);
    return NextResponse.json({ error: 'Failed to update reward' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const { id } = await request.json();
    await Reward.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reward:', error);
    return NextResponse.json({ error: 'Failed to delete reward' }, { status: 500 });
  }
}
