import { NextResponse } from 'next/server';
import { getDonationSummary } from '@/lib/donations';

export const dynamic = 'force-dynamic';

// GET - supporters and total for the war chest panel. `paypal` tells the panel whether
// PayPal is switched on in the Stripe dashboard (set DONATE_PAYPAL_ENABLED=true once it is).
export async function GET() {
  try {
    const s = await getDonationSummary();
    return NextResponse.json({ success: true, ...s, paypal: process.env.DONATE_PAYPAL_ENABLED === 'true' });
  } catch (error) {
    console.error('Donation summary error:', error);
    return NextResponse.json({ success: false, totalEur: 0, supporters: 0, count: 0, paypal: false });
  }
}
