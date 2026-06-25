import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const skip = parseInt(searchParams.get('skip') || '0');
  
  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }
  
  try {
    // Scrape Tenor search page directly - no API key needed
    const searchUrl = `https://tenor.com/search/${encodeURIComponent(query)}-gifs`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      }
    });
    
    const html = await response.text();
    
    // Find GIF URLs in the HTML - Tenor uses media.tenor.com for actual GIFs
    // Look for patterns like https://media.tenor.com/xxxxx/xxxxx.gif
    const gifPattern = /https:\/\/media\.tenor\.com\/[^"'\s]+\.gif/g;
    const matches = html.match(gifPattern);
    
    if (matches && matches.length > 0) {
      // Filter for actual GIF files (not tiny thumbnails)
      // Prefer larger GIFs, remove duplicates
      const filtered = matches.filter(url => 
        !url.includes('nano') && 
        !url.includes('tiny') &&
        url.endsWith('.gif')
      );
      const validGifs = Array.from(new Set(filtered));
      
      // Use skip parameter to get different GIF each time
      const index = skip % Math.max(validGifs.length, 1);
      const gifUrl = validGifs[index] || validGifs[0] || matches[0];
      
      // Return both single url (for old code) and results array (for ImagePickerModal)
      return NextResponse.json({ 
        success: true, 
        url: gifUrl,
        results: validGifs.slice(0, 20) // Return up to 20 GIFs for the picker
      });
    }
    
    // Fallback: try to find any media.tenor.com URL
    const mediaPattern = /https:\/\/media\.tenor\.com\/[^"'\s]+/g;
    const mediaMatches = html.match(mediaPattern);
    
    if (mediaMatches && mediaMatches.length > 0) {
      const uniqueMedia = Array.from(new Set(mediaMatches));
      return NextResponse.json({ 
        success: true, 
        url: uniqueMedia[0],
        results: uniqueMedia.slice(0, 20)
      });
    }
    
    return NextResponse.json({ success: false, error: 'No GIF found' });
  } catch (error) {
    console.error('Tenor search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
