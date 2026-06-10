import { NextResponse } from 'next/server';

/**
 * Resend Usage API
 *
 * Requires: RESEND_API_KEY in env
 * Docs: https://resend.com/docs/api-reference/emails/list-emails
 *
 * Note: Resend doesn't expose $ amounts via API. We compute estimates based on emails sent.
 * Free tier: 3000/month, 100/day. Pro: $20/mo for 50k.
 */
export async function GET() {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'RESEND_API_KEY not set in environment',
        helpUrl: 'https://resend.com/api-keys',
      });
    }

    // Fetch emails sent (paginated; we just get the first page to get a count + sample)
    const res = await fetch('https://api.resend.com/emails?limit=100', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        success: false,
        configured: true,
        error: `Resend API error (${res.status}): ${errText.slice(0, 200)}`,
      });
    }

    const data = await res.json();
    const emails = data.data || [];

    // Count emails sent in current month
    const now = new Date();
    const startOfMonth = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

    let monthlyCount = 0;
    let totalCount = emails.length;
    const statusBreakdown: Record<string, number> = {};

    for (const email of emails) {
      const createdAt = new Date(email.created_at);
      if (createdAt >= startOfMonth) monthlyCount++;
      const status = email.last_event || 'sent';
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
    }

    // Plan thresholds (USD)
    const freeLimit = 3000;
    const proLimit = 50000;
    let estimatedPlan = 'Free ($0)';
    let estimatedCostUsd = 0;
    if (monthlyCount > freeLimit) {
      estimatedPlan = 'Pro ($20)';
      estimatedCostUsd = 20;
    }
    if (monthlyCount > proLimit) {
      estimatedPlan = 'Scale ($90+)';
      estimatedCostUsd = 90;
    }

    return NextResponse.json({
      success: true,
      configured: true,
      monthlyCount,
      totalRecent: totalCount,
      estimatedPlan,
      estimatedCostUsd,
      freeLimit,
      statusBreakdown,
      note: 'Resend does not expose billing $ via API. Estimates based on plan tiers.',
    });
  } catch (error: any) {
    console.error('Resend usage error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch Resend usage',
    }, { status: 500 });
  }
}
