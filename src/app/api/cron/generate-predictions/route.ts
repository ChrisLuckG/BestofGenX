import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongoose';
import Prediction from '@/models/Prediction';
import User from '@/models/User';
import { berlinDateAt } from '@/lib/berlinTime';
import { sendPushNotification } from '@/lib/webpush';

// Load central system prompt
function getSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), 'src', 'prompts', 'system-prompt.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return '';
  }
}

// Fetch Bitcoin price (CoinGecko - free, reliable)
async function getBitcoinPrice(): Promise<number | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (res.ok) {
      const data = await res.json();
      return Math.round(data.bitcoin?.usd || 0);
    }
  } catch (e) {
    console.error('Bitcoin fetch failed:', e);
  }
  return null;
}

// Fetch Gold price (free API)
async function getGoldPrice(): Promise<number | null> {
  try {
    // Using goldapi.io free tier or fallback
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd');
    if (res.ok) {
      const data = await res.json();
      // Tether Gold tracks gold price per ounce
      return Math.round(data['tether-gold']?.usd || 2350);
    }
  } catch (e) {
    console.error('Gold fetch failed:', e);
  }
  return null;
}

// Fetch stock price (Yahoo Finance)
async function getStockPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
    if (res.ok) {
      const data = await res.json();
      const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
      return price ? Math.round(price * 100) / 100 : null;
    }
  } catch (e) {
    console.error(`Stock ${symbol} fetch failed:`, e);
  }
  return null;
}

// POST - Generate predictions using web search + AI
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const now = new Date();
    const activeCount = await Prediction.countDocuments({
      status: 'active',
      closesAt: { $gt: now },
    });

    if (activeCount >= 4) {
      return NextResponse.json({ 
        success: true, 
        message: `Already have ${activeCount} active predictions`,
        generated: 0 
      });
    }

    const toGenerate = Math.min(4 - activeCount, 4);
    
    // Get current date info
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(tomorrow);

    console.log('[generate-predictions] Fetching real-time data...');

    // Fetch REAL prices from APIs
    const [bitcoinPrice, goldPrice, teslaPrice] = await Promise.all([
      getBitcoinPrice(),
      getGoldPrice(),
      getStockPrice('TSLA'),
    ]);
    
    console.log('[generate-predictions] Bitcoin:', bitcoinPrice);
    console.log('[generate-predictions] Gold:', goldPrice);
    console.log('[generate-predictions] Tesla:', teslaPrice);

    // Give AI the REAL data - it must use these exact values
    const realTimeData = `
TODAY: ${today}
TOMORROW: ${tomorrowStr}

VERIFIED CURRENT PRICES (use these EXACT values):
- Bitcoin: $${bitcoinPrice || 68000}
- Gold: $${goldPrice || 2350} per ounce
- Tesla (TSLA): $${teslaPrice || 180}

YOU MUST USE THESE EXACT PRICES IN YOUR PREDICTIONS!
Example: "Will Bitcoin be above $${bitcoinPrice || 68000} tomorrow?" (NOT $80,000 or any other number!)

For SPORT: Only create predictions if you are 100% certain a match is happening. If unsure, skip sport and do more finance/weather.

RESOLUTION: All predictions resolved at 09:00 Berlin time the day AFTER the event.
`;

    const openai = new OpenAI({ apiKey });
    const systemPrompt = getSystemPrompt();

    // Use the real prices we fetched - AI must use these exact values
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Create ${toGenerate} predictions using ONLY the verified data below:

${realTimeData}

CRITICAL: Use the EXACT prices provided above! Do NOT invent different numbers!
For sport: Skip if you're not 100% sure about a real match. Focus on finance predictions with the real prices.`,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ success: false, error: 'Failed to parse AI output' }, { status: 502 });
    }

    const list: any[] = Array.isArray(parsed.predictions) ? parsed.predictions : [];

    const docs = list
      .filter((p) => p && typeof p.question === 'string' && Array.isArray(p.options) && p.options.length >= 2)
      .slice(0, toGenerate)
      .map((p) => {
        // dayOffset determines timing: 1 = today's event, 2 = tomorrow's event, etc.
        const dayOffset = Math.min(Math.max(Number(p.dayOffset) || 1, 1), 3);
        // Betting closes at 23:00 on the day BEFORE resolution
        const closesAt = berlinDateAt(dayOffset - 1, 23, 0);
        // Resolution at 09:00 on dayOffset day
        const eventDate = berlinDateAt(dayOffset, 9, 0);
        
        return {
          question: p.question.trim(),
          category: ['sport', 'finance', 'weather', 'entertainment'].includes(p.category) ? p.category : 'other',
          options: p.options.map((label: string, i: number) => ({ 
            id: String.fromCharCode(97 + i), 
            label: typeof label === 'string' ? label.trim() : String(label)
          })),
          genXRelated: false,
          source: 'bot' as const,
          status: 'active' as const,
          pointsReward: 100,
          closesAt,
          eventDate,
          searchQuery: p.searchQuery || p.question,
          referenceValue: p.referenceValue || null,
          referenceUnit: p.referenceUnit || null,
        };
      });

    if (docs.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid predictions generated' }, { status: 502 });
    }

    const created = await Prediction.insertMany(docs);
    console.log(`[generate-predictions] Created ${created.length} predictions`);

    // Notify all users with push enabled that new predictions are available
    if (created.length > 0) {
      const usersWithPush = await User.find({
        pushSubscription: { $ne: null },
        notifyBattleResults: { $ne: false }, // Reuse this setting for now
      }).select('pushSubscription');

      console.log(`[generate-predictions] Notifying ${usersWithPush.length} users`);

      for (const user of usersWithPush) {
        if (user.pushSubscription) {
          sendPushNotification(
            user.pushSubscription,
            {
              title: 'New Predictions Available!',
              body: `${created.length} new predictions are waiting. Place your bets!`,
              tag: 'new-predictions',
              url: '/mobile?tab=arcade&game=predictions',
            },
            String(user._id)
          ).catch((err) => console.error('prediction notify failed:', err));
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      generated: created.length, 
      predictions: created.map(p => ({ id: p._id, question: p.question }))
    });

  } catch (error: any) {
    console.error('generate-predictions error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

// GET - Check status
export async function GET() {
  try {
    await dbConnect();
    
    const now = new Date();
    const active = await Prediction.countDocuments({
      status: 'active',
      closesAt: { $gt: now },
    });

    return NextResponse.json({ 
      success: true, 
      activePredictions: active,
      message: `${active} active predictions currently`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
