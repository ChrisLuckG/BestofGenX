import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';

/**
 * GET /api/users/stats
 * Returns counts of real humans vs bots for the welcome page,
 * plus the first 50 users (humans first, then bots) for the grid visualization.
 */
export async function GET() {
  try {
    await dbConnect();

    // Count real humans (not bots, not reporters, not deleted)
    const humansCount = await User.countDocuments({
      isBot: { $ne: true },
      isReporter: { $ne: true },
      isAIReporter: { $ne: true },
      isDeleted: { $ne: true },
    });

    // Count bots
    const botsCount = await User.countDocuments({
      isBot: true,
      isDeleted: { $ne: true },
    });

    // Fetch first humans (up to 50) for the grid
    const humanUsers = await User.find({
      isBot: { $ne: true },
      isReporter: { $ne: true },
      isAIReporter: { $ne: true },
      isDeleted: { $ne: true },
    })
      .select('username avatar country countryFlag bogxCoins createdAt')
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    // Fetch bots to fill remaining slots
    const botsNeeded = Math.max(0, 50 - humanUsers.length);
    const botUsers = botsNeeded > 0
      ? await User.find({
          isBot: true,
          isDeleted: { $ne: true },
        })
          .select('username avatar country countryFlag bogxCoins createdAt')
          .sort({ createdAt: 1 })
          .limit(botsNeeded)
          .lean()
      : [];

    // Combine: humans first, then bots
    const gridUsers = [
      ...humanUsers.map((u: any) => ({
        _id: u._id.toString(),
        username: u.username,
        avatar: u.avatar,
        country: u.country,
        countryFlag: u.countryFlag,
        coins: Math.round((u.bogxCoins ?? 0) * 100) / 100,
        joinedAt: u.createdAt,
        isBot: false,
      })),
      ...botUsers.map((u: any) => ({
        _id: u._id.toString(),
        username: u.username,
        avatar: u.avatar,
        country: u.country,
        countryFlag: u.countryFlag,
        coins: Math.round((u.bogxCoins ?? 0) * 100) / 100,
        joinedAt: u.createdAt,
        isBot: true,
      })),
    ];

    return NextResponse.json({
      success: true,
      humans: humansCount,
      bots: botsCount,
      gridUsers,
    });
  } catch (error: any) {
    console.error('Failed to get user stats:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
