import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Author style instructions
const STYLE_PROMPTS: Record<string, string> = {
  'informative': 'Write in a factual, objective, encyclopedia-style. Professional journalism tone.',
  'irvine-welsh': `YOU ARE IRVINE WELSH WRITING TRAINSPOTTING!
- USE Scottish dialect: "aye", "nae", "cannae", "wisnae", "ae" (of), "ken" (know), "oot" (out)
- USE swearing: "fuckin", "shite", "cunt", "bastard" - this is REQUIRED!
- Stream of consciousness, run-on sentences, working class Edinburgh voice`,
  'charles-bukowski': `Write like CHARLES BUKOWSKI:
- Gritty, raw, poetic realism
- Short, punchy sentences mixed with longer reflections
- Working class perspective, cynical but honest
- References to drinking, women, the underbelly of life`,
  'benjamin-stuckrad-barre': `Write like BENJAMIN VON STUCKRAD-BARRÉ:
- German pop literature style, witty and ironic
- Self-aware, media-savvy observations
- Mix of high and low culture references
- Slightly manic energy, name-dropping`,
  'hunter-thompson': `Write like HUNTER S. THOMPSON (Gonzo journalism):
- First person, subjective, you ARE part of the story
- Wild tangents, drug references, paranoid observations
- "Fear and Loathing" style - chaotic but brilliant
- Use phrases like "Jesus Christ", "savage", "doomed"`,
  'bret-easton-ellis': `Write like BRET EASTON ELLIS:
- Minimalist, detached, almost clinical
- Lists of brand names, surface details
- 80s excess, empty glamour
- Short declarative sentences`,
  'douglas-coupland': `Write like DOUGLAS COUPLAND (Generation X author):
- The definitive Gen X voice
- Pop culture references, ironic observations
- McJobs, media saturation, suburban ennui
- Clever neologisms and cultural commentary`,
};

export async function POST(request: NextRequest) {
  try {
    const { title, subtitle, items, language = 'en', style = 'informative' } = await request.json();
    
    if (!title || !items?.length) {
      return NextResponse.json({ success: false, error: 'Title and items required' }, { status: 400 });
    }
    
    const itemsList = items.map((item: any, i: number) => 
      `${i + 1}. ${item.title}${item.description ? ` - ${item.description}` : ''}`
    ).join('\n');
    
    const languageInstruction = language === 'de' 
      ? 'Write the article in GERMAN (Deutsch). Use informal "du" form.'
      : 'Write the article in ENGLISH.';
    
    const styleInstruction = STYLE_PROMPTS[style] || STYLE_PROMPTS['informative'];
    
    const prompt = `Write an engaging article about this ranking list for a Gen X audience (born 1965-1980).

${languageInstruction}

WRITING STYLE:
${styleInstruction}

RANKING: ${title}
${subtitle ? `SUBTITLE: ${subtitle}` : ''}

ITEMS:
${itemsList}

Write the article in HTML format with these requirements:
1. Start with an engaging introduction (2-3 paragraphs) that sets the context
2. For each item in the ranking, write a short paragraph (2-3 sentences) explaining why it's notable
3. Use <h2> tags for section headers if needed
4. Use <p> tags for paragraphs
5. IMPORTANT: Follow the writing style instructions above!
6. Include "Fun fact:" tidbits where appropriate
7. End with a call-to-action encouraging readers to vote

Return ONLY a JSON object with this exact structure:
{
  "title": "Article title (can be different from ranking title)",
  "subtitle": "A catchy subtitle",
  "content": "The full HTML article content",
  "tags": ["tag1", "tag2", "tag3"]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `You are a writer specializing in Gen X culture (80s, 90s, early 2000s). ${styleInstruction} Always return valid JSON.`
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 3000,
      temperature: style === 'informative' ? 0.7 : 0.9,
    });
    
    const responseText = completion.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    let article;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        article = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      return NextResponse.json({ success: false, error: 'Failed to parse AI response' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      article: {
        title: article.title || title,
        subtitle: article.subtitle || subtitle,
        content: article.content || '',
        tags: article.tags || [],
      }
    });
  } catch (error) {
    console.error('Article generation error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
