import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import dbConnect from '@/lib/mongoose';
import Prediction from '@/models/Prediction';
import UserPrediction from '@/models/UserPrediction';
import User from '@/models/User';
import Notification from '@/models/Notification';
import { sendPushNotification } from '@/lib/webpush';

// POST - Cron job to auto-resolve expired predictions using GPT-4o with web browsing
// Call this via Vercel Cron or manually
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (optional security)
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

    // Find predictions that are:
    // - status: active (not yet resolved)
    // - closesAt: in the past (betting closed)
    // - source: bot (auto-generated, not manual)
    const now = new Date();
    const expiredPredictions = await Prediction.find({
      status: 'active',
      closesAt: { $lt: now },
      source: 'bot',
    }).limit(10); // Process max 10 at a time

    if (expiredPredictions.length === 0) {
      return NextResponse.json({ success: true, message: 'No predictions to resolve', resolved: 0 });
    }

    const openai = new OpenAI({ apiKey });
    const results: { id: string; question: string; resolved: boolean; answer?: string; error?: string }[] = [];

    for (const prediction of expiredPredictions) {
      try {
        console.log(`[resolve-predictions] Resolving: ${prediction.question}`);

        // Ask AI to determine the correct answer
        const optionLabels = prediction.options.map((o: any) => `${o.id}: ${o.label}`).join('\n');
        const referenceInfo = prediction.referenceValue 
          ? `Reference value: ${prediction.referenceValue} ${prediction.referenceUnit || ''}`
          : '';
        
        // For finance predictions, fetch current price to compare
        let currentValue: number | null = null;
        if (prediction.category === 'finance' && prediction.referenceValue) {
          if (prediction.question.toLowerCase().includes('bitcoin')) {
            const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            if (res.ok) {
              const data = await res.json();
              currentValue = Math.round(data.bitcoin?.usd || 0);
            }
          } else if (prediction.question.toLowerCase().includes('gold')) {
            const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd');
            if (res.ok) {
              const data = await res.json();
              currentValue = Math.round(data['tether-gold']?.usd || 0);
            }
          } else if (prediction.question.toLowerCase().includes('tesla')) {
            const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/TSLA?interval=1d&range=1d');
            if (res.ok) {
              const data = await res.json();
              currentValue = data.chart?.result?.[0]?.meta?.regularMarketPrice || null;
            }
          }
        }

        const currentValueInfo = currentValue 
          ? `\nCURRENT VALUE (just fetched): ${currentValue} ${prediction.referenceUnit || ''}`
          : '';

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a fact-checker. Determine the correct answer based on the data provided.

IMPORTANT:
- For finance: Compare the current value with the reference value to determine if it's "above" or "below"
- Only answer if you have enough data to be CONFIDENT
- If data is missing or unclear, respond with: {"confident": false}
- If you know the answer, respond with: {"confident": true, "correctOptionId": "a" or "b", "reason": "brief explanation"}

Respond ONLY with valid JSON.`
            },
            {
              role: 'user',
              content: `Answer this question:

Question: ${prediction.question}
${referenceInfo}${currentValueInfo}

Options:
${optionLabels}`
            }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });

        const aiResponse = completion.choices[0]?.message?.content || '{}';
        let parsed: any;
        try {
          parsed = JSON.parse(aiResponse);
        } catch {
          results.push({ id: String(prediction._id), question: prediction.question, resolved: false, error: 'Failed to parse AI response' });
          continue;
        }

        if (!parsed.confident) {
          console.log(`[resolve-predictions] Not confident for: ${prediction.question}`);
          results.push({ id: String(prediction._id), question: prediction.question, resolved: false, error: 'AI not confident about result' });
          continue;
        }

        const correctOptionId = parsed.correctOptionId;
        const validOption = prediction.options.some((o: any) => o.id === correctOptionId);
        
        if (!validOption) {
          results.push({ id: String(prediction._id), question: prediction.question, resolved: false, error: `Invalid option ID: ${correctOptionId}` });
          continue;
        }

        // Resolve the prediction!
        console.log(`[resolve-predictions] Resolving: ${prediction.question} -> ${correctOptionId} (${parsed.reason})`);
        
        prediction.correctOptionId = correctOptionId;
        prediction.status = 'resolved';
        prediction.resolvedAt = new Date();
        await prediction.save();

        // Award points and send notifications (same logic as admin route)
        const userPredictions = await UserPrediction.find({ predictionId: prediction._id, isCorrect: null });
        const correctOption = prediction.options.find((o: any) => o.id === correctOptionId);
        const winAmount = prediction.pointsReward * 2;

        for (const up of userPredictions) {
          const correct = up.optionId === correctOptionId;
          up.isCorrect = correct;
          up.pointsAwarded = correct ? winAmount : 0;
          await up.save();

          const userDoc = await User.findByIdAndUpdate(
            up.userId,
            correct
              ? { $inc: { bogxCoins: winAmount, gamesPlayed: 1, wins: 1 } }
              : { $inc: { gamesPlayed: 1 } },
            { new: true }
          ).select('pushSubscription notifyBattleResults');

          // Create in-app notification
          try {
            await Notification.create({
              userId: up.userId,
              type: 'prediction_result',
              title: correct ? 'Prediction Won!' : 'Prediction Lost',
              message: correct
                ? `You called "${prediction.question}" right! +${winAmount}P earned!`
                : `"${prediction.question}" was "${correctOption?.label || 'revealed'}". You lost ${prediction.pointsReward}P.`,
              read: false,
              predictionId: prediction._id,
              predictionQuestion: prediction.question,
              predictionOptions: prediction.options,
              predictionCorrectOptionId: correctOptionId,
              userOptionId: up.optionId,
              pointsAwarded: correct ? winAmount : 0,
              pointsReward: prediction.pointsReward,
              won: correct,
            });
          } catch (notifError) {
            console.error('prediction in-app notification failed:', notifError);
          }

          // Fire push notification
          if (userDoc?.pushSubscription && userDoc.notifyBattleResults !== false) {
            sendPushNotification(
              userDoc.pushSubscription,
              {
                title: correct ? 'Prediction Won!' : 'Prediction Lost',
                body: correct
                  ? `You called "${prediction.question}" right! +${winAmount}P earned!`
                  : `"${prediction.question}" was "${correctOption?.label || 'revealed'}". You lost ${prediction.pointsReward}P.`,
                tag: `prediction-result-${prediction._id}`,
                url: '/mobile?tab=notifications',
              },
              String(up.userId)
            ).catch((err) => console.error('prediction push failed:', err));
          }
        }

        results.push({ 
          id: String(prediction._id), 
          question: prediction.question, 
          resolved: true, 
          answer: `${correctOptionId}: ${correctOption?.label}` 
        });

      } catch (predError: any) {
        console.error(`[resolve-predictions] Error resolving ${prediction._id}:`, predError);
        results.push({ id: String(prediction._id), question: prediction.question, resolved: false, error: predError.message });
      }
    }

    const resolvedCount = results.filter(r => r.resolved).length;
    return NextResponse.json({ 
      success: true, 
      resolved: resolvedCount, 
      total: expiredPredictions.length,
      results 
    });

  } catch (error: any) {
    console.error('resolve-predictions cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET - Check status (for manual testing)
export async function GET() {
  try {
    await dbConnect();
    
    const now = new Date();
    const pending = await Prediction.countDocuments({
      status: 'active',
      closesAt: { $lt: now },
      source: 'bot',
    });

    return NextResponse.json({ 
      success: true, 
      pendingResolutions: pending,
      message: pending > 0 ? `${pending} predictions waiting to be resolved` : 'No predictions pending'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
