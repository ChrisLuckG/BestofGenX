import { NextRequest, NextResponse } from 'next/server';

// Fetch people who died ON THIS DAY from Wikipedia
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/deaths/${mm}/${dd}`,
      { 
        headers: { 'User-Agent': 'BOGX-Editorial/1.0' },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Wikipedia API error' }, { status: 500 });
    }

    const data = await res.json();
    const deaths = data.deaths || [];

    // Filter for GenX-relevant deaths (died 1990+ so audience knows them)
    // and try to identify GenX-born people (born 1965-1980)
    const relevantDeaths = deaths
      .filter((d: any) => d.year >= 1990)
      .slice(0, 30)
      .map((d: any) => {
        const name = d.text || '';
        const deathYear = d.year;
        const description = d.pages?.[0]?.description || '';
        
        // Try to extract birth year from description or calculate from age
        let birthYear: number | null = null;
        const birthMatch = description.match(/born\s+(\d{4})/i) || description.match(/\((\d{4})[-–]/);
        if (birthMatch) {
          birthYear = parseInt(birthMatch[1]);
        }
        
        // Check if GenX (born 1965-1980)
        const isGenX = birthYear ? (birthYear >= 1965 && birthYear <= 1980) : false;

        return {
          name: name.split(',')[0].trim(), // Remove profession suffix
          fullName: name,
          birthYear,
          deathYear,
          deathDate: `${dd}.${mm}.${deathYear}`,
          description,
          isGenX,
          formatted: birthYear 
            ? `${name.split(',')[0].trim()} (b. ${birthYear} † ${deathYear})`
            : `${name.split(',')[0].trim()} († ${deathYear})`,
        };
      });

    // Prioritize GenX deaths
    const genxDeaths = relevantDeaths.filter((d: any) => d.isGenX);
    const otherDeaths = relevantDeaths.filter((d: any) => !d.isGenX);

    return NextResponse.json({
      success: true,
      date: `${dd}.${mm}`,
      genxDeaths,
      otherDeaths: otherDeaths.slice(0, 10),
      total: relevantDeaths.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
