import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Card from "@/models/Card";
import OpenAI from "openai";

// Mapping for common topics to subCategories
const SUBCATEGORY_MAPPINGS: Record<string, Record<string, string>> = {
  SPORTS: {
    // Basketball
    'michael jordan': 'Basketball', 'lebron james': 'Basketball', 'kobe bryant': 'Basketball',
    'shaquille': 'Basketball', 'magic johnson': 'Basketball', 'larry bird': 'Basketball',
    'nba': 'Basketball', 'bulls': 'Basketball', 'lakers': 'Basketball', 'celtics': 'Basketball',
    'basketball': 'Basketball', 'slam dunk': 'Basketball', 'three-pointer': 'Basketball',
    // Soccer (European Football)
    'maradona': 'Soccer', 'pelé': 'Soccer', 'pele': 'Soccer', 'beckham': 'Soccer',
    'ronaldo': 'Soccer', 'messi': 'Soccer', 'zidane': 'Soccer', 'world cup': 'Soccer',
    'fifa': 'Soccer', 'premier league': 'Soccer', 'champions league': 'Soccer',
    'manchester': 'Soccer', 'barcelona': 'Soccer', 'real madrid': 'Soccer',
    'soccer': 'Soccer', 'goalkeeper': 'Soccer', 'penalty kick': 'Soccer',
    // American Football (NFL)
    'super bowl': 'American Football', 'nfl': 'American Football', 'quarterback': 'American Football',
    'joe montana': 'American Football', 'tom brady': 'American Football', 'touchdown': 'American Football',
    'hail mary': 'American Football', 'cowboys': 'American Football', 'patriots': 'American Football',
    // Rugby
    'rugby': 'Rugby', 'all blacks': 'Rugby', 'six nations': 'Rugby', 'rugby world cup': 'Rugby',
    'jonah lomu': 'Rugby', 'scrum': 'Rugby', 'try': 'Rugby',
    // Table Tennis
    'table tennis': 'Table Tennis', 'ping pong': 'Table Tennis', 'jan-ove waldner': 'Table Tennis',
    // Cycling
    'cycling': 'Cycling', 'tour de france': 'Cycling', 'lance armstrong': 'Cycling', 
    'miguel indurain': 'Cycling', 'giro': 'Cycling', 'vuelta': 'Cycling',
    // Swimming
    'swimming': 'Swimming', 'michael phelps': 'Swimming', 'ian thorpe': 'Swimming',
    'mark spitz': 'Swimming', 'butterfly stroke': 'Swimming', 'backstroke': 'Swimming',
    // Tennis
    'agassi': 'Tennis', 'sampras': 'Tennis', 'wimbledon': 'Tennis', 'us open': 'Tennis',
    'tennis': 'Tennis', 'grand slam': 'Tennis', 'federer': 'Tennis', 'nadal': 'Tennis',
    // Boxing
    'tyson': 'Boxing', 'ali': 'Boxing', 'holyfield': 'Boxing', 'boxing': 'Boxing',
    'heavyweight': 'Boxing', 'knockout': 'Boxing',
    // Golf
    'tiger woods': 'Golf', 'golf': 'Golf', 'masters': 'Golf', 'pga': 'Golf',
    // Hockey
    'gretzky': 'Hockey', 'nhl': 'Hockey', 'hockey': 'Hockey', 'stanley cup': 'Hockey',
    // Baseball
    'baseball': 'Baseball', 'mlb': 'Baseball', 'home run': 'Baseball', 'world series': 'Baseball',
    // Wrestling
    'wrestling': 'Wrestling', 'wwe': 'Wrestling', 'wwf': 'Wrestling', 'hulk hogan': 'Wrestling',
    // Olympics
    'olympics': 'Olympics', 'olympic': 'Olympics', 'gold medal': 'Olympics',
    // F1/Racing
    'formula 1': 'Racing', 'f1': 'Racing', 'schumacher': 'Racing', 'senna': 'Racing',
    // X-Games / Extreme Sports
    'skateboard': 'X-Games', 'skate': 'X-Games', 'tony hawk': 'X-Games', 'halfpipe': 'X-Games',
    'surfing': 'X-Games', 'surf': 'X-Games', 'kelly slater': 'X-Games',
    'bmx': 'X-Games', 'motocross': 'X-Games', 'snowboard': 'X-Games', 'x-games': 'X-Games',
    'extreme': 'X-Games', 'freestyle': 'X-Games',
  },
  MUSIC: {
    'rock': 'Rock', 'nirvana': 'Rock', 'pearl jam': 'Rock', 'foo fighters': 'Rock',
    'grunge': 'Rock', 'metallica': 'Rock', 'guns n roses': 'Rock', 'ac/dc': 'Rock',
    'pop': 'Pop', 'madonna': 'Pop', 'michael jackson': 'Pop', 'britney': 'Pop',
    'spice girls': 'Pop', 'backstreet': 'Pop', 'nsync': 'Pop', 'boy band': 'Pop',
    'hip hop': 'Hip Hop', 'rap': 'Hip Hop', 'eminem': 'Hip Hop', 'tupac': 'Hip Hop',
    'biggie': 'Hip Hop', 'dr. dre': 'Hip Hop', 'snoop': 'Hip Hop',
    'electronic': 'Electronic', 'techno': 'Electronic', 'daft punk': 'Electronic',
    'r&b': 'R&B', 'soul': 'R&B', 'whitney': 'R&B', 'mariah': 'R&B',
    'punk': 'Punk', 'green day': 'Punk', 'blink': 'Punk', 'ramones': 'Punk',
    'metal': 'Metal', 'heavy metal': 'Metal', 'iron maiden': 'Metal',
    'alternative': 'Alternative', 'radiohead': 'Alternative', 'oasis': 'Alternative',
  },
  MOVIES: {
    'action': 'Action', 'terminator': 'Action', 'die hard': 'Action', 'rambo': 'Action',
    'comedy': 'Comedy', 'jim carrey': 'Comedy', 'adam sandler': 'Comedy',
    'horror': 'Horror', 'scream': 'Horror', 'nightmare': 'Horror', 'friday the 13th': 'Horror',
    'sci-fi': 'Sci-Fi', 'matrix': 'Sci-Fi', 'alien': 'Sci-Fi', 'star wars': 'Sci-Fi',
    'drama': 'Drama', 'forrest gump': 'Drama', 'shawshank': 'Drama',
    'thriller': 'Thriller', 'silence of the lambs': 'Thriller', 'seven': 'Thriller',
    'animation': 'Animation', 'disney': 'Animation', 'pixar': 'Animation', 'lion king': 'Animation',
    'romance': 'Romance', 'titanic': 'Romance', 'pretty woman': 'Romance',
  },
  'TV SHOWS': {
    // Sitcom
    'sitcom': 'Sitcom', 'friends': 'Sitcom', 'seinfeld': 'Sitcom', 'frasier': 'Sitcom',
    'cheers': 'Sitcom', 'married with children': 'Sitcom', 'fresh prince': 'Sitcom',
    'full house': 'Sitcom', 'home improvement': 'Sitcom', 'roseanne': 'Sitcom',
    // Drama
    'drama': 'Drama', 'er': 'Drama', 'twin peaks': 'Drama', 'nypd blue': 'Drama',
    'beverly hills': 'Drama', 'melrose place': 'Drama', 'dawson': 'Drama',
    // Sci-Fi/Fantasy
    'x-files': 'Sci-Fi', 'star trek': 'Sci-Fi', 'babylon': 'Sci-Fi', 'sliders': 'Sci-Fi',
    'buffy': 'Sci-Fi', 'charmed': 'Sci-Fi', 'hercules': 'Sci-Fi', 'xena': 'Sci-Fi',
    // Animation
    'cartoon': 'Animation', 'simpsons': 'Animation', 'south park': 'Animation',
    'beavis': 'Animation', 'ren and stimpy': 'Animation', 'animaniacs': 'Animation',
    // Reality/Talk
    'reality': 'Reality', 'mtv': 'Reality', 'real world': 'Reality',
    'oprah': 'Talk Show', 'letterman': 'Talk Show', 'leno': 'Talk Show',
    // Crime
    'law and order': 'Crime', 'csi': 'Crime', 'nypd': 'Crime', 'homicide': 'Crime',
  },
  GAMING: {
    'nintendo': 'Nintendo', 'mario': 'Nintendo', 'zelda': 'Nintendo', 'pokemon': 'Nintendo',
    'playstation': 'PlayStation', 'sony': 'PlayStation', 'crash': 'PlayStation',
    'sega': 'Sega', 'sonic': 'Sega', 'dreamcast': 'Sega',
    'pc': 'PC Gaming', 'doom': 'PC Gaming', 'quake': 'PC Gaming', 'half-life': 'PC Gaming',
    'fighting': 'Fighting', 'street fighter': 'Fighting', 'mortal kombat': 'Fighting',
    'rpg': 'RPG', 'final fantasy': 'RPG', 'chrono': 'RPG',
    'shooter': 'Shooter', 'goldeneye': 'Shooter', 'fps': 'Shooter',
  },
};

