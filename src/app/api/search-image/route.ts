import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json({ success: false, error: "Topic is required" }, { status: 400 });
    }

    console.log("Searching Wikimedia Commons for:", topic);

    // Search Wikimedia Commons API - more results for variety
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srnamespace=6&srlimit=20&format=json&origin=*`;
    
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.query?.search?.length) {
      return NextResponse.json({ success: false, error: "No images found" }, { status: 404 });
    }

    // Get image info for all results
    const titles = searchData.query.search
      .map((item: any) => item.title)
      .join("|");

    const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=800&iiurlheight=800&format=json&origin=*`;
    
    const imageRes = await fetch(imageInfoUrl);
    const imageData = await imageRes.json();

    const pages = imageData.query?.pages || {};
    const images: { title: string; url: string; thumbUrl: string; width: number; height: number }[] = [];

    for (const pageId in pages) {
      const page = pages[pageId];
      const imageInfo = page.imageinfo?.[0];
      
      // Skip SVGs, small images, and bad aspect ratios
      if (imageInfo && imageInfo.mime?.startsWith("image/") && !imageInfo.mime?.includes("svg")) {
        const w = imageInfo.width || 0;
        const h = imageInfo.height || 0;
        const aspectRatio = w / h;
        
        // Only include images that are reasonably square-ish (0.5 to 2.0 ratio) and big enough
        if (w >= 300 && h >= 300 && aspectRatio >= 0.5 && aspectRatio <= 2.0) {
          images.push({
            title: page.title.replace("File:", ""),
            url: imageInfo.url,
            thumbUrl: imageInfo.thumburl || imageInfo.url,
            width: w,
            height: h,
          });
        }
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ success: false, error: "No valid images found" }, { status: 404 });
    }

    // Pick a RANDOM image each time
    const randomIndex = Math.floor(Math.random() * images.length);
    const randomImage = images[randomIndex];
    
    console.log(`Found ${images.length} images, picked #${randomIndex + 1}: ${randomImage.title}`);

    return NextResponse.json({
      success: true,
      image: randomImage,
      allImages: images,
      totalFound: images.length,
    });

  } catch (error: any) {
    console.error("Wikimedia search error:", error);
    return NextResponse.json({ success: false, error: error.message || "Search failed" }, { status: 500 });
  }
}
