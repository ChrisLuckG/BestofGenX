import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const day   = parseInt(searchParams.get('day')   || String(new Date().getDate()));

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const results: Record<string, any> = { month, day };

  // Births
  try {
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/${mm}/${dd}`,
      { headers: { 'User-Agent': 'BOGX-Test/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    results.births_status = r.status;
    if (r.ok) {
      const data = await r.json();
      results.births_total = (data.births || []).length;
      results.births_genx = (data.births || [])
        .filter((b: any) => b.year >= 1965 && b.year <= 1980)
        .map((b: any) => `${b.text} (${dd}.${mm}.${b.year})`);
    }
  } catch (e: any) {
    results.births_error = e.message;
  }

  // Deaths
  try {
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/deaths/${mm}/${dd}`,
      { headers: { 'User-Agent': 'BOGX-Test/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    results.deaths_status = r.status;
    if (r.ok) {
      const data = await r.json();
      results.deaths_genx = (data.deaths || [])
        .filter((d: any) => d.year >= 1990)
        .slice(0, 15)
        .map((d: any) => `${d.text} (died ${d.year})`);
    }
  } catch (e: any) {
    results.deaths_error = e.message;
  }

  return NextResponse.json(results, { status: 200 });
}