function normalizeTheme(theme: string, topic: string, question: string): string {
  const rawTheme = (theme || '').toUpperCase().trim();
  const searchText = `${topic} ${question}`.toLowerCase();
  
  // Direct normalization
  if (rawTheme === 'FILM' || rawTheme === 'FILMS' || rawTheme === 'CINEMA') return 'MOVIES';
  
  // Check if theme is actually a topic - try to detect real theme from topic/question
  const validThemes = ['MUSIC', 'MOVIES', 'TV SHOWS', 'SPORTS', 'GAMING', 'FASHION', 'TECHNOLOGY', 'CELEBRITIES'];
  if (!validThemes.includes(rawTheme)) {
    // Try to find a theme in the topic
    const topicLower = (topic || '').toLowerCase();
    if (topicLower.includes('sports') || topicLower.includes('basketball') || topicLower.includes('soccer') || topicLower.includes('football')) return 'SPORTS';
    if (topicLower.includes('music') || topicLower.includes('song') || topicLower.includes('album') || topicLower.includes('band')) return 'MUSIC';
    if (topicLower.includes('movie') || topicLower.includes('film') || topicLower.includes('cinema')) return 'MOVIES';
    if (topicLower.includes('tv') || topicLower.includes('show') || topicLower.includes('sitcom') || topicLower.includes('series')) return 'TV SHOWS';
    if (topicLower.includes('game') || topicLower.includes('gaming') || topicLower.includes('nintendo') || topicLower.includes('playstation')) return 'GAMING';
    if (topicLower.includes('fashion') || topicLower.includes('style') || topicLower.includes('clothing') || topicLower.includes('shoes')) return 'FASHION';
    if (topicLower.includes('tech') || topicLower.includes('computer') || topicLower.includes('internet') || topicLower.includes('phone')) return 'TECHNOLOGY';
    if (topicLower.includes('celebr') || topicLower.includes('actor') || topicLower.includes('musician') || topicLower.includes('star')) return 'CELEBRITIES';
  }
  
  return rawTheme;
}

