import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json({ success: false, error: "Topic is required" }, { status: 400 });
    }

    console.log("[ImageSearch] Searching for:", topic);

    const images: { title: string; url: string; thumbUrl: string; width: number; height: number }[] = [];

    // Method 1: Simple search in File namespace
    try {
      const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srnamespace=6&srlimit=30&format=json&origin=*`;
      
      console.log("[ImageSearch] Method 1 URL:", searchUrl);
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      console.log("[ImageSearch] Method 1 results:", searchData.query?.search?.length || 0);
      
      if (searchData.query?.search?.length) {
        const titles = searchData.query.search.map((item: any) => item.title).join("|");
        
        const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=800&format=json&origin=*`;
        const imageRes = await fetch(imageInfoUrl);
        const imageData = await imageRes.json();
        
        const pages = imageData.query?.pages || {};
        for (const pageId in pages) {
          const page = pages[pageId];
          const imageInfo = page.imageinfo?.[0];
          
          if (imageInfo && imageInfo.mime?.startsWith("image/") && !imageInfo.mime?.includes("svg")) {
            const w = imageInfo.width || 0;
            const h = imageInfo.height || 0;
            
            if (w >= 150 && h >= 150) {
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
      }
    } catch (e) {
      console.log("[ImageSearch] Method 1 failed:", e);
    }

    console.log("[ImageSearch] Method 1 found:", images.length, "images");

    // Method 2: Try Wikipedia directly for the person's image
    if (images.length === 0) {
      try {
        console.log("[ImageSearch] Trying Wikipedia fallback...");
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(topic)}&prop=pageimages&pithumbsize=800&format=json&origin=*`;
        const wikiRes = await fetch(wikiUrl);
        const wikiData = await wikiRes.json();
        console.log("[ImageSearch] Wikipedia response:", JSON.stringify(wikiData).slice(0, 200));
        
        const pages = wikiData.query?.pages || {};
        for (const pageId in pages) {
          const page = pages[pageId];
          if (page.thumbnail?.source) {
            images.push({
              title: page.title,
              url: page.thumbnail.source,
              thumbUrl: page.thumbnail.source,
              width: page.thumbnail.width || 400,
              height: page.thumbnail.height || 400,
            });
          }
        }
      } catch (e) {
        console.log("Wikipedia fallback also failed");
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ success: false, error: "No images found" }, { status: 404 });
    }

    // Remove duplicates by URL
    const uniqueImages = images.filter((img, index, self) => 
      index === self.findIndex(t => t.url === img.url)
    );

    // Pick a RANDOM image each time
    const randomIndex = Math.floor(Math.random() * uniqueImages.length);
    const randomImage = uniqueImages[randomIndex];
    
    console.log(`Found ${uniqueImages.length} images for "${topic}", picked #${randomIndex + 1}: ${randomImage.title}`);

    return NextResponse.json({
      success: true,
      image: randomImage,
      allImages: uniqueImages,
      totalFound: uniqueImages.length,
    });

  } catch (error: any) {
    console.error("Wikimedia search error:", error);
    return NextResponse.json({ success: false, error: error.message || "Search failed" }, { status: 500 });
  }
}
