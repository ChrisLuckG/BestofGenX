import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

// Bot names - realistic gaming usernames (up to 200)
const botNames = [
  // Original 30
  'ShadowHunter', 'NightWolf', 'BlazeMaster', 'CyberNinja', 'StormRider',
  'PhoenixFire', 'IceQueen', 'ThunderBolt', 'DarkKnight', 'StarGazer',
  'MoonWalker', 'SunChaser', 'WildCard', 'LuckyStrike', 'GoldenEagle',
  'SilverFox', 'RedDragon', 'BlueTiger', 'GreenMamba', 'PurpleHaze',
  'CrimsonKing', 'JadeWarrior', 'OnyxBlade', 'DiamondDust', 'RubyFlash',
  'EmeraldEye', 'SapphireWave', 'TopazGlow', 'AmberLight', 'CoralReef',
  // 30 more
  'VelvetStorm', 'IronWill', 'CrystalMind', 'SteelNerve', 'BronzeHeart',
  'GhostRider', 'SoulSeeker', 'DreamCatcher', 'NeonFlash', 'VoidWalker',
  'FrostBite', 'FlameKeeper', 'WindRunner', 'EarthShaker', 'WaterDancer',
  'SkyDiver', 'CloudSurfer', 'RainMaker', 'SnowFall', 'SunBurst',
  'MidnightSun', 'DawnBreaker', 'DuskFall', 'TwilightZone', 'EclipseStar',
  'NovaFlare', 'CosmicDust', 'GalaxyRider', 'NebulaKing', 'AsteroidHunter',
  // 30 more
  'PixelPunk', 'ByteBoss', 'CodeBreaker', 'DataMiner', 'CryptoKing',
  'TechWizard', 'NetRunner', 'HackMaster', 'VirusHunter', 'FirewallX',
  'AlphaWolf', 'BetaTest', 'GammaRay', 'DeltaForce', 'OmegaMan',
  'ZeroHero', 'OneShot', 'TwoFace', 'TripleThreat', 'QuadKill',
  'AcePilot', 'KingSlayer', 'QueenBee', 'JackOfAll', 'JokerWild',
  'RookieRush', 'BishopMove', 'KnightRider', 'PawnStar', 'CheckMate',
  // 30 more
  'VikingRage', 'SamuraiX', 'NinjaStrike', 'PirateKing', 'GladiatorX',
  'SpartanWar', 'RomanEmpire', 'GreekGod', 'NorseThunder', 'CelticFire',
  'AztecGold', 'MayanSun', 'IncaStone', 'EgyptPharaoh', 'PersianKing',
  'MongolHorde', 'ZuluWarrior', 'ApacheChief', 'SiouxBrave', 'CherokeeWind',
  'TigerClaw', 'LionHeart', 'WolfPack', 'BearStrength', 'EagleEye',
  'HawkStrike', 'FalconDive', 'RavenDark', 'OwlWisdom', 'PhoenixRise',
  // 30 more
  'RetroGamer', 'ArcadeKing', 'PixelHero', 'BitCrusher', 'ChipTune',
  'SynthWave', 'VaporTrail', 'NeonNight', 'CyberPunk', 'TechNoir',
  'FuturePast', 'TimeLord', 'SpaceAce', 'StarLord', 'MoonChild',
  'SunKing', 'NightOwl', 'DayDream', 'TwilightKid', 'MidnightRun',
  'ShadowPlay', 'LightBringer', 'DarkMatter', 'BrightStar', 'DeepSpace',
  'HighVoltage', 'LowRider', 'FastLane', 'SlowBurn', 'QuickSilver',
  // 20 more to reach 200
  'GenXLegend', 'RetroKid', 'VintageVibes', 'ClassicRock', 'OldSchool',
  'NewWave', 'PunkRock', 'GrungeMaster', 'MetalHead', 'RockStar',
  'PopIcon', 'HipHopKing', 'JazzCat', 'BluesBrother', 'SoulMan',
  'FunkMaster', 'DiscoKing', 'TechnoViking', 'HouseMusic', 'TranceState'
];

// Main bot that should never be deleted
const MAIN_BOT_USERNAME = 'ShadowHunter';

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
      
      // Start with 0 stats like real new users
      const bot = await User.create({
        username: name,
        email: `${name.toLowerCase()}@bot.sporttock.com`,
        password: hashedPassword,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        country: country.name,
        countryFlag: country.flag,
        points: 0,
        bogpiCoins: 0,
        wins: 0,
        gamesPlayed: 0,
        isBot: true,
        botActive: true,
        hasReceivedWelcomeBonus: false, // Let them earn welcome bonus like real users
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
      // Delete specific bot (but protect main bot)
      const bot = await User.findOne({ _id: botId, isBot: true });
      if (!bot) {
        return NextResponse.json({ success: false, error: 'Bot not found' }, { status: 404 });
      }
      if (bot.username === MAIN_BOT_USERNAME) {
        return NextResponse.json({ success: false, error: 'Cannot delete main bot ShadowHunter' }, { status: 400 });
      }
      await User.findByIdAndDelete(botId);
      return NextResponse.json({ success: true, deleted: 1 });
    } else {
      // Delete all bots EXCEPT main bot (ShadowHunter)
      const result = await User.deleteMany({ isBot: true, username: { $ne: MAIN_BOT_USERNAME } });
      return NextResponse.json({ success: true, deleted: result.deletedCount, preserved: MAIN_BOT_USERNAME });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
