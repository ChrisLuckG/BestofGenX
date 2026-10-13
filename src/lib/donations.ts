import type Stripe from 'stripe';
import dbConnect from '@/lib/mongoose';
import Donation from '@/models/Donation';

// Server-only helpers for the "war chest" donations (Stripe Checkout, mode payment).
// A donation session is told apart from a shop order by metadata.type === 'donation';
// both Stripe webhooks must hand those sessions to recordDonationSession() and return,
// otherwise the shop code treats them as an order without a shipping address.

export const DONATION_MIN_EUR = 1;
export const DONATION_MAX_EUR = 500;

export const isDonationSession = (session: Stripe.Checkout.Session) => session.metadata?.type === 'donation';

/** Idempotent: the same session recorded twice leaves one row. Unpaid sessions are ignored. */
export async function recordDonationSession(session: Stripe.Checkout.Session): Promise<boolean> {
  if (!isDonationSession(session) || session.payment_status !== 'paid' || !session.amount_total) return false;
  await dbConnect();
  await Donation.updateOne(
    { stripeSessionId: session.id },
    {
      $setOnInsert: {
        stripeSessionId: session.id,
        amountCents: session.amount_total,
        currency: session.currency || 'eur',
        livemode: session.livemode,
        userId: session.metadata?.userId || undefined,
        email: session.customer_details?.email || undefined,
        paidAt: new Date(),
      },
    },
    { upsert: true }
  );
  return true;
}

/**
 * The figures shown in the panel. Only donations of the SAME mode as the running key
 * count: a test key (local dev, which shares the database) must not inflate the live
 * number, and live payments must not show up while testing.
 */
export async function getDonationSummary() {
  await dbConnect();
  const live = !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test');
  const rows = await Donation.find({ livemode: live }).select('amountCents userId email stripeSessionId').lean() as
    { amountCents: number; userId?: string; email?: string; stripeSessionId: string }[];
  const supporters = new Set(rows.map(r => r.userId || r.email || r.stripeSessionId)).size;
  const totalCents = rows.reduce((s, r) => s + r.amountCents, 0);
  return { totalEur: totalCents / 100, supporters, count: rows.length, live };
}
