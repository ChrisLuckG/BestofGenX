import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import ReporterProfile from '@/models/ReporterProfile';
import { generateReporterSystemPrompt } from '@/lib/generateReporterPrompt';

// GET - single reporter
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    await dbConnect();
    const profile = await ReporterProfile.findOne({ userId: params.userId }).lean();
    if (!profile) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    const user = await User.findById(params.userId).select('username displayName avatar email').lean();
    return NextResponse.json({ success: true, reporter: { ...profile, user } });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

// PUT - update reporter profile + regenerate system prompt
export async function PUT(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    await dbConnect();
    const body = await request.json();
    const { name, avatar, role, region, specialty, responsibilities, writingStyle, politicalTendency, personality, memories, systemPrompt: customPrompt } = body;

    const profile = await ReporterProfile.findOne({ userId: params.userId });
    if (!profile) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    if (role) profile.role = role;
    if (region !== undefined) profile.region = region;
    if (specialty !== undefined) profile.specialty = specialty;
    if (politicalTendency !== undefined) profile.politicalTendency = politicalTendency;
    if (responsibilities !== undefined) profile.responsibilities = responsibilities;
    if (writingStyle !== undefined) profile.writingStyle = writingStyle;
    if (personality !== undefined) profile.personality = personality;
    if (memories !== undefined) profile.memories = memories;

    // Regenerate system prompt unless a custom one was provided
    if (customPrompt) {
      profile.systemPrompt = customPrompt;
    } else {
      const user = await User.findById(params.userId).select('displayName username').lean();
      const displayName = name || (user as any)?.displayName || (user as any)?.username || 'Reporter';
      profile.systemPrompt = generateReporterSystemPrompt({
        name: displayName,
        role: profile.role,
        region: profile.region,
        responsibilities: profile.responsibilities,
        writingStyle: profile.writingStyle,
        politicalTendency: profile.politicalTendency,
        personality: profile.personality,
        memories: profile.memories,
      });
    }

    await profile.save();

    // Update User if name/avatar changed
    if (name || avatar !== undefined) {
      const userUpdate: Record<string, string> = {};
      if (name) userUpdate.displayName = name;
      if (avatar !== undefined) userUpdate.avatar = avatar;
      await User.findByIdAndUpdate(params.userId, { $set: userUpdate });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Reporter PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
