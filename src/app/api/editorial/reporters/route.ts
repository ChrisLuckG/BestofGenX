import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import ReporterProfile from '@/models/ReporterProfile';
import { generateReporterSystemPrompt } from '@/lib/generateReporterPrompt';
import bcrypt from 'bcryptjs';

// GET - list all AI reporters with their profiles
export async function GET() {
  try {
    await dbConnect();

    const profiles = await ReporterProfile.find({}).sort({ createdAt: 1 }).lean();
    const userIds = profiles.map(p => p.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select('username displayName avatar email isAuthor isAIReporter')
      .lean();

    const userMap: Record<string, typeof users[0]> = {};
    for (const u of users) {
      userMap[u._id.toString()] = u;
    }

    const reporters = profiles.map(p => ({
      ...p,
      user: userMap[p.userId.toString()] || null,
    }));

    return NextResponse.json({ success: true, reporters });
  } catch (error) {
    console.error('Editorial reporters GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load reporters' }, { status: 500 });
  }
}

// POST - create a new AI reporter
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const {
      name,
      email,
      avatar,
      role,
      nationality,
      region,
      responsibilities,
      writingStyle,
      politicalTendency,
      personality,
    } = body;

    if (!name || !role || !responsibilities) {
      return NextResponse.json(
        { success: false, error: 'name, role, and responsibilities are required' },
        { status: 400 }
      );
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const username = `ai_${slug}`.slice(0, 20);
    const reporterEmail = email || `${slug}@bogx-editorial.internal`;

    // Check if username/email already exist
    const existing = await User.findOne({
      $or: [{ username }, { email: reporterEmail }],
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Reporter "${name}" already exists` },
        { status: 409 }
      );
    }

    // Create User account
    const hashedPassword = await bcrypt.hash(`bogx_${slug}_${Date.now()}`, 10);
    const user = await User.create({
      username,
      email: reporterEmail,
      password: hashedPassword,
      displayName: name,
      avatar: avatar || '',
      isAuthor: true,
      isAIReporter: true,
      isBot: false,
      emailVerified: true,
      bio: `AI Reporter at BOGX. Role: ${role}.`,
    });

    // Generate system prompt
    const systemPrompt = generateReporterSystemPrompt({
      name,
      role,
      region: region || nationality || '',
      responsibilities,
      writingStyle,
      politicalTendency,
      personality,
    });

    // Create ReporterProfile
    const profile = await ReporterProfile.create({
      userId: user._id,
      slug,
      role,
      region: region || 'global',
      nationality: nationality || '',
      politicalTendency: politicalTendency || '',
      responsibilities,
      writingStyle: writingStyle || '',
      personality: personality || '',
      systemPrompt,
      memories: [],
    });

    return NextResponse.json({
      success: true,
      reporter: {
        ...profile.toObject(),
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          email: user.email,
        },
      },
    });
  } catch (error) {
    console.error('Editorial reporter POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create reporter' }, { status: 500 });
  }
}
