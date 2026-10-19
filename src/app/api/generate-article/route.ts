import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { combinePrompts } from '@/lib/loadPrompt';
import { styleInstructionFor, isAuthorVoice } from '@/lib/authorStylePrompts';
import { promptForStyle } from '@/lib/articlePromptStyle';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load modular prompts: core + article rules
function getSystemPrompt(): string {
  return combinePrompts(['core.txt', 'article-prompt.txt']);
}

export async function POST(request: NextRequest) {
  try {
    const { topic, category, style, styleId } = await request.json();

    if (!topic) {
      return NextResponse.json({ success: false, error: 'Missing topic' }, { status: 400 });
    }

    // The writing style's brief belongs in the SYSTEM prompt and overrides the house tone (the rules in AGENTS.md,
    // "Author voices"). Before, only free text went into the user message and the voices were never applied.
    const hasVoice = isAuthorVoice(styleId);
    const systemPrompt = `${promptForStyle(getSystemPrompt(), hasVoice)}\n\n${styleInstructionFor(styleId || 'informative')}${hasVoice ? '\nThis voice OVERRIDES any house tone or "nostalgic" instruction above. Write the headings in the same voice.' : ''}`;

    // Build user prompt with style instructions
    let userPrompt = `Generate article about ${topic}. Category hint: ${category || 'culture'}.`;
    if (style) {
      userPrompt += ` STYLE INSTRUCTIONS: ${style}`;
    }
    // Repeated here because the long house prompt drowned the brief at the end of the system prompt: the first
    // voiced test (Irvine Welsh) still read like a neutral magazine piece.
    if (hasVoice) {
      userPrompt += ` VOICE: every sentence AND every heading in the voice of the writing-style brief in your instructions - not a neutral or "engaging magazine" tone. If a reader cannot tell which author this is from the first paragraph, it failed.`;
    }

    // User prompt triggers TASK 5: ARTICLE GENERATION from central prompt
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: hasVoice ? 0.95 : 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ success: false, error: 'No content generated' }, { status: 500 });
    }

    const article = JSON.parse(content);
    
    console.log('Parsed article:', { 
      title: article.title, 
      subtitle: article.subtitle, 
      hasContent: !!article.content,
      tags: article.tags,
      category: article.suggestedCategory 
    });

    return NextResponse.json({
      success: true,
      title: article.title,
      subtitle: article.subtitle,
      content: article.content,
      tags: article.tags || [],
      suggestedCategory: article.suggestedCategory || 'culture',
    });

  } catch (error: unknown) {
    console.error('Article generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
