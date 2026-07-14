import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const { currentText, headlineText, hasHeadline, fullContext, generateNew, articleTitle, articleTags } = await request.json();

    // Allow empty text if generateNew is true (for History articles)
    if (!currentText && !headlineText && !generateNew) {
      return NextResponse.json({ success: false, error: "No text to rewrite" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    let systemPrompt: string;
    let userPrompt: string;

    // Generate NEW historical fact for empty block in History article
    if (generateNew) {
      // Extract date from article title (e.g. "July 13: ..." -> July 13)
      const dateMatch = articleTitle?.match(/^([A-Za-z]+ \d+)/);
      const dateStr = dateMatch ? dateMatch[1] : 'today';
      
      systemPrompt = `You are a GenX nostalgia expert for "Best of GenX". 
Generate ONE new historical fact that happened on ${dateStr} (any year between 1975-2005).

RULES:
- Must be a REAL, VERIFIED historical event from the GenX era (1975-2005)
- Must have happened on this exact date (${dateStr})
- Should be interesting and nostalgic for GenX audience
- Do NOT repeat any facts already in the article
- Focus on: music, movies, TV, sports, tech, pop culture, celebrities

Return your response in this EXACT format:
HEADLINE: [Short catchy headline, 3-8 words]
BODY: [2-3 sentences describing the event in a nostalgic, engaging tone]

Do NOT include the year in the headline. Start the body with "On [date], [year], ..."`;

      userPrompt = `Here are the existing facts in this article (DO NOT REPEAT ANY OF THESE):
---
${fullContext}
---

Generate ONE new, different historical fact for ${dateStr}.`;
    } else {
      systemPrompt = `You are a skilled editor for a GenX nostalgia platform called "Best of GenX". 
Your task is to rewrite content while:
1. Keeping the same meaning and information
2. Maintaining the nostalgic, conversational tone
3. Making it more engaging and vivid
4. Keeping approximately the same length
5. Using the context of the full article to ensure consistency

`;

      if (hasHeadline) {
        systemPrompt += `This block contains a HEADLINE and a paragraph. You must rewrite BOTH.

Return your response in this EXACT format (two lines):
HEADLINE: [your rewritten headline here]
BODY: [your rewritten paragraph here]

Do NOT include any other text, explanations, or formatting.`;
      } else {
        systemPrompt += `IMPORTANT: Return ONLY the rewritten paragraph text. No quotes, no explanations, no HTML tags.`;
      }

      userPrompt = `Here is the full article context for reference:
---
${fullContext}
---

`;

      if (hasHeadline) {
        userPrompt += `Please rewrite this headline and paragraph:
Headline: "${headlineText}"
Paragraph: "${currentText}"`;
      } else {
        userPrompt += `Please rewrite this specific paragraph (keep the same meaning but make it fresh and engaging):
"${currentText}"`;
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) {
      return NextResponse.json({ success: false, error: "No response from AI" }, { status: 500 });
    }

    if (hasHeadline) {
      // Parse the structured response
      const headlineMatch = response.match(/HEADLINE:\s*(.+)/i);
      const bodyMatch = response.match(/BODY:\s*([\s\S]+)/i);
      
      const rewrittenHeadline = headlineMatch ? headlineMatch[1].trim() : headlineText;
      const rewrittenText = bodyMatch ? bodyMatch[1].trim() : currentText;
      
      return NextResponse.json({ success: true, rewrittenHeadline, rewrittenText });
    } else {
      return NextResponse.json({ success: true, rewrittenText: response });
    }
  } catch (error) {
    console.error("Rewrite block error:", error);
    return NextResponse.json({ success: false, error: "Failed to rewrite" }, { status: 500 });
  }
}
