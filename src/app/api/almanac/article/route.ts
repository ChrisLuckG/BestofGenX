import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { join } from "path";

// Load the ARTICLE-SPECIFIC prompt - separate from main system prompt!
const articlePromptPath = join(process.cwd(), "src/prompts/article-prompt.txt");
const articlePrompt = readFileSync(articlePromptPath, "utf-8");

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    const { person, options, isItem, itemCategory } = await request.json();

    const subjectName = `${person.firstname}${person.lastname ? ' ' + person.lastname : ''}`;
    console.log(`[Almanac] Generating article for ${subjectName} (${isItem ? itemCategory : 'person'})...`);

    // Minimal user message - all instructions are in system-prompt.txt
    const userMessage = isItem
      ? `Write an article about "${subjectName}" (${itemCategory}).
Details: ${person.knownfor || 'a GenX cultural icon'}.
Options: language=${options.language}, length=${options.length}, tone=${options.tone}
${options.topic ? `Focus: ${options.topic}` : ''}
${options.extra ? `Extra: ${options.extra}` : ''}`
      : `Write an article about ${subjectName}.
Person: ${person.profession}, born ${person.born || 'unknown'}, ${person.countryBorn || ''}, known for: ${person.knownfor || 'various works'}.
${person.died ? `Died: ${person.died}` : 'Still alive.'}
Options: language=${options.language}, length=${options.length}, tone=${options.tone}, timeframe=${options.timeframe || 'alltime'}
${options.topic ? `Focus: ${options.topic}` : ''}
${options.extra ? `Extra: ${options.extra}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: articlePrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return NextResponse.json({ success: false, error: "No response from AI" }, { status: 500 });
    }

    try {
      const data = JSON.parse(response);
      
      // Map AI category to valid Article category
      const CATEGORY_MAP: Record<string, string> = {
        'movies': 'movies-tv',
        'tv': 'movies-tv',
        'movies-tv': 'movies-tv',
        'music': 'music',
        'gaming': 'gaming',
        'sports': 'sports',
        'tech': 'tech',
        'culture': 'culture',
        'news': 'news',
        'lifestyle': 'lifestyle',
        'genx-icons': 'genx-icons',
        'icons': 'genx-icons',
        'people': 'genx-icons',
        'person': 'genx-icons',
        'rip': 'rip',
        'obituary': 'rip',
        'memorial': 'rip',
        'tribute': 'rip',
      };
      const mappedCategory = CATEGORY_MAP[data.category?.toLowerCase()] || 'genx-icons';
      
      return NextResponse.json({ 
        success: true, 
        title: data.title,
        subtitle: data.subtitle,
        article: data.content,
        content: data.content,
        tags: data.tags || [],
        category: mappedCategory,
      });
    } catch (e) {
      // Fallback: return raw text as content
      return NextResponse.json({ 
        success: true, 
        article: response,
        content: response,
      });
    }

  } catch (error: any) {
    console.error("Almanac article error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
