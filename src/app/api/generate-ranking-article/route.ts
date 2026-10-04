import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { styleInstructionFor, isAuthorVoice } from '@/lib/authorStylePrompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Voice briefs live in @/lib/authorStylePrompts - this route used to keep its own,
// shorter copy, which drifted from the UI list: it keyed Thompson as 'hunter-thompson'
// while the dropdown sent 'hunter-s-thompson', so that author silently resolved to
// 'informative'. One source of truth avoids repeating that.

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
    
    const styleInstruction = styleInstructionFor(style);
    
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
      temperature: isAuthorVoice(style) ? 0.95 : 0.7,
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
