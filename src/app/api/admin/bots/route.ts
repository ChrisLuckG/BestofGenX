import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

// Bot names - realistic gaming usernames
const botNames = [
  'ShadowHunter', 'NightWolf', 'BlazeMaster', 'CyberNinja', 'StormRider',
  'PhoenixFire', 'IceQueen', 'ThunderBolt', 'DarkKnight', 'StarGazer',
  'MoonWalker', 'SunChaser', 'WildCard', 'LuckyStrike', 'GoldenEagle',
  'SilverFox', 'RedDragon', 'BlueTiger', 'GreenMamba', 'PurpleHaze',
  'CrimsonKing', 'JadeWarrior', 'OnyxBlade', 'DiamondDust', 'RubyFlash',
  'EmeraldEye', 'SapphireWave', 'TopazGlow', 'AmberLight', 'CoralReef'
];

// Countries for bots
const countries = [
  { name: 'Germany', flag: '🇩🇪' },
  { name: 'USA', flag: '🇺🇸' },
  { name: 'UK', flag: '🇬🇧' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'Spain', flag: '🇪🇸' },
  { name: 'Italy', flag: '🇮🇹' },
  { name: 'Brazil', flag: '🇧🇷' },
  { name: 'Japan', flag: '🇯🇵' },
  { name: 'Canada', flag: '🇨🇦' },
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'Netherlands', flag: '🇳🇱' },
  { name: 'Sweden', flag: '🇸🇪' },
  { name: 'Poland', flag: '🇵🇱' },
  { name: 'Austria', flag: '🇦🇹' },
  { name: 'Switzerland', flag: '🇨🇭' },
];

// GET - List all bots
export async function GET() {
  try {
    await dbConnect();
    
    // Find bots by isBot flag OR by known bot names
    const bots = await User.find({ 
      $or: [
        { isBot: true },
        { username: { $in: botNames } }
      ]
    })
      .select('username avatar country countryFlag points wins gamesPlayed botActive isBot createdAt')
      .sort({ points: -1 });
    
    return NextResponse.json({ success: true, bots });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - Toggle bot active status or toggle all bots
export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();
    const { botId, active, toggleAll } = await request.json();
    
    if (toggleAll !== undefined) {
      // Toggle all bots on/off
      await User.updateMany({ isBot: true }, { botActive: toggleAll });
      return NextResponse.json({ 
        success: true, 
        message: `All bots ${toggleAll ? 'activated' : 'deactivated'}` 
      });
    }
    
    if (botId) {
      // Toggle single bot
      const bot = await User.findByIdAndUpdate(
        botId, 
        { botActive: active },
        { new: true }
      );
      return NextResponse.json({ success: true, bot });
    }
    
    return NextResponse.json({ success: false, error: 'Missing botId or toggleAll' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create bots
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { count = 20 } = await request.json();
    
    // Get existing bot names to avoid duplicates
    const existingBots = await User.find({ isBot: true }).select('username');
    const existingNames = new Set(existingBots.map(b => b.username));
    
    // Filter available names
    const availableNames = botNames.filter(name => !existingNames.has(name));
    
    if (availableNames.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'All bot names are already in use' 
      }, { status: 400 });
    }
    
    const botsToCreate = Math.min(count, availableNames.length);
    const createdBots = [];
    
    for (let i = 0; i < botsToCreate; i++) {
      const name = availableNames[i];
      const country = countries[Math.floor(Math.random() * countries.length)];
      const hashedPassword = await bcrypt.hash('bot_password_' + Date.now(), 10);
      
      // Random stats
      const gamesPlayed = Math.floor(Math.random() * 50) + 10;
      const winRate = 0.3 + Math.random() * 0.5; // 30-80% win rate
      const wins = Math.floor(gamesPlayed * winRate);
      const points = Math.floor(Math.random() * 2000) + 200;
      
      const bot = await User.create({
        username: name,
        email: `${name.toLowerCase()}@bot.sporttock.com`,
        password: hashedPassword,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        country: country.name,
        countryFlag: country.flag,
        points,
        wins,
        gamesPlayed,
        isBot: true,
        botActive: true,
        hasReceivedWelcomeBonus: true,
      });
      
      createdBots.push({
        id: bot._id,
        username: bot.username,
        country: bot.country,
        points: bot.points,
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      created: createdBots.length,
      bots: createdBots 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete all bots or specific bot
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get('id');
    
    if (botId) {
      // Delete specific bot
      const result = await User.findOneAndDelete({ _id: botId, isBot: true });
      if (!result) {
        return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, deleted: 1 });
    } else {
      // Delete all bots
      const result = await User.deleteMany({ isBot: true });
      return NextResponse.json({ success: true, deleted: result.deletedCount });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
