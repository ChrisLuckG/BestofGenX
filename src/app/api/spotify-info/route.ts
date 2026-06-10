import { NextRequest, NextResponse } from 'next/server';

// Fetch track info from Spotify oEmbed API (server-side to avoid CORS)
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  console.log('[spotify-info] Received URL:', url);
  
  if (!url) {
    return NextResponse.json({ success: false, error: 'No URL provided' }, { status: 400 });
  }

  // Support various Spotify URL formats (track, intl-de/track, etc.)
  if (!url.includes('spotify.com') || !url.includes('track')) {
    console.log('[spotify-info] Invalid URL format');
    return NextResponse.json({ success: false, error: 'Invalid Spotify URL' }, { status: 400 });
  }

  // Extract track ID from various URL formats
  // Handles: /track/ID, /intl-de/track/ID, etc.
  // Also handle query params like ?si=xxx
  const trackIdMatch = url.match(/track\/([a-zA-Z0-9]+)/);
  const trackId = trackIdMatch?.[1];
  
  console.log('[spotify-info] Extracted track ID:', trackId);
  
  if (!trackId) {
    return NextResponse.json({ success: false, error: 'Could not extract track ID' }, { status: 400 });
  }

  // Normalize URL to standard format (without query params)
  const normalizedUrl = `https://open.spotify.com/track/${trackId}`;

  try {
    // Method 1: Try oEmbed API first (most reliable)
    const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(normalizedUrl)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    // Try the embed page which has __NEXT_DATA__ with full track info
    try {
      const embedRes = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html',
        },
      });
      
      if (embedRes.ok) {
        const html = await embedRes.text();
        console.log('[spotify-info] Got embed page, length:', html.length);
        
        // Look for __NEXT_DATA__ JSON which contains full track info
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
        if (nextDataMatch) {
          try {
            const pageData = JSON.parse(nextDataMatch[1]);
            const entity = pageData?.props?.pageProps?.state?.data?.entity;
            console.log('[spotify-info] Found entity:', entity?.name, entity?.artists);
            
            if (entity?.name && entity?.artists && entity.artists.length > 0) {
              const artistNames = entity.artists.map((a: {name: string}) => a.name).join(', ');
              console.log('[spotify-info] SUCCESS:', entity.name, '-', artistNames);
              return NextResponse.json({
                success: true,
                song: entity.name,
                band: artistNames,
              });
            }
          } catch (e) {
            console.error('[spotify-info] JSON parse error:', e);
          }
        }
      }
    } catch (e) {
      console.error('[spotify-info] Embed page fetch error:', e);
    }
    
    // Fallback: Try oEmbed - this always works
    console.log('[spotify-info] Trying oEmbed fallback');
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      console.log('[spotify-info] oEmbed data:', JSON.stringify(oembedData));
      
      // oEmbed returns: title (song name), and we can extract artist from the iframe HTML
      // The HTML contains: title="Song · Artist"
      const iframeHtml = oembedData.html || '';
      const iframeTitleMatch = iframeHtml.match(/title="([^"]+)"/);
      
      if (iframeTitleMatch) {
        const iframeTitle = iframeTitleMatch[1];
        console.log('[spotify-info] iframe title:', iframeTitle);
        
        // Format is usually "Song · Artist" or just "Song"
        if (iframeTitle.includes(' · ')) {
          const parts = iframeTitle.split(' · ');
          return NextResponse.json({
            success: true,
            song: parts[0].trim(),
            band: parts[1].trim(),
          });
        }
      }
      
      // Last resort: just return the title
      if (oembedData.title) {
        return NextResponse.json({
          success: true,
          song: oembedData.title,
          band: '',
        });
      }
    }

    return NextResponse.json({ success: false, error: 'Could not parse track info' });
  } catch (error) {
    console.error('spotify-info error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch' }, { status: 500 });
  }
}
