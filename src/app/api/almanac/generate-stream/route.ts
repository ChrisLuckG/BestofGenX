import { NextRequest } from "next/server";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { join } from "path";
import dbConnect from "@/lib/mongoose";
import { Person, AlmanacItem } from "@/models/Almanac";

const systemPromptPath = join(process.cwd(), "src/prompts/system-prompt.txt");
const systemPrompt = readFileSync(systemPromptPath, "utf-8");

const VALID_CATEGORIES = ['people', 'games', 'movies', 'bands', 'albums', 'tvseries', 'food', 'cars', 'fashion', 'gadgets', 'toys', 'slang'];

// Helper: Search Wikimedia/Wikipedia for image
async function searchWikimediaImage(searchTerm: string): Promise<string | null> {
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
    return null;
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          send({ type: 'error', message: 'OpenAI API key not configured' });
          controller.close();
          return;
        }

        await dbConnect();
        const openai = new OpenAI({ apiKey });
        const { category, skipDuplicateCheck } = await request.json();

        if (!category || !VALID_CATEGORIES.includes(category)) {
          send({ type: 'error', message: 'Invalid category' });
          controller.close();
          return;
        }

        const forceCreate = skipDuplicateCheck === true;
        send({ type: 'status', message: '🔍 Lade existierende Einträge...' });

        // Get existing names
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

        send({ type: 'status', message: '🤖 AI generiert 10 Einträge...' });

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate 10 ${category.toUpperCase()} entries for GenX Almanach.${avoidList}` }
          ],
          temperature: 0.95,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          send({ type: 'error', message: 'Keine Antwort von AI' });
          controller.close();
          return;
        }

        const cleanContent = content.replace(/```json|```/g, "").trim();
        let items: any[];
        try {
          items = JSON.parse(cleanContent);
        } catch (e) {
          send({ type: 'error', message: 'Ungültiges JSON von AI' });
          controller.close();
          return;
        }

        if (!Array.isArray(items) || items.length === 0) {
          send({ type: 'error', message: 'Leere Antwort' });
          controller.close();
          return;
        }

        send({ type: 'status', message: `✅ ${items.length} Einträge generiert. Speichere...` });

        let savedCount = 0;
        let skippedCount = 0;

        if (category === 'people') {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const name = `${item.firstname} ${item.lastname}`;
            
            send({ type: 'progress', current: i + 1, total: items.length, name, step: 'check' });

            // Check duplicate
            if (!forceCreate) {
              const exists = await Person.findOne({ firstname: item.firstname, lastname: item.lastname });
              if (exists) {
                send({ type: 'skip', name, reason: 'bereits vorhanden' });
                skippedCount++;
                continue;
              }
            }

            // Search image
            send({ type: 'progress', current: i + 1, total: items.length, name, step: 'image' });
            const imageUrl = await searchWikimediaImage(name);
            if (imageUrl) {
              item.image = imageUrl;
            }

            // Save
            send({ type: 'progress', current: i + 1, total: items.length, name, step: 'save' });
            await Person.create(item);
            savedCount++;
            
            send({ type: 'saved', name, image: imageUrl || null, index: savedCount });
          }
        } else {
          const maxRankItem = await AlmanacItem.findOne({ category }).sort({ rank: -1 });
          let nextRank = (maxRankItem?.rank || 0) + 1;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const nameKey = item.title || item.name || item.term || item.model || `Item ${i + 1}`;
            
            send({ type: 'progress', current: i + 1, total: items.length, name: nameKey, step: 'check' });

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
                send({ type: 'skip', name: nameKey, reason: 'bereits vorhanden' });
                skippedCount++;
                continue;
              }
            }

            send({ type: 'progress', current: i + 1, total: items.length, name: nameKey, step: 'image' });
            const imageUrl = await searchWikimediaImage(nameKey);

            send({ type: 'progress', current: i + 1, total: items.length, name: nameKey, step: 'save' });
            await AlmanacItem.create({
              category,
              rank: nextRank++,
              image: imageUrl || undefined,
              data: item,
            });
            savedCount++;
            
            send({ type: 'saved', name: nameKey, image: imageUrl || null, index: savedCount });
          }
        }

        send({ type: 'done', saved: savedCount, skipped: skippedCount, total: items.length });
        controller.close();

      } catch (error: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
