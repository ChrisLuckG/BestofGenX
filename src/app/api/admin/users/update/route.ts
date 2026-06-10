import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { userId, newPassword, ...updates } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Whitelist editable fields (admin can update these)
    const allowedFields = [
      'username',
      'email',
      'avatar',
      'displayName',
      'bio',
      'isAdmin',
      'isAuthor',
      'isBot',
      'botActive',
      'country',
      'countryFlag',
      'socialLinks',
    ];

    const patch: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in updates) {
        patch[field] = updates[field];
      }
    }

    // Handle password change
    if (newPassword && newPassword.length >= 6) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      patch.password = hashedPassword;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // strict: false ensures new fields (like isAuthor, displayName, bio)
    // are saved even if the Mongoose schema cache hasn't reloaded
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: patch },
      { new: true, strict: false, runValidators: false }
    )
      .select('-password')
      .lean();

    console.log('User update:', { userId, patch, resultIsAuthor: (user as any)?.isAuthor });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update user' }, { status: 500 });
  }
}
