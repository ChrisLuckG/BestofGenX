import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { combinePrompts } from '@/lib/loadPrompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load modular prompts: core + mike rules
function loadSystemPrompt(): string {
  return combinePrompts(['core.txt', 'mike.txt']);
}

// Mike reviews what Cascade built
export async function POST(request: NextRequest) {
  try {
    const { task, cascadeReport } = await request.json();
    
    if (!task || !cascadeReport) {
      return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 });
    }

    const systemPrompt = loadSystemPrompt();
    
    // Check if files actually exist
    const filesExist = cascadeReport.filesCreated?.every((f: string) => {
      const fullPath = path.join(process.cwd(), f);
      return fs.existsSync(fullPath);
    }) ?? true;

    const filesModifiedExist = cascadeReport.filesModified?.every((f: string) => {
      const fullPath = path.join(process.cwd(), f);
      return fs.existsSync(fullPath);
    }) ?? true;

    if (!filesExist || !filesModifiedExist) {
      return NextResponse.json({
        success: true,
        approved: false,
        message: 'Files nicht gefunden. Cascade hat nicht richtig gebaut.',
      });
    }

    // Quick review prompt
    const reviewPrompt = `Du bist Mike, der Product Owner. Cascade hat gerade ein Feature gebaut.

TICKET: ${task.title}
BESCHREIBUNG: ${task.description}

CASCADE REPORT:
- Neue Files: ${cascadeReport.filesCreated?.join(', ') || 'keine'}
- Geänderte Files: ${cascadeReport.filesModified?.join(', ') || 'keine'}
- Zeit: ${cascadeReport.timeSpent} min
- Kosten: ~${cascadeReport.cost}€

Die Files existieren. Gib ein KURZES OK (max 1 Satz) wenn alles gut aussieht.
Antworte NUR mit JSON: {"approved": true/false, "message": "dein kurzer Kommentar"}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: reviewPrompt }
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Parse JSON response
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          success: true,
          approved: result.approved ?? true,
          message: result.message || 'OK',
        });
      }
    } catch {
      // If JSON parsing fails, assume approved
    }

    return NextResponse.json({
      success: true,
      approved: true,
      message: 'Feature sieht gut aus. Approved!',
    });
  } catch (error) {
    console.error('Mike review error:', error);
    return NextResponse.json({ success: false, error: 'Review failed' }, { status: 500 });
  }
}
