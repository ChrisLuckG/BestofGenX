import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { isDonationSession, recordDonationSession } from '@/lib/donations';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// GET - called when the visitor lands back from Stripe. Records the payment right away
// (idempotent, so it makes no difference whether the webhook got there first) and
// returns the amount for the thank-you message.
export async function GET(request: Request) {
  try {
    const sessionId = new URL(request.url).searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ success: false, error: 'Missing session_id' }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!isDonationSession(session)) return NextResponse.json({ success: false, error: 'Not a donation' }, { status: 400 });

    const paid = session.payment_status === 'paid';
    if (paid) await recordDonationSession(session);
    return NextResponse.json({ success: true, paid, amountEur: (session.amount_total || 0) / 100 });
  } catch (error) {
    console.error('Donation verify error:', error);
    return NextResponse.json({ success: false, error: 'Could not verify the payment' }, { status: 500 });
  }
}
