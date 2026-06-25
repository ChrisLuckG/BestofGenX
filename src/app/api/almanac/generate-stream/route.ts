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
        const { category, skipDuplicateCheck, profession, country, alive, targetCount: requestedCount } = await request.json();

        if (!category || !VALID_CATEGORIES.includes(category)) {
          send({ type: 'error', message: 'Invalid category' });
          controller.close();
          return;
        }

        const forceCreate = skipDuplicateCheck === true;
        
        // Build filter description for status message
        const filterParts = [];
        if (profession) filterParts.push(profession);
        if (country) filterParts.push(country);
        if (alive === 'deceased') filterParts.push('Verstorben');
        if (alive === 'alive') filterParts.push('Lebend');
        const filterText = filterParts.length > 0 ? ` (${filterParts.join(', ')})` : '';
        
        send({ type: 'status', message: '🔍 Lade existierende Einträge...' });

        // Get existing names
        let existingNames: string[] = [];
        if (category === 'people') {
          const existing = await Person.find({}, { firstname: 1, lastname: 1 }).limit(1000);
          existingNames = existing.map(p => `${p.firstname} ${p.lastname}`);
        } else {
          const existing = await AlmanacItem.find({ category }, { 'data.title': 1, 'data.name': 1 }).limit(1000);
          existingNames = existing.map(i => i.data?.title || i.data?.name || '').filter(Boolean);
        }

        const avoidList = existingNames.length > 0 
          ? `\n\nIMPORTANT: Do NOT include these (already in database): ${existingNames.slice(0, 200).join(', ')}. Generate DIFFERENT entries!`
          : '';

        // Build filter instructions for AI
        let filterInstructions = '';
        if (category === 'people') {
          // Get current month and day for birthday priority
          const now = new Date();
          const currentMonth = now.toLocaleString('en-US', { month: 'long' });
          const currentDay = now.getDate();
          
          // Birthday priority instruction - ALWAYS added for people
          const birthdayPriority = `\n\nBIRTHDAY PRIORITY: Today is ${currentMonth} ${currentDay}. PRIORITIZE people born in ${currentMonth}! At least 5 of the 10 entries should have birthdays in ${currentMonth}. The rest can be from any month.`;
          
          // Build filter parts
          const filterConditions = [];
          if (profession) filterConditions.push(`profession "${profession}"`);
          if (country) filterConditions.push(`from ${country}`);
          if (alive === 'deceased') filterConditions.push('who are DECEASED (died field must be set)');
          if (alive === 'alive') filterConditions.push('who are still ALIVE (died field must be null/empty)');
          
          // CRITICAL: Always remind about GenX birth years
          const genXReminder = '\n\nCRITICAL: ALL people MUST be born between 1960-1981 (Generation X)! NO Baby Boomers (before 1960), NO Millennials (after 1981). Double-check birth years!\nGenX artists were born in the 60s-70s and rose to fame in the late 80s/90s. Examples of the RIGHT era: Kurt Cobain (1967), Tupac (1971), Jay-Z (1969), Eminem (1972), Mariah Carey (1969), Trent Reznor (1969), Eddie Vedder (1964), Lenny Kravitz (1964). WRONG era (DO NOT generate): Madonna (1958), Prince (1958), Michael Jackson (1958) - they are Baby Boomers!';
          
          const diversityReminder = !country ? `\n\nCOUNTRY DIVERSITY: Do NOT generate only USA/UK people! Mix nationalities: include people from Japan, Germany, France, Brazil, Canada, Australia, Spain, Italy, Sweden, Mexico, etc. Max 3 people from USA, max 2 from UK.` : '';

          if (filterConditions.length > 0) {
            filterInstructions = `${birthdayPriority}${genXReminder}${diversityReminder}\n\nFILTER: Generate ONLY people ${filterConditions.join(' AND ')}! All entries MUST match these criteria.`;
          } else {
            filterInstructions = `${birthdayPriority}${genXReminder}${diversityReminder}`;
          }
        }

        // Generate more entries than needed to account for duplicates
        const targetCount = requestedCount || 10;
        const generateCount = forceCreate ? targetCount : Math.min(targetCount * 3, 60); // Generate extra to replace duplicates and birth year rejects
        
        send({ type: 'status', message: `🤖 AI generiert ${targetCount} Einträge${filterText} (${generateCount} Vorschläge als Buffer)...` });

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Generate ${generateCount} ${category.toUpperCase()} entries for GenX Almanach.${filterInstructions}${avoidList}${category === 'people' ? '\n\nREMINDER: Every single person MUST have born year between 1960 and 1981. Do NOT include anyone born before 1960 or after 1981. This is non-negotiable.' : ''}` }
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

        const VALID_PROFESSIONS = ['Music', 'Actor', 'Sport', 'Politik', 'Art', 'Tech', 'Comedy', 'Model', 'Other'];
        const PROFESSION_MAP: Record<string, string> = {
          musician: 'Music', singer: 'Music', rapper: 'Music', guitarist: 'Music', drummer: 'Music', bassist: 'Music', composer: 'Music', dj: 'Music',
          actress: 'Actor', director: 'Actor', filmmaker: 'Actor',
          athlete: 'Sport', footballer: 'Sport', basketball: 'Sport', soccer: 'Sport', tennis: 'Sport', boxer: 'Sport', swimmer: 'Sport',
          politician: 'Politik', politics: 'Politik',
          artist: 'Art', painter: 'Art', sculptor: 'Art', photographer: 'Art',
          entrepreneur: 'Tech', programmer: 'Tech', engineer: 'Tech', scientist: 'Tech', inventor: 'Tech',
          comedian: 'Comedy', humorist: 'Comedy',
          supermodel: 'Model',
        };

        if (category === 'people') {
          for (let i = 0; i < items.length && savedCount < targetCount; i++) {
            const item = items[i];
            const name = `${item.firstname} ${item.lastname}`;
            
            // Validate birth year is Gen X
            const birthYear = item.born ? parseInt(item.born.substring(0, 4)) : 0;
            if (birthYear < 1960 || birthYear > 1981) {
              send({ type: 'skip', name, reason: `Geboren ${birthYear} - nicht Gen X (1960-1981)` });
              skippedCount++;
              continue;
            }

            // Normalize profession to valid enum value
            const rawProf = (item.profession || '').trim();
            if (!VALID_PROFESSIONS.includes(rawProf)) {
              const mapped = PROFESSION_MAP[rawProf.toLowerCase()];
              item.profession = mapped || 'Other';
            }
            
            send({ type: 'progress', current: savedCount + 1, total: targetCount, name, step: 'check' });

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
            send({ type: 'progress', current: savedCount + 1, total: targetCount, name, step: 'image' });
            const imageUrl = await searchWikimediaImage(name);
            if (imageUrl) {
              item.image = imageUrl;
            }

            // Save - individual try/catch so one bad entry doesn't kill the stream
            send({ type: 'progress', current: savedCount + 1, total: targetCount, name, step: 'save' });
            try {
              await Person.create(item);
              savedCount++;
              send({ type: 'saved', name, image: imageUrl || null, index: savedCount });
            } catch (saveErr: any) {
              send({ type: 'skip', name, reason: `Save error: ${saveErr.message}` });
              skippedCount++;
            }
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
