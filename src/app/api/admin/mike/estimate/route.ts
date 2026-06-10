import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function loadSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), 'src', 'prompts', 'system-prompt.txt');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return '';
  }
}

// Cost estimation based on complexity
const HOUR_RATE = 50;
const COMPLEXITY_HOURS: Record<string, number> = {
  'Trivial': 0.25,
  'Simple': 0.5,
  'Medium': 1.5,
  'Complex': 4,
  'Epic': 12,
};

export async function POST(request: NextRequest) {
  try {
    const { tasks } = await request.json();
    
    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ success: false, error: 'No tasks provided' }, { status: 400 });
    }

    const systemPrompt = loadSystemPrompt();
    
    // Build task list for estimation
    const taskList = tasks.map((t: any, i: number) => 
      `${i + 1}. ${t.title}
   Description: ${t.description}
   Category: ${t.category}
   Complexity (Mike's guess): ${t.complexity}
   AI Notes: ${t.aiSuggestions}`
    ).join('\n\n');

    const estimatePrompt = `Du bist Cascade, ein Senior Developer. Analysiere diese Tickets und gib eine GENAUE Kosten-Schätzung.

TICKETS:
${taskList}

Für jedes Ticket:
1. Ist die Complexity richtig? (Trivial/Simple/Medium/Complex/Epic)
2. Was muss gemacht werden? (2-3 Punkte)
3. Geschätzte Zeit in Stunden
4. Geschätzte Kosten (${HOUR_RATE}€/h)

Antworte KURZ und DIREKT. Format pro Ticket:
---
#1: [Title]
Complexity: [Deine Einschätzung]
Tasks: [Was zu tun ist]
Zeit: ~Xh
Kosten: ~X€
---

Am Ende: TOTAL Zeit und Kosten.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: estimatePrompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const estimate = completion.choices[0]?.message?.content || 'Keine Schätzung möglich.';
    
    // Parse estimated costs from response (rough extraction)
    let totalEstimate = 0;
    const costMatches = estimate.match(/~(\d+)€/g);
    if (costMatches) {
      costMatches.forEach(match => {
        const num = parseInt(match.replace(/[^0-9]/g, ''));
        if (num < 1000) totalEstimate += num; // Ignore totals
      });
    }

    return NextResponse.json({ 
      success: true, 
      estimate,
      totalEstimate,
      taskCount: tasks.length
    });
  } catch (error) {
    console.error('Estimate error:', error);
    return NextResponse.json({ success: false, error: 'Failed to estimate' }, { status: 500 });
  }
}
