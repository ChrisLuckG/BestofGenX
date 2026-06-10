import { NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * Stripe Revenue & Activity API
 *
 * Shows revenue + transactions (not your costs to Stripe, those are fees ~2.9% + 30¢).
 * Uses existing STRIPE_SECRET_KEY from env.
 */
export async function GET() {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'STRIPE_SECRET_KEY not set in environment',
        helpUrl: 'https://dashboard.stripe.com/apikeys',
      });
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2024-12-18.acacia' as any });

    // Get balance
    const balance = await stripe.balance.retrieve();

    // Get charges in current month
    const now = new Date();
    const startOfMonth = Math.floor(new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).getTime() / 1000);

    const charges = await stripe.charges.list({
      created: { gte: startOfMonth },
      limit: 100,
    });

    let monthlyRevenueCents = 0;
    let monthlySuccessCount = 0;
    let monthlyFailCount = 0;
    let monthlyFeesCents = 0;

    for (const charge of charges.data) {
      if (charge.status === 'succeeded' && !charge.refunded) {
        monthlyRevenueCents += charge.amount;
        monthlySuccessCount++;
      } else if (charge.status === 'failed') {
        monthlyFailCount++;
      }
    }

    // Fetch balance transactions to get fees
    const balanceTxns = await stripe.balanceTransactions.list({
      created: { gte: startOfMonth },
      limit: 100,
    });

    for (const txn of balanceTxns.data) {
      if (txn.type === 'charge' || txn.type === 'payment') {
        monthlyFeesCents += txn.fee || 0;
      }
    }

    // Currency: get from first charge or default to EUR
    const currency = charges.data[0]?.currency?.toUpperCase() || 'EUR';

    // Available balance (sum across all currencies in stripe balance)
    const availableCents = balance.available.reduce((sum, b) => sum + b.amount, 0);
    const pendingCents = balance.pending.reduce((sum, b) => sum + b.amount, 0);

    return NextResponse.json({
      success: true,
      configured: true,
      currency,
      monthlyRevenue: monthlyRevenueCents / 100,
      monthlyFees: monthlyFeesCents / 100,
      monthlyNet: (monthlyRevenueCents - monthlyFeesCents) / 100,
      monthlySuccessCount,
      monthlyFailCount,
      balance: {
        available: availableCents / 100,
        pending: pendingCents / 100,
      },
    });
  } catch (error: any) {
    console.error('Stripe data error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch Stripe data',
    }, { status: 500 });
  }
}
