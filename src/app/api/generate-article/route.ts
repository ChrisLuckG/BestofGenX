import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load central system prompt
function getSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), 'src', 'prompts', 'system-prompt.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { topic, category, style } = await request.json();

    if (!topic) {
      return NextResponse.json({ success: false, error: 'Missing topic' }, { status: 400 });
    }

    const systemPrompt = getSystemPrompt();

    // Build user prompt with style instructions
    let userPrompt = `Generate article about ${topic}. Category hint: ${category || 'culture'}.`;
    if (style) {
      userPrompt += ` STYLE INSTRUCTIONS: ${style}`;
    }

    // User prompt triggers TASK 5: ARTICLE GENERATION from central prompt
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
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
