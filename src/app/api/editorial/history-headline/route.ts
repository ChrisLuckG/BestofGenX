import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Generate a catchy headline for history events

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface HistoryEvent {
  title: string;
  year: number;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" });
    }

    const body = await request.json();
    const { events } = body as { events: HistoryEvent[] };

    if (!events || events.length === 0) {
      return NextResponse.json({ success: false, error: "No events provided" });
    }

    const openai = new OpenAI({ apiKey });

    // Get today's date
    const now = new Date();
    const month = MONTHS[now.getMonth()];
    const day = now.getDate();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: `You create short, catchy headlines for "On This Day in History" articles. 
The headline should be poetic, evocative, and capture the essence of multiple historical events.
Format: "[Month] [Day]: [Catchy phrase that ties events together]"
Examples:
- "July 30: Legendary Victories and Enduring Mysteries"
- "August 5: When Giants Fell and Stars Were Born"
- "March 15: Revolutions, Records, and Revelations"
- "June 12: Dreams Realized and Empires Shaken"
Keep it under 10 words after the date. Be creative but not cheesy. Use alliteration when it fits naturally.`
        },
        { 
          role: "user", 
          content: `Create a headline for ${month} ${day} that captures these events:\n${events.map(e => `- ${e.title} (${e.year})`).join('\n')}`
        }
      ],
      temperature: 0.9, // Higher temperature for more variety
      max_tokens: 50,
    });

    const headline = completion.choices[0]?.message?.content?.trim() || `${month} ${day}: Moments That Shaped History`;

    return NextResponse.json({
      success: true,
      headline,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate headline";
    console.error("history-headline error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
