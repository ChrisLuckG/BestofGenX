import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';

// POST - Remove personBirthday from non-GenX articles (born outside 1965-1980)
export async function POST() {
  try {
    await dbConnect();
    
    // Find all articles with personBirthday
    const articles = await Article.find({
      personBirthday: { $exists: true, $ne: null, $gt: '' }
    }).lean();
    
    let cleaned = 0;
    const results: { title: string; year: number; action: string }[] = [];
    
    for (const article of articles) {
      const birthday = article.personBirthday;
      if (!birthday) continue;
      
      // Extract year from DD.MM.YYYY
      const parts = birthday.split('.');
      if (parts.length !== 3) continue;
      
      const year = parseInt(parts[2], 10);
      if (isNaN(year)) continue;
      
      // Check if NOT GenX (outside 1965-1980) or broken format
      const isBroken = birthday.includes('undefined') || birthday.includes('null');
      if (year < 1965 || year > 1980 || isBroken) {
        // Clear the personBirthday field
        await Article.findByIdAndUpdate(article._id, {
          $unset: { personBirthday: 1 }
        });
        
        results.push({ title: article.title, year, action: isBroken ? 'cleared broken format' : 'cleared personBirthday' });
        cleaned++;
      }
    }
    
    return NextResponse.json({
      success: true,
      totalChecked: articles.length,
      cleaned,
      results
    });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET - Preview non-GenX articles
export async function GET() {
  try {
    await dbConnect();
    
    const articles = await Article.find({
      personBirthday: { $exists: true, $ne: null, $gt: '' }
    }).select('title personBirthday personName').lean();
    
    const nonGenX: { title: string; year: number; personName?: string }[] = [];
    
    for (const article of articles) {
      const birthday = article.personBirthday;
      if (!birthday) continue;
      
      const parts = birthday.split('.');
      if (parts.length !== 3) continue;
      
      const year = parseInt(parts[2], 10);
      if (isNaN(year)) continue;
      
      if (year < 1965 || year > 1980) {
        nonGenX.push({ title: article.title, year, personName: article.personName });
      }
    }
    
    return NextResponse.json({
      success: true,
      nonGenXCount: nonGenX.length,
      nonGenXArticles: nonGenX
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
