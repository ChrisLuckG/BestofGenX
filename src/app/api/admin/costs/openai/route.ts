import { NextResponse } from 'next/server';

/**
 * OpenAI Usage & Costs API
 *
 * Requires: OPENAI_ADMIN_KEY in env (sk-admin-...)
 * Create one at: https://platform.openai.com/settings/organization/admin-keys
 *
 * Docs:
 *  - https://platform.openai.com/docs/api-reference/usage
 *  - https://platform.openai.com/docs/api-reference/costs
 */
export async function GET() {
  try {
    const adminKey = process.env.OPENAI_ADMIN_KEY;
    if (!adminKey) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'OPENAI_ADMIN_KEY not set in environment',
        helpUrl: 'https://platform.openai.com/settings/organization/admin-keys',
      });
    }

    // Current month: from day 1 (UTC) until now
    const now = new Date();
    const startOfMonth = Math.floor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime() / 1000);
    const endTime = Math.floor(now.getTime() / 1000);

    // Last 30 days for trends
    const last30 = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

    // Fetch costs (USD)
    const costsRes = await fetch(
      `https://api.openai.com/v1/organization/costs?start_time=${startOfMonth}&end_time=${endTime}&bucket_width=1d&limit=31`,
      { headers: { Authorization: `Bearer ${adminKey}` } }
    );

    if (!costsRes.ok) {
      const errText = await costsRes.text();
      return NextResponse.json({
        success: false,
        configured: true,
        error: `OpenAI API error (${costsRes.status}): ${errText.slice(0, 200)}`,
      });
    }

    const costsData = await costsRes.json();

    // Sum up monthly cost (NaN-safe)
    const safeNum = (v: any) => {
      const n = Number(v);
      return isFinite(n) ? n : 0;
    };
    let monthlyCostUsd = 0;
    const dailyCosts: { date: string; amount: number }[] = [];
    for (const bucket of costsData.data || []) {
      let bucketTotal = 0;
      for (const result of bucket.results || []) {
        bucketTotal += safeNum(result.amount?.value);
      }
      monthlyCostUsd += bucketTotal;
      dailyCosts.push({
        date: new Date(safeNum(bucket.start_time) * 1000).toISOString().split('T')[0],
        amount: bucketTotal,
      });
    }
    monthlyCostUsd = safeNum(monthlyCostUsd);

    // Fetch token usage breakdown for last 30 days
    const usageRes = await fetch(
      `https://api.openai.com/v1/organization/usage/completions?start_time=${last30}&end_time=${endTime}&group_by=model&limit=180`,
      { headers: { Authorization: `Bearer ${adminKey}` } }
    );

    let modelBreakdown: { model: string; inputTokens: number; outputTokens: number }[] = [];
    if (usageRes.ok) {
      const usageData = await usageRes.json();
      const byModel = new Map<string, { input: number; output: number }>();
      for (const bucket of usageData.data || []) {
        for (const result of bucket.results || []) {
          const model = result.model || 'unknown';
          const entry = byModel.get(model) || { input: 0, output: 0 };
          entry.input += result.input_tokens || 0;
          entry.output += result.output_tokens || 0;
          byModel.set(model, entry);
        }
      }
      modelBreakdown = Array.from(byModel.entries()).map(([model, v]) => ({
        model,
        inputTokens: v.input,
        outputTokens: v.output,
      })).sort((a, b) => (b.inputTokens + b.outputTokens) - (a.inputTokens + a.outputTokens));
    }

    // Try to fetch billing subscription (hard_limit / budget) + credit grants
    let hardLimitUsd: number | null = null;
    let softLimitUsd: number | null = null;
    let creditBalanceUsd: number | null = null;
    let creditGrantedUsd: number | null = null;

    // Subscription / hard limit (legacy dashboard endpoint)
    try {
      const billingRes = await fetch('https://api.openai.com/v1/dashboard/billing/subscription', {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (billingRes.ok) {
        const billingData = await billingRes.json();
        if (typeof billingData.hard_limit_usd === 'number') {
          hardLimitUsd = safeNum(billingData.hard_limit_usd);
        }
        if (typeof billingData.soft_limit_usd === 'number') {
          softLimitUsd = safeNum(billingData.soft_limit_usd);
        }
      }
    } catch {
      // Ignore
    }

    // Credit grants / balance (for pay-as-you-go accounts)
    // Try legacy endpoint first - usually doesn't work with admin keys (needs session cookies)
    try {
      const creditsRes = await fetch('https://api.openai.com/v1/dashboard/billing/credit_grants', {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        if (typeof creditsData.total_available === 'number') {
          creditBalanceUsd = safeNum(creditsData.total_available);
        }
        if (typeof creditsData.total_granted === 'number') {
          creditGrantedUsd = safeNum(creditsData.total_granted);
        }
      }
    } catch {
      // Ignore
    }

    // ENV fallback - manual balance entry (since API doesn't expose this for pay-as-you-go)
    if (creditBalanceUsd === null && process.env.OPENAI_CREDIT_BALANCE_USD) {
      const envBalance = parseFloat(process.env.OPENAI_CREDIT_BALANCE_USD);
      if (isFinite(envBalance)) creditBalanceUsd = envBalance;
    }

    return NextResponse.json({
      success: true,
      configured: true,
      monthlyCostUsd,
      currency: 'USD',
      period: {
        from: new Date(startOfMonth * 1000).toISOString(),
        to: new Date(endTime * 1000).toISOString(),
      },
      dailyCosts,
      modelBreakdown,
      hardLimitUsd,
      softLimitUsd,
      creditBalanceUsd,
      creditGrantedUsd,
    });
  } catch (error: any) {
    console.error('OpenAI costs error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch OpenAI costs',
    }, { status: 500 });
  }
}