function getDefaultSubCategory(theme: string): string {
  const defaults: Record<string, string> = {
    'SPORTS': 'Olympics',
    'MUSIC': 'Pop',
    'MOVIES': 'Drama',
    'TV SHOWS': 'Drama',
    'GAMING': 'Nintendo',
    'FASHION': 'Vintage',
    'TECHNOLOGY': 'Computers',
    'CELEBRITIES': 'Actors',
  };
  return defaults[theme] || 'Other';
}

function detectSubCategory(theme: string, topic: string, question: string): string {
  const normalizedTheme = normalizeTheme(theme, topic, question);
  const searchText = `${topic} ${question}`.toLowerCase();
  const mappings = SUBCATEGORY_MAPPINGS[normalizedTheme] || {};
  
  for (const [keyword, subCat] of Object.entries(mappings)) {
    if (searchText.includes(keyword.toLowerCase())) {
      return subCat;
    }
  }
  
  // Fallback: return default for normalized theme
  return getDefaultSubCategory(normalizedTheme);
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const apiKey = process.env.OPENAI_API_KEY;
    const openai = apiKey ? new OpenAI({ apiKey }) : null;
    
    // Get all cards without subCategory
    const cards = await Card.find({ 
      $or: [
        { subCategory: { $exists: false } },
        { subCategory: '' },
        { subCategory: null }
      ]
    });
    
    console.log(`Found ${cards.length} cards without subCategory`);
    
    let updated = 0;
    const results: { topic: string; theme: string; subCategory: string }[] = [];
    
    // First pass: keyword matching + fallback defaults
    for (const card of cards) {
      const question = card.questions?.[0]?.question || '';
      const normalizedTheme = normalizeTheme(card.theme, card.topic, question);
      const subCategory = detectSubCategory(card.theme, card.topic, question);
      
      if (subCategory) {
        const update: any = { subCategory };
        // Fix invalid theme if needed
        if (normalizedTheme !== card.theme) {
          update.theme = normalizedTheme;
        }
        await Card.updateOne({ _id: card._id }, { $set: update });
        updated++;
        results.push({ topic: card.topic, theme: normalizedTheme, subCategory });
      }
    }
    
    // Second pass: use AI for remaining cards
    if (openai) {
      const remaining = await Card.find({ 
        $or: [
          { subCategory: { $exists: false } },
          { subCategory: '' },
          { subCategory: null }
        ]
      });
      
      if (remaining.length > 0) {
        const batchData = remaining.map(c => {
          const question = c.questions?.[0]?.question || '';
          const normalizedTheme = normalizeTheme(c.theme, c.topic, question);
          return {
            id: c._id.toString(),
            theme: normalizedTheme,
            topic: c.topic,
            question: question.substring(0, 100)
          };
        });
        
        // Valid subcategories per theme
        const VALID_SUBS: Record<string, string[]> = {
          'SPORTS': ['Basketball', 'Soccer', 'American Football', 'Rugby', 'Tennis', 'Table Tennis', 'Boxing', 'Golf', 'Hockey', 'Baseball', 'Wrestling', 'Olympics', 'Racing', 'Cycling', 'Swimming', 'X-Games'],
          'MUSIC': ['Rock', 'Pop', 'Hip Hop', 'R&B', 'Electronic', 'Metal', 'Punk', 'Alternative', 'Country', 'Soul', 'Grunge'],
          'MOVIES': ['Action', 'Comedy', 'Horror', 'Sci-Fi', 'Drama', 'Thriller', 'Animation', 'Romance'],
          'TV SHOWS': ['Sitcom', 'Drama', 'Sci-Fi', 'Animation', 'Reality', 'Talk Show', 'Crime'],
          'GAMING': ['Nintendo', 'PlayStation', 'Sega', 'PC Gaming', 'Fighting', 'RPG', 'Arcade', 'Sports'],
          'FASHION': ['Streetwear', 'Designer', 'Shoes', 'Accessories', 'Denim', 'Sportswear', 'Vintage'],
          'TECHNOLOGY': ['Computers', 'Internet', 'Gaming', 'Audio', 'Mobile', 'Software', 'Hardware'],
          'CELEBRITIES': ['Actors', 'Musicians', 'Athletes', 'TV Stars', 'Models', 'Directors'],
        };
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You categorize quiz questions into EXACTLY the subcategories provided. Use ONLY the exact values given. Return JSON only." },
            { role: "user", content: `For each item, pick ONE subCategory from the EXACT list for that theme. DO NOT invent new categories!

SPORTS: Basketball, Soccer, American Football, Rugby, Tennis, Table Tennis, Boxing, Golf, Hockey, Baseball, Wrestling, Olympics, Racing, Cycling, Swimming, X-Games
MUSIC: Rock, Pop, Hip Hop, R&B, Electronic, Metal, Punk, Alternative, Country, Soul, Grunge
MOVIES: Action, Comedy, Horror, Sci-Fi, Drama, Thriller, Animation, Romance
TV SHOWS: Sitcom, Drama, Sci-Fi, Animation, Reality, Talk Show, Crime
GAMING: Nintendo, PlayStation, Sega, PC Gaming, Fighting, RPG, Arcade, Sports
FASHION: Streetwear, Designer, Shoes, Accessories, Denim, Sportswear, Vintage
TECHNOLOGY: Computers, Internet, Gaming, Audio, Mobile, Software, Hardware
CELEBRITIES: Actors, Musicians, Athletes, TV Stars, Models, Directors

Items:
${JSON.stringify(batchData, null, 2)}

Return JSON: {"items": [{"id": "...", "subCategory": "..."}]}
IMPORTANT: subCategory MUST be from the exact list above!` }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });
        
        try {
          const aiResult = JSON.parse(completion.choices[0]?.message?.content || '{}');
          const items = aiResult.items || aiResult.results || aiResult;
          
          if (Array.isArray(items)) {
            for (const item of items) {
              if (item.id && item.subCategory) {
                const card = remaining.find(c => c._id.toString() === item.id);
                if (!card) continue;
                
                const normalizedTheme = normalizeTheme(card.theme, card.topic, card.questions?.[0]?.question || '');
                
                // Validate subCategory is in allowed list (only for themes that need it)
                const validList = VALID_SUBS[normalizedTheme];
                if (validList && !validList.includes(item.subCategory)) {
                  console.log(`Invalid subCategory "${item.subCategory}" for theme ${normalizedTheme}, skipping`);
                  continue;
                }
                // Skip themes that don't need subcategories
                if (!validList) {
                  continue;
                }
                
                const update: any = { subCategory: item.subCategory };
                if (normalizedTheme !== card.theme) {
                  update.theme = normalizedTheme;
                }
                await Card.updateOne({ _id: item.id }, { $set: update });
                updated++;
                results.push({ topic: card.topic, theme: normalizedTheme, subCategory: item.subCategory });
              }
            }
          }
        } catch (e) {
          console.error("AI parse error:", e);
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      total: cards.length,
      updated,
      results: results.slice(0, 50)
    });
    
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// GET to preview without updating
export async function GET() {
  try {
    await dbConnect();
    
    const cards = await Card.find({ 
      $or: [
        { subCategory: { $exists: false } },
        { subCategory: '' },
        { subCategory: null }
      ]
    }).limit(100);
    
    const preview = cards.map(card => {
      const question = card.questions?.[0]?.question || '';
      const subCategory = detectSubCategory(card.theme, card.topic, question);
      return {
        topic: card.topic,
        theme: card.theme,
        detectedSubCategory: subCategory || '(not detected)',
        question: question.substring(0, 50) + '...'
      };
    });
    
    return NextResponse.json({ 
      success: true, 
      total: cards.length,
      preview
    });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
