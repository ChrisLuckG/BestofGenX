import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import Reward from '@/models/Reward';
import GameResult from '@/models/GameResult';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const PRINTFUL_API_TOKEN = process.env.PRINTFUL_API_TOKEN;
const PRINTFUL_API_URL = 'https://api.printful.com';

// Create order confirmation email
function createRewardOrderEmail(customerName: string, rewardName: string, shippingAddress: any) {
  const addressHtml = shippingAddress ? `
    <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
      <h3 style="color: #f20550; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0;">Lieferadresse</h3>
      <p style="color: #cccccc; font-size: 14px; line-height: 1.6; margin: 0;">
        ${shippingAddress.name}<br>
        ${shippingAddress.street}<br>
        ${shippingAddress.zip} ${shippingAddress.city}<br>
        ${shippingAddress.country}
      </p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000; padding: 40px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #f20550; font-size: 32px; margin: 0;">Best of GenX</h1>
      <p style="color: #888888; font-size: 14px; margin-top: 8px;">Reward Redemption</p>
    </div>
    
    <!-- Confirmation -->
    <div style="background: linear-gradient(135deg, rgba(242,5,80,0.2), rgba(128,0,255,0.2)); border: 1px solid rgba(242,5,80,0.3); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
      <div style="font-size: 48px; margin-bottom: 16px;">🎁</div>
      <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 8px 0;">Reward eingelöst!</h2>
      <p style="color: #cccccc; font-size: 16px; margin: 0;">Herzlichen Glückwunsch, ${customerName}!</p>
    </div>
    
    <!-- Reward Details -->
    <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
      <h3 style="color: #f20550; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0;">Dein Reward</h3>
      <p style="color: #ffffff; font-size: 18px; font-weight: bold; margin: 0;">${rewardName}</p>
    </div>
    
    ${addressHtml}
    
    <!-- Info -->
    <div style="text-align: center; padding: 20px;">
      <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
        Dein Reward wird jetzt für dich vorbereitet. 
        Du erhältst eine weitere E-Mail mit Tracking-Infos sobald dein Paket unterwegs ist!
      </p>
      <p style="color: #f20550; font-size: 14px; margin: 0;">
        ✨ Danke fürs Spielen! ✨
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
      <p style="color: #666666; font-size: 12px; margin: 0;">
        © 2026 Best of GenX | For the 80s, 90s & 2000s Generation
      </p>
    </div>
    
  </div>
</body>
</html>
  `;
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    
    const { userId, rewardId, productId, variantId, shippingAddress, email } = await request.json();

    if (!userId || !rewardId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Get user and reward
    const user = await User.findById(userId);
    const reward = await Reward.findById(rewardId);

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Block bots from redeeming rewards
    if (user.isBot) {
      return NextResponse.json({ success: false, error: 'Bots cannot redeem rewards' }, { status: 403 });
    }

    if (!reward) {
      return NextResponse.json({ success: false, error: 'Reward not found' }, { status: 404 });
    }

    // Check if user has enough coins
    if ((user.bogxCoins || 0) < reward.cost) {
      return NextResponse.json({ success: false, error: 'Not enough coins' }, { status: 400 });
    }

    // If this is a shop product, create Printful order
    if (productId && shippingAddress) {
      try {
        // Create order in Printful
        const orderData = {
          external_id: `reward-${rewardId}-${Date.now()}`,
          recipient: {
            name: shippingAddress.name,
            email: email || user.email,
            phone: user.phone || '',
            address1: shippingAddress.street,
            address2: '',
            city: shippingAddress.city,
            state_code: '',
            country_code: shippingAddress.country === 'Germany' ? 'DE' : shippingAddress.country === 'Austria' ? 'AT' : 'CH',
            zip: shippingAddress.zip,
          },
          items: [
            {
              sync_variant_id: parseInt(variantId) || 1,
              quantity: 1,
            },
          ],
        };

        const orderRes = await fetch(`${PRINTFUL_API_URL}/orders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData),
        });

        const orderResult = await orderRes.json();

        if (!orderRes.ok) {
          console.error('Printful order error:', orderResult);
          throw new Error(orderResult.error?.message || 'Failed to create order');
        }

        console.log('Printful order created:', orderResult.result?.id);
        
        // Confirm the order (send to production)
        if (orderResult.result?.id) {
          await fetch(`${PRINTFUL_API_URL}/orders/${orderResult.result.id}/confirm`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${PRINTFUL_API_TOKEN}`,
            },
          });
        }
      } catch (printfulError: any) {
        console.error('Printful error:', printfulError);
        return NextResponse.json({ success: false, error: printfulError.message || 'Failed to create shop order' }, { status: 500 });
      }
    }

    // Deduct coins from user
    const bogxBefore = user.bogxCoins || 0;
    user.bogxCoins = bogxBefore - reward.cost;
    await user.save();

    // Record ledger entry so ranking scores stay in sync with the wallet
    try {
      const today = new Date().toLocaleString('en-CA', {
        timeZone: 'Europe/Berlin',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).split(',')[0];
      await GameResult.create({
        userId: user._id,
        username: user.username,
        cardId: 'reward-redeem',
        question: `Redeemed: ${reward.name}`,
        userAnswer: null,
        correctAnswer: '-',
        isCorrect: false,
        pointsChange: -reward.cost,
        pointsBefore: bogxBefore,
        pointsAfter: user.bogxCoins,
        timeUsed: 0,
        difficulty: 1,
        skipped: false,
        timedOut: false,
        gameDate: today,
      });
    } catch (e) {
      console.error('redeem-shop: failed to create GameResult:', e);
    }

    // Send confirmation email
    if (email || user.email) {
      try {
        await resend.emails.send({
          from: 'Best of GenX <noreply@bestofgenx.com>',
          to: [email || user.email],
          subject: '🎁 Reward eingelöst! - Best of GenX',
          html: createRewardOrderEmail(user.username, reward.name, shippingAddress),
        });
      } catch (emailError) {
        console.error('Email error:', emailError);
        // Don't fail the order if email fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Reward redeemed successfully',
      newCoins: user.bogxCoins,
    });
  } catch (error: any) {
    console.error('Redeem shop reward error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
