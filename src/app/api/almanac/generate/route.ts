import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { join } from "path";
import dbConnect from "@/lib/mongoose";
import { Person, AlmanacItem } from "@/models/Almanac";

// Load the system prompt - ALL instructions are there!
const systemPromptPath = join(process.cwd(), "src/prompts/system-prompt.txt");
const systemPrompt = readFileSync(systemPromptPath, "utf-8");

const VALID_CATEGORIES = ['people', 'games', 'movies', 'bands', 'albums', 'tvseries', 'food', 'cars', 'fashion', 'gadgets', 'toys', 'slang'];

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    await dbConnect();
    const openai = new OpenAI({ apiKey });

    const { category, skipDuplicateCheck, hint, count } = await request.json();
    
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: "Invalid category" }, { status: 400 });
    }
    
    const forceCreate = skipDuplicateCheck === true;
    const generateCount = Math.min(Math.max(parseInt(count) || 10, 1), 30);

    console.log(`[Almanac] Generating 10 ${category} entries...`);

    // Get existing names to avoid duplicates
    let existingNames: string[] = [];
    if (category === 'people') {
      const existing = await Person.find({}, { firstname: 1, lastname: 1 }).limit(100);
      existingNames = existing.map(p => `${p.firstname} ${p.lastname}`);
    } else {
      const existing = await AlmanacItem.find({ category }, { 'data.title': 1, 'data.name': 1 }).limit(100);
      existingNames = existing.map(i => i.data?.title || i.data?.name || '').filter(Boolean);
    }
    
    const avoidList = existingNames.length > 0 
      ? `\n\nIMPORTANT: Do NOT include these (already in database): ${existingNames.slice(0, 30).join(', ')}. Generate DIFFERENT entries!`
      : '';

    // Minimal user message - all instructions are in system prompt!
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Generate ${generateCount} ${category.toUpperCase()} entries for GenX Almanach.${hint ? ` Focus on: ${hint}.` : ''}${avoidList}`
        }
      ],
      temperature: 0.95,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ success: false, error: "No response from AI" }, { status: 500 });
    }

    // Parse JSON
    const cleanContent = content.replace(/```json|```/g, "").trim();
    let items: any[];
    try {
      items = JSON.parse(cleanContent);
    } catch (e) {
      console.error("JSON parse error:", content);
      return NextResponse.json({ success: false, error: "Invalid JSON response" }, { status: 500 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: "Empty response" }, { status: 500 });
    }

    // Helper: Search Wikimedia/Wikipedia for image
    const searchWikimediaImage = async (searchTerm: string): Promise<string | null> => {
      try {
        // Method 1: Wikimedia Commons MediaSearch
        const searchQuery = encodeURIComponent(`filetype:bitmap ${searchTerm}`);
        const mediaSearchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${searchQuery}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=400&format=json&origin=*`;
        const searchRes = await fetch(mediaSearchUrl);
        const searchData = await searchRes.json();
        
        const pages = searchData.query?.pages || {};
        for (const pageId in pages) {
          const page = pages[pageId];
          const imageInfo = page.imageinfo?.[0];
          if (imageInfo && imageInfo.mime?.startsWith("image/") && !imageInfo.mime?.includes("svg")) {
            const w = imageInfo.width || 0;
            const h = imageInfo.height || 0;
            if (w >= 200 && h >= 200) {
              return imageInfo.thumburl || imageInfo.url;
            }
          }
        }
        
        // Method 2: Try Wikipedia directly
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(searchTerm)}&prop=pageimages&pithumbsize=400&format=json&origin=*`;
        const wikiRes = await fetch(wikiUrl);
        const wikiData = await wikiRes.json();
        
        const wikiPages = wikiData.query?.pages || {};
        for (const pageId in wikiPages) {
          const page = wikiPages[pageId];
          if (page.thumbnail?.source) {
            return page.thumbnail.source;
          }
        }
        
        return null;
      } catch (e) {
        console.error("Wikimedia search error:", e);
        return null;
      }
    };

    // Save to database
    let savedCount = 0;
    
    if (category === 'people') {
      for (const item of items) {
        try {
          // Check if person already exists (skip if forceCreate)
          if (!forceCreate) {
            const exists = await Person.findOne({ 
              firstname: item.firstname, 
              lastname: item.lastname 
            });
            if (exists) {
              console.log(`[Almanac] Skipping duplicate: ${item.firstname} ${item.lastname}`);
              continue;
            }
          }
          
          // Try to get Wikimedia image
          const imageUrl = await searchWikimediaImage(`${item.firstname} ${item.lastname}`);
          if (imageUrl) {
            item.image = imageUrl;
            console.log(`[Almanac] Found image for ${item.firstname} ${item.lastname}`);
          }
          await Person.create(item);
          savedCount++;
        } catch (e) {
          console.error("Save person error:", e);
        }
      }
    } else {
      // Get current max rank
      const maxRankItem = await AlmanacItem.findOne({ category }).sort({ rank: -1 });
      let nextRank = (maxRankItem?.rank || 0) + 1;
      
      for (const item of items) {
        try {
          // Check if item already exists (by title/name) - skip if forceCreate
          const nameKey = item.title || item.name || item.term || item.model;
          
          if (!forceCreate) {
            const exists = await AlmanacItem.findOne({ 
              category,
              $or: [
                { 'data.title': nameKey },
                { 'data.name': nameKey },
                { 'data.term': nameKey },
                { 'data.model': nameKey },
              ]
            });
            if (exists) {
              console.log(`[Almanac] Skipping duplicate: ${nameKey}`);
              continue;
            }
          }
          
          // Try to get Wikimedia image for items too
          const imageUrl = await searchWikimediaImage(nameKey);
          
          await AlmanacItem.create({
            category,
            rank: nextRank++,
            image: imageUrl || undefined,
            data: item,
          });
          savedCount++;
        } catch (e) {
          console.error("Save item error:", e);
        }
      }
    }

    console.log(`[Almanac] Saved ${savedCount}/${items.length} new ${category} entries`);

    return NextResponse.json({ 
      success: true, 
      generated: items.length,
      saved: savedCount,
      message: `${savedCount} neue Einträge gespeichert (${items.length - savedCount} bereits vorhanden)`
    });

  } catch (error: any) {
    console.error("Almanac generate error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
