import { NextRequest, NextResponse } from 'next/server';

// Fetch today's GenX birthday list (1965-1980) from Wikipedia's dedicated /births/ endpoint
async function fetchBirthList(month: number, day: number): Promise<string[]> {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/births/${mm}/${dd}`,
      { headers: { 'User-Agent': 'BOGX-Editorial/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.births || [])
      .filter((b: any) => b.year >= 1965 && b.year <= 1980)
      .map((b: any) => `${(b.text || '').trim()} (${dd}.${mm}.${b.year})`);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { excludeTopics } = await request.json() as { excludeTopics?: string[] };

    const now = new Date();
    const birthList = await fetchBirthList(now.getMonth() + 1, now.getDate());

    if (!birthList.length) {
      return NextResponse.json({ success: false, error: 'No GenX birthdays found today' });
    }

    // Build a set of already-used last names for exclusion
    const usedLastNames = new Set(
      (excludeTopics || []).map(t => {
        const name = t.split('(')[0].trim().toLowerCase();
        return name.split(/[\s,]+/).filter(Boolean).pop() || '';
      }).filter(Boolean)
    );

    // Find candidates not already used
    const candidates = birthList.filter(entry => {
      const namePart = entry.split('(')[0].trim().toLowerCase();
      const lastName = namePart.split(/[\s,]+/).filter(Boolean)[1] || namePart.split(/[\s,]+/)[0] || '';
      // entry "Name, descriptor (dd.mm.yyyy)" → take the name before the comma
      const cleanName = entry.split(',')[0].split('(')[0].trim().toLowerCase();
      const cLast = cleanName.split(' ').filter(Boolean).pop() || '';
      return !usedLastNames.has(cLast) && !usedLastNames.has(lastName);
    });

    const pool = candidates.length > 0 ? candidates : birthList;
    // Pick a random one from the pool for variety
    const pick = pool[Math.floor(Math.random() * pool.length)];

    // Format: "Full Name (dd.mm.yyyy) — short descriptor"
    // Wikipedia text is often "Name, descriptor" — convert to "Name (date) — descriptor"
    const dateMatch = pick.match(/\(([\d.]+)\)/);
    const date = dateMatch ? dateMatch[1] : '';
    const beforeDate = pick.replace(/\s*\([\d.]+\)\s*$/, '');
    const [namePart, ...descParts] = beforeDate.split(',');
    const desc = descParts.join(',').trim();
    const topic = desc
      ? `${namePart.trim()} (${date}) — ${desc}`
      : `${namePart.trim()} (${date})`;

    return NextResponse.json({ success: true, topic, taskType: 'article', allCandidates: pool });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
