import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongoose';
import MikeTask from '@/models/MikeTask';
import { combinePrompts } from '@/lib/loadPrompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load modular prompts: core + mike rules
function loadSystemPrompt(): string {
  return combinePrompts(['core.txt', 'mike.txt']);
}

function appendToErrorLearning(lesson: string): void {
  try {
    const promptPath = path.join(process.cwd(), 'src', 'prompts', 'mike.txt');
    let content = fs.readFileSync(promptPath, 'utf-8');
    
    // Find the FEHLER-LERNUNG section and append
    const marker = 'FEHLER-LERNUNG (von Cascade korrigiert)';
    const markerIndex = content.indexOf(marker);
    
    if (markerIndex !== -1) {
      // Find the next section (================)
      const nextSectionIndex = content.indexOf('================================================================================', markerIndex + marker.length);
      if (nextSectionIndex !== -1) {
        // Count existing lessons
        const sectionContent = content.substring(markerIndex, nextSectionIndex);
        const lessonCount = (sectionContent.match(/^\d+\./gm) || []).length;
        
        // Insert new lesson before next section
        const newLesson = `\n${lessonCount + 1}. ${lesson}\n`;
        content = content.substring(0, nextSectionIndex) + newLesson + content.substring(nextSectionIndex);
        fs.writeFileSync(promptPath, content, 'utf-8');
      }
    }
  } catch (e) {
    console.error('Failed to append to error learning:', e);
  }
}

// Cascade sends feedback to Mike
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { taskId, feedback, action } = await request.json();
    
    // Action: delete - Mike deletes the wrong ticket
    if (action === 'delete' && taskId) {
      await MikeTask.findByIdAndDelete(taskId);
    }
    
    // Action: learn - Add lesson to system prompt
    if (action === 'learn' && feedback) {
      appendToErrorLearning(feedback);
    }
    
    // Generate Mike's response to the feedback
    const systemPrompt = loadSystemPrompt();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: systemPrompt + '\n\nDu bekommst Feedback von Cascade. Antworte KURZ (max 2 Sätze). Zeig dass du verstanden hast. Kein Geschwätz.'
        },
        { 
          role: 'user', 
          content: `Cascade Feedback: ${feedback}${taskId ? ` (Ticket wurde gelöscht)` : ''}`
        }
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const mikeResponse = completion.choices[0]?.message?.content || 'Verstanden.';
    
    return NextResponse.json({ 
      success: true, 
      response: mikeResponse,
      deleted: action === 'delete',
      learned: action === 'learn'
    });
  } catch (error) {
    console.error('Mike feedback error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process feedback' }, { status: 500 });
  }
}
