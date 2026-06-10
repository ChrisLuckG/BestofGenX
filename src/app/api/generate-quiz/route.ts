import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { join } from "path";

// Load the system prompt from the text file - NO FALLBACK
const systemPromptPath = join(process.cwd(), "src/prompts/system-prompt.txt");
const systemPrompt = readFileSync(systemPromptPath, "utf-8");

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    const { topic, theme } = await request.json();

    const hasCustomTopic = topic && topic.trim().length > 0;
    
    console.log("Generating quiz for topic:", topic || "RANDOM GenX", "theme:", theme);

    // Build user prompt
    const userPrompt = hasCustomTopic 
      ? `Erstelle eine Quiz-Frage über: "${topic}"`
      : `Erstelle eine ZUFÄLLIGE Quiz-Frage aus der GenX-Ära (1980-2005). Wähle ein UNERWARTETES Thema!`;

    // Generate quiz content with GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 1.2, // High for maximum creativity and variety
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ success: false, error: "No response from AI" }, { status: 500 });
    }

    // Parse the JSON response
    let quizData;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      quizData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json({ success: false, error: "Failed to parse AI response" }, { status: 500 });
    }

    // First try Wikimedia Commons for real photos
    let imageUrl = "";
    const searchTopic = quizData.topic || topic;
    
    try {
      console.log("Searching Wikimedia for:", searchTopic);
      
      // Search Wikimedia Commons - just the topic name, more results
      const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTopic)}&srnamespace=6&srlimit=15&format=json&origin=*`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (searchData.query?.search?.length > 0) {
        // Get more titles for variety
        const titles = searchData.query.search.map((item: any) => item.title).join("|");
        const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&iiurlheight=800&format=json&origin=*`;
        
        const imageRes = await fetch(imageInfoUrl);
        const imageData = await imageRes.json();
        const pages = imageData.query?.pages || {};

        // Collect all valid images
        const validImages: string[] = [];
        for (const pageId in pages) {
          const imageInfo = pages[pageId].imageinfo?.[0];
          if (imageInfo && imageInfo.mime?.startsWith("image/") && !imageInfo.mime?.includes("svg")) {
            validImages.push(imageInfo.thumburl || imageInfo.url);
          }
        }
        
        // Pick a random image from the results
        if (validImages.length > 0) {
          const randomIndex = Math.floor(Math.random() * validImages.length);
          imageUrl = validImages[randomIndex];
          console.log(`Found ${validImages.length} Wikimedia images, picked #${randomIndex + 1}:`, imageUrl);
        }
      }
    } catch (wikiError) {
      console.error("Wikimedia search failed:", wikiError);
    }

    // No automatic AI image generation - too slow
    // User can manually generate AI image later if needed

    // Strict validation - NO FALLBACKS
    if (!quizData.question || typeof quizData.question !== 'string' || quizData.question.length < 10) {
      console.error('Invalid question from AI:', quizData.question);
      return NextResponse.json({ success: false, error: "AI generated invalid question" }, { status: 500 });
    }
    if (!Array.isArray(quizData.options) || quizData.options.length !== 4) {
      console.error('Invalid options from AI:', quizData.options);
      return NextResponse.json({ success: false, error: "AI generated invalid options" }, { status: 500 });
    }
    if (!quizData.correctAnswer || !quizData.options.includes(quizData.correctAnswer)) {
      console.error('Invalid correctAnswer from AI:', quizData.correctAnswer, quizData.options);
      return NextResponse.json({ success: false, error: "AI generated invalid correct answer" }, { status: 500 });
    }
    if (typeof quizData.difficulty !== 'number' || quizData.difficulty < 1 || quizData.difficulty > 5) {
      console.error('Invalid difficulty from AI:', quizData.difficulty);
      return NextResponse.json({ success: false, error: "AI generated invalid difficulty" }, { status: 500 });
    }
    if (!quizData.topic || typeof quizData.topic !== 'string') {
      console.error('Invalid topic from AI:', quizData.topic);
      return NextResponse.json({ success: false, error: "AI generated invalid topic" }, { status: 500 });
    }

    // Calculate maxReward based on difficulty
    const rewardMap: { [key: number]: number } = { 1: 50, 2: 100, 3: 150, 4: 200, 5: 250 };
    const maxReward = rewardMap[quizData.difficulty];

    return NextResponse.json({
      success: true,
      data: {
        topic: quizData.topic,
        theme: quizData.theme || theme || "SPORTS",
        question: quizData.question,
        options: quizData.options,
        correctAnswer: quizData.correctAnswer,
        highlightWords: quizData.highlightWords || [],
        difficulty: quizData.difficulty,
        difficultyText: quizData.difficultyText || ['Easy', 'Easy', 'Medium', 'Medium', 'Hard'][quizData.difficulty - 1],
        maxReward,
        generatedImage: imageUrl,
      }
    });

  } catch (error: any) {
    console.error("Generate quiz error:", error);
    const errorMessage = error?.message || error?.toString() || "Failed to generate quiz";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
