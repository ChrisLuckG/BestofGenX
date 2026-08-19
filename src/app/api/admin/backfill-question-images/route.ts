import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Question from '@/models/Question';

/**
 * Backfill images for questions that don't have one
 * Uses multiple image APIs
 */

// Unsplash API (free, high quality)
async function searchUnsplash(searchTerm: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  try {
    const params = new URLSearchParams({
      query: searchTerm,
      per_page: '1',
      orientation: 'squarish',
    });

    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${accessKey}` }
    });
    const data = await res.json();

    if (data.results?.[0]?.urls?.small) {
      return data.results[0].urls.small;
    }
    return null;
  } catch (error) {
    console.error('Unsplash error:', error);
    return null;
  }
}

// Pexels API (free, good quality)
async function searchPexels(searchTerm: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      query: searchTerm,
      per_page: '1',
    });

    const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey }
    });
    const data = await res.json();

    if (data.photos?.[0]?.src?.medium) {
      return data.photos[0].src.medium;
    }
    return null;
  } catch (error) {
    console.error('Pexels error:', error);
    return null;
  }
}

// Theme-based fallback images (Unsplash direct links)
const THEME_FALLBACKS: Record<string, string[]> = {
  'MUSIC': [
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400',
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400',
  ],
  'SPORTS': [
    'https://images.unsplash.com/photo-1461896836934- voices?w=400',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400',
  ],
  'TV & MOVIES': [
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400',
    'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400',
  ],
  'GAMING': [
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400',
    'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=400',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400',
  ],
  'POLITIK': [
    'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400',
    'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=400',
  ],
};

function getThemeFallback(theme: string, index: number): string {
  const images = THEME_FALLBACKS[theme] || THEME_FALLBACKS['TV & MOVIES'];
  return images[index % images.length];
}

// Wikipedia image search
async function searchWikipedia(searchTerm: string): Promise<string | null> {
  try {
    // First search for the page
    const searchParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: searchTerm,
      srlimit: '1',
      origin: '*',
    });

    const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?${searchParams}`);
    const searchData = await searchRes.json();
    
    const pageTitle = searchData.query?.search?.[0]?.title;
    if (!pageTitle) return null;

    // Get page images
    const imageParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      titles: pageTitle,
      prop: 'pageimages',
      pithumbsize: '400',
      origin: '*',
    });

    const imageRes = await fetch(`https://en.wikipedia.org/w/api.php?${imageParams}`);
    const imageData = await imageRes.json();

    const pages = imageData.query?.pages;
    if (!pages) return null;

    for (const page of Object.values(pages) as any[]) {
      if (page.thumbnail?.source) {
        return page.thumbnail.source;
      }
    }

    return null;
  } catch (error) {
    console.error('Wikipedia error:', error);
    return null;
  }
}

function extractSearchTerm(question: Question): string {
  const q = question.question;
  
  // 1. Try to find quoted terms (movie/song titles)
  const quoted = q.match(/['"]([^'"]+)['"]/);
  if (quoted) return quoted[1];
  
  // 2. Extract person names (Who/Which actor/director/singer)
  const personMatch = q.match(/(?:Who|Which\s+(?:actor|director|singer|band|artist|player|athlete))[^?]*?(?:played|directed|sang|wrote|starred|won|is|was)\s+(?:in\s+)?['"]?([^?'"]+)/i);
  if (personMatch) {
    // Try to get the subject
    const subject = personMatch[1].trim().replace(/[?.,]$/, '');
    if (subject.length > 2 && subject.length < 50) return subject;
  }
  
  // 3. Extract specific nouns from question
  const whatMatch = q.match(/(?:What|Which)\s+(?:is|was|are|were)\s+(?:the\s+)?(?:name\s+of\s+)?(?:the\s+)?(.+?)(?:\?|$)/i);
  if (whatMatch) {
    const subject = whatMatch[1].trim().replace(/[?.,]$/, '').slice(0, 40);
    if (subject.length > 3) return subject;
  }
  
  // 4. Use topic but clean it up (remove "The Influence of", "The Impact of", etc.)
  if (question.topic) {
    let topic = question.topic;
    topic = topic.replace(/^The\s+(Influence|Impact|Rise|History|Evolution|Legacy)\s+of\s+/i, '');
    topic = topic.replace(/^The\s+/i, '');
    if (topic.length > 3) return topic;
  }
  
  // 5. Fallback: theme + key words from question
  const words = q.split(' ').filter(w => w.length > 4 && !['Which', 'What', 'Where', 'When', 'about', 'their'].includes(w));
  return `${question.theme} ${words.slice(0, 3).join(' ')}`;
}

interface Question {
  _id: string;
  question: string;
  theme: string;
  topic?: string;
  image?: string;
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { dryRun = true, limit = 50 } = await request.json();
    
    // Find questions without images
    const questionsWithoutImage = await Question.find({
      $or: [
        { image: { $exists: false } },
        { image: null },
        { image: '' }
      ]
    }).limit(limit).lean() as Question[];
    
    const results = {
      total: questionsWithoutImage.length,
      processed: 0,
      imagesFound: 0,
      failed: 0,
      samples: [] as { question: string; searchTerm: string; imageUrl: string | null }[],
    };
    
    for (const q of questionsWithoutImage) {
      const searchTerm = extractSearchTerm(q);
      
      // Try multiple sources in order
      let imageUrl: string | null = null;
      
      // 1. Wikipedia (best for specific topics)
      imageUrl = await searchWikipedia(searchTerm);
      
      // 2. Unsplash (high quality stock photos)
      if (!imageUrl) {
        imageUrl = await searchUnsplash(searchTerm);
      }
      
      // 3. Pexels (another stock photo source)
      if (!imageUrl) {
        imageUrl = await searchPexels(searchTerm);
      }
      
      // 4. Try simpler search term
      if (!imageUrl && searchTerm.split(' ').length > 3) {
        const simpler = searchTerm.split(' ').slice(0, 2).join(' ');
        imageUrl = await searchWikipedia(simpler);
        if (!imageUrl) imageUrl = await searchUnsplash(simpler);
      }
      
      // 5. Fallback to theme-based image
      if (!imageUrl) {
        imageUrl = getThemeFallback(q.theme, results.processed);
      }
      
      // Store sample
      if (results.samples.length < 10) {
        results.samples.push({
          question: q.question.slice(0, 60) + '...',
          searchTerm,
          imageUrl,
        });
      }
      
      if (imageUrl) {
        if (!dryRun) {
          await Question.updateOne(
            { _id: q._id },
            { $set: { image: imageUrl } }
          );
        }
        results.imagesFound++;
      } else {
        results.failed++;
      }
      
      results.processed++;
      
      // Rate limiting - don't hammer the APIs
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return NextResponse.json({
      success: true,
      dryRun,
      ...results,
    });
    
  } catch (error: any) {
    console.error('Backfill images error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await dbConnect();
    
    const total = await Question.countDocuments({});
    const withImage = await Question.countDocuments({ 
      image: { $exists: true, $nin: [null, ''] } 
    });
    const withoutImage = total - withImage;
    
    return NextResponse.json({
      success: true,
      total,
      withImage,
      withoutImage,
      percentComplete: total > 0 ? Math.round((withImage / total) * 100) : 0,
    });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
