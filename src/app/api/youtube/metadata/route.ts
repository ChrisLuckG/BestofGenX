import { NextRequest, NextResponse } from 'next/server';

// Detect language from text (simple heuristic)
function detectLanguage(text: string): 'de' | 'en' {
  const germanWords = ['und', 'der', 'die', 'das', 'ist', 'ein', 'eine', 'für', 'mit', 'auf', 'nicht', 'auch', 'sich', 'von', 'zu', 'den', 'dem', 'als', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach', 'wird', 'bei', 'einer', 'um', 'am', 'sind', 'noch', 'wie', 'einem', 'über', 'einen', 'so', 'zum', 'kann', 'war', 'haben', 'nur', 'oder', 'aber', 'vor', 'zur', 'bis', 'mehr', 'durch', 'man', 'sein', 'wurde', 'sei', 'schon', 'wenn', 'dieser', 'jetzt', 'muss', 'ich', 'ihr', 'können', 'diese', 'uns', 'gegen', 'alle', 'wir', 'fälle', 'colt', 'folge', 'teil', 'staffel'];
  
  const lowerText = text.toLowerCase();
  let germanCount = 0;
  
  for (const word of germanWords) {
    if (lowerText.includes(word)) {
      germanCount++;
    }
  }
  
  // Also check for German special characters
  if (/[äöüß]/i.test(text)) {
    germanCount += 3;
  }
  
  return germanCount >= 2 ? 'de' : 'en';
}

// Parse ISO 8601 duration to readable format
function parseDuration(isoDuration: string): string {
  if (!isoDuration) return '';
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  
  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Fetch YouTube video metadata
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    
    if (!videoId) {
      return NextResponse.json({ success: false, error: 'Missing videoId' }, { status: 400 });
    }

    // Try YouTube Data API first (if key exists)
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (apiKey) {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${apiKey}`;
      const apiRes = await fetch(apiUrl);
      
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.items && apiData.items.length > 0) {
          const item = apiData.items[0];
          const snippet = item.snippet;
          const contentDetails = item.contentDetails;
          
          const title = snippet.title || '';
          const language = detectLanguage(title + ' ' + (snippet.description || ''));
          
          return NextResponse.json({
            success: true,
            metadata: {
              title,
              description: snippet.description || '',
              thumbnail: snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              author: snippet.channelTitle || '',
              duration: parseDuration(contentDetails.duration || ''),
              language,
            },
          });
        }
      }
    }
    
    // Fallback: oEmbed (limited data)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);
    
    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }
    
    const data = await res.json();
    const title = data.title || '';
    const language = detectLanguage(title);
    
    return NextResponse.json({
      success: true,
      metadata: {
        title,
        description: '', // oEmbed doesn't provide this
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        author: data.author_name || '',
        duration: '', // oEmbed doesn't provide this
        language,
      },
    });
  } catch (error) {
    console.error('YouTube metadata error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch metadata' }, { status: 500 });
  }
}
