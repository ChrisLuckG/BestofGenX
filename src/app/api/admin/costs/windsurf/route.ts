import { NextResponse } from 'next/server';

/**
 * Windsurf (Cascade/Claude AI Coding Assistant) Costs
 *
 * Windsurf has no public billing API, so we use a fixed monthly amount from env.
 *
 * Set WINDSURF_MONTHLY_USD in env (e.g. WINDSURF_MONTHLY_USD=15)
 * Optional: WINDSURF_PLAN_NAME (e.g. "Pro")
 */
export async function GET() {
  const monthlyUsdStr = process.env.WINDSURF_MONTHLY_USD;
  const planName = process.env.WINDSURF_PLAN_NAME || 'Subscription';

  if (!monthlyUsdStr) {
    return NextResponse.json({
      success: false,
      configured: false,
      error: 'WINDSURF_MONTHLY_USD not set in environment',
      helpUrl: 'https://windsurf.com/account',
    });
  }

  const monthlyCostUsd = parseFloat(monthlyUsdStr);
  if (isNaN(monthlyCostUsd)) {
    return NextResponse.json({
      success: false,
      configured: true,
      error: `WINDSURF_MONTHLY_USD is not a valid number: "${monthlyUsdStr}"`,
    });
  }

  return NextResponse.json({
    success: true,
    configured: true,
    monthlyCostUsd,
    planName,
    note: 'Fixed amount from environment. Windsurf has no public billing API.',
  });
}
