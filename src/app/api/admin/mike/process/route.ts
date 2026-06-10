import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load the system prompt
function loadSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), 'src', 'prompts', 'system-prompt.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { request: userRequest } = await request.json();
    
    if (!userRequest) {
      return NextResponse.json({ success: false, error: 'No request provided' }, { status: 400 });
    }

    const systemPrompt = loadSystemPrompt();
    
    const mikePrompt = `
You are MIKE, the Development Manager and Product Owner for BestOfGenX.

Your job is to take a user's plain-language request and transform it into a structured development task.

CONTEXT - THE SYSTEM PROMPT:
The following is the central system prompt that controls all AI behavior in this app. 
If the task relates to AI functionality, reference the relevant section.

${systemPrompt}

---

YOUR TASK:
Analyze the following user request and create a structured task.

1. Create a clear, concise TITLE (max 60 chars)
2. Write a detailed DESCRIPTION in developer-friendly language
3. Suggest the most appropriate CATEGORY from: UI/UX, Bug Fix, Mobile, Backend, Frontend, Payments, Gamification, Content, Admin, AI, System Prompt, Future Features
4. Suggest PRIORITY: Critical, High, Medium, Low, Future Idea
5. Estimate COMPLEXITY: Trivial, Simple, Medium, Complex, Epic
6. If the request is unclear or missing information, note what's needed in AI_SUGGESTIONS
7. If this relates to the system prompt, note which section in RELATED_PROMPT_SECTION

Respond ONLY with valid JSON in this format:
{
  "title": "...",
  "description": "...",
  "category": "...",
  "priority": "...",
  "complexity": "...",
  "aiSuggestions": "...",
  "relatedPromptSection": "..."
}
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: mikePrompt },
        { role: 'user', content: `Process this request:\n\n${userRequest}` }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: 'Failed to parse AI response' }, { status: 500 });
    }

    const task = JSON.parse(jsonMatch[0]);
    
    return NextResponse.json({ 
      success: true, 
      task: {
        title: task.title || 'Untitled Task',
        description: task.description || '',
        category: task.category || 'Frontend',
        priority: task.priority || 'Medium',
        complexity: task.complexity || 'Medium',
        aiSuggestions: task.aiSuggestions || '',
        relatedPromptSection: task.relatedPromptSection || '',
        status: 'Draft',
      }
    });
    
  } catch (error) {
    console.error('Mike AI processing failed:', error);
    return NextResponse.json({ success: false, error: 'AI processing failed' }, { status: 500 });
  }
}
