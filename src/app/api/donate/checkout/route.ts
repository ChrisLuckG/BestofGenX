import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { DONATION_MIN_EUR, DONATION_MAX_EUR } from '@/lib/donations';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// POST - start a Stripe Checkout for a war chest donation.
// The amount is validated HERE (whole euros, 1-500); the client only suggests it.
// No payment_method_types on purpose: Stripe offers whatever is switched on in the
// dashboard (card, wallets, and PayPal once it is enabled there).
export async function POST(request: Request) {
  try {
    const { amount, userId, returnPath } = await request.json();
    const eur = Math.round(Number(amount));
    if (!Number.isFinite(eur) || eur < DONATION_MIN_EUR || eur > DONATION_MAX_EUR) {
      return NextResponse.json({ success: false, error: `Amount must be between ${DONATION_MIN_EUR} and ${DONATION_MAX_EUR} EUR` }, { status: 400 });
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const isLocal = host.includes('localhost') || host.includes('192.168');
    const baseUrl = isLocal ? `http://${host}` : 'https://www.bestofgenx.com';
    const path = returnPath === '/desktop' ? '/desktop' : '/mobile';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      submit_type: 'donate',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: eur * 100,
          product_data: {
            name: 'BogX war chest',
            description: 'A donation towards the running costs of Best of GenX. No perks, just gratitude.',
          },
        },
      }],
      metadata: { type: 'donation', ...(userId ? { userId: String(userId) } : {}) },
      success_url: `${baseUrl}${path}?donation=thanks&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${path}?donation=cancelled`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error('Donation checkout error:', error);
    return NextResponse.json({ success: false, error: 'Could not start the payment' }, { status: 500 });
  }
}
