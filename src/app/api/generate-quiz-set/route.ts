import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import dbConnect from "@/lib/mongoose";
import Card from "@/models/Card";
import { readFileSync } from "fs";
import { join } from "path";
import { findDuplicateQuestion, generateQuestionHash, buildAvoidList, recordUsedTopic } from "@/lib/questionService";

// Load the system prompt from the text file - NO FALLBACK
const systemPromptPath = join(process.cwd(), "src/prompts/system-prompt.txt");
const baseSystemPrompt = readFileSync(systemPromptPath, "utf-8");

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    const { topic, theme } = await request.json();

    const hasCustomTopic = topic && topic.trim().length > 0;
    
    console.log("Generating quiz SET for topic:", topic || "RANDOM", "theme:", theme);

    // Build avoid list from used topics (last 30 days)
    const avoidList = await buildAvoidList(theme);
    const systemPrompt = baseSystemPrompt + avoidList;
    
    console.log(`Avoid list has ${avoidList ? 'topics to avoid' : 'no topics yet'}`);

    // User prompt based on topic
    const userPrompt = hasCustomTopic 
      ? `Erstelle 3 Quiz-Fragen (Easy, Medium, Hard) über: "${topic}"`
      : `Erstelle 3 Quiz-Fragen (Easy, Medium, Hard) für die Kategorie: ${theme || 'RANDOM'}. Wähle ein KREATIVES und UNERWARTETES Thema!`;

    // Generate quiz content with GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt + "\n\nWICHTIG: Du MUSST genau diese JSON-Struktur zurückgeben mit ALLEN drei Schwierigkeitsgraden (easy, medium, hard). Keine darf fehlen!" }
      ],
      temperature: 1.0, // Lowered slightly for structure compliance
      response_format: { type: 'json_object' }, // Force JSON output
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ success: false, error: "No response from AI" }, { status: 500 });
    }

    // Parse the JSON response
    let quizData;
    try {
      quizData = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return NextResponse.json({ success: false, error: "Failed to parse AI response" }, { status: 500 });
    }

    // VALIDATE all 3 difficulties are present and complete
    const validateVariant = (v: any, name: string): string | null => {
      if (!v) return `Missing ${name} variant`;
      if (!v.question || typeof v.question !== 'string') return `${name}: missing question`;
      if (!Array.isArray(v.options) || v.options.length !== 4) return `${name}: must have exactly 4 options`;
      if (!v.correctAnswer || !v.options.includes(v.correctAnswer)) return `${name}: correctAnswer must match one of the options`;
      return null;
    };

    const validationErrors = [
      validateVariant(quizData.easy, 'easy'),
      validateVariant(quizData.medium, 'medium'),
      validateVariant(quizData.hard, 'hard'),
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      console.error("AI returned incomplete quiz set:", validationErrors, quizData);
      return NextResponse.json({
        success: false,
        error: `AI returned incomplete quiz set: ${validationErrors.join('; ')}. Please retry.`,
      }, { status: 500 });
    }

    // Try to get an image from Wikimedia
    let imageUrl = "";
    const searchTopic = quizData.topic || topic;
    
    try {
      console.log("Searching Wikimedia for:", searchTopic);
      
      const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTopic)}&srnamespace=6&srlimit=10&format=json&origin=*`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();

      if (searchData.query?.search?.length > 0) {
        const titles = searchData.query.search.map((item: any) => item.title).join("|");
        const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&iiurlheight=800&format=json&origin=*`;
        
        const imageRes = await fetch(imageInfoUrl);
        const imageData = await imageRes.json();

        if (imageData.query?.pages) {
          const pages = Object.values(imageData.query.pages) as any[];
          const validImages = pages.filter((page: any) => {
            const imageInfo = page.imageinfo?.[0];
            if (!imageInfo) return false;
            const mime = imageInfo.mime || '';
            return mime.startsWith('image/') && !mime.includes('svg');
          });

          if (validImages.length > 0) {
            const randomImage = validImages[Math.floor(Math.random() * validImages.length)];
            imageUrl = randomImage.imageinfo[0].thumburl || randomImage.imageinfo[0].url;
          }
        }
      }
    } catch (imageError) {
      console.error("Image search failed:", imageError);
    }

    // If no Wikimedia image found, generate one with DALL-E
    if (!imageUrl) {
      try {
        console.log("No Wikimedia image found, generating with DALL-E for:", searchTopic);
        const imagePrompt = `Retro 80s/90s style illustration for quiz topic: "${searchTopic}". Vibrant colors, nostalgic aesthetic, no text or words in the image.`;
        
        const imageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        });
        
        imageUrl = imageResponse.data?.[0]?.url || "";
        console.log("DALL-E image generated:", imageUrl ? "success" : "failed");
      } catch (dalleError) {
        console.error("DALL-E image generation failed:", dalleError);
      }
    }

    // Check for duplicate questions before returning
    const duplicateChecks = await Promise.all([
      findDuplicateQuestion(quizData.easy?.question || ''),
      findDuplicateQuestion(quizData.medium?.question || ''),
      findDuplicateQuestion(quizData.hard?.question || ''),
    ]);
    
    const hasDuplicates = duplicateChecks.some(d => d !== null);
    const duplicateInfo = {
      easy: duplicateChecks[0] ? { isDuplicate: true, existingId: duplicateChecks[0]._id } : { isDuplicate: false },
      medium: duplicateChecks[1] ? { isDuplicate: true, existingId: duplicateChecks[1]._id } : { isDuplicate: false },
      hard: duplicateChecks[2] ? { isDuplicate: true, existingId: duplicateChecks[2]._id } : { isDuplicate: false },
    };

    // Generate hashes for the questions
    const questionHashes = {
      easy: generateQuestionHash(quizData.easy?.question || ''),
      medium: generateQuestionHash(quizData.medium?.question || ''),
      hard: generateQuestionHash(quizData.hard?.question || ''),
    };

    // Record this topic as used (for future avoid lists)
    if (quizData.topic) {
      await recordUsedTopic(quizData.topic, quizData.theme || theme || 'UNKNOWN');
    }

    return NextResponse.json({
      success: true,
      topic: quizData.topic,
      theme: quizData.theme,
      questions: {
        easy: quizData.easy,
        medium: quizData.medium,
        hard: quizData.hard,
      },
      generatedImage: imageUrl,
      duplicateCheck: duplicateInfo,
      hasDuplicates,
      questionHashes,
    });

  } catch (error) {
    console.error("Quiz set generation error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
