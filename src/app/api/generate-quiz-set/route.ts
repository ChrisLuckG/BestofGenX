import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import dbConnect from "@/lib/mongoose";
import Card from "@/models/Card";
import { findDuplicateQuestion, generateQuestionHash, buildAvoidList, recordUsedTopic } from "@/lib/questionService";
import { v2 as cloudinary } from 'cloudinary';
import sharp from "sharp";
import { combinePrompts } from "@/lib/loadPrompt";

// Load modular prompts: core + trivia rules
const baseSystemPrompt = combinePrompts(["core.txt", "trivia.txt"]);

export async function POST(request: NextRequest) {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    await dbConnect();
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    const { topic, theme, difficulty = 'Easy', subCategory } = await request.json();

    const hasCustomTopic = topic && topic.trim().length > 0;
    
    console.log(`Generating SINGLE ${difficulty} question for topic:`, topic || "RANDOM", "theme:", theme, "subCategory:", subCategory || "any");

    // Build avoid list from used topics (last 30 days)
    const avoidList = await buildAvoidList(theme);
    const systemPrompt = baseSystemPrompt + avoidList;
    
    console.log(`Avoid list has ${avoidList ? 'topics to avoid' : 'no topics yet'}`);

    // User prompt for SINGLE question with specified difficulty and optional subCategory
    let userPrompt: string;
    if (hasCustomTopic) {
      userPrompt = `Erstelle EINE EINZELNE ${difficulty}-Quiz-Frage über: "${topic}"`;
    } else if (subCategory) {
      userPrompt = `Erstelle EINE EINZELNE ${difficulty}-Quiz-Frage für ${theme} - speziell über ${subCategory}. Wähle ein interessantes Thema aus dem Bereich ${subCategory}!`;
    } else {
      userPrompt = `Erstelle EINE EINZELNE ${difficulty}-Quiz-Frage für die Kategorie: ${theme || 'RANDOM'}. Wähle ein KREATIVES und UNERWARTETES Thema!`;
    }

    // Generate SINGLE question with GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt + `

WICHTIG: Gib NUR EINE Frage zurück im JSON-Format:
{
  "topic": "Das spezifische Thema (z.B. Michael Jordan)",
  "subCategory": "Die Unterkategorie (z.B. Basketball, Rock, Action Movies)",
  "theme": "${theme || 'RANDOM'}",
  "question": "Die Frage?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "Die richtige Option",
  "highlightWords": ["wichtige", "wörter"]
}` }
      ],
      temperature: 1.0,
      response_format: { type: 'json_object' },
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

    // VALIDATE single question
    if (!quizData.question || typeof quizData.question !== 'string') {
      return NextResponse.json({ success: false, error: "Missing question" }, { status: 500 });
    }
    if (!Array.isArray(quizData.options) || quizData.options.length !== 4) {
      return NextResponse.json({ success: false, error: "Must have exactly 4 options" }, { status: 500 });
    }
    if (!quizData.correctAnswer || !quizData.options.includes(quizData.correctAnswer)) {
      return NextResponse.json({ success: false, error: "correctAnswer must match one of the options" }, { status: 500 });
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
          response_format: "b64_json", // Get base64 for compression
        });
        
        const b64 = imageResponse.data?.[0]?.b64_json;
        if (b64) {
          // Compress to 512x512 WebP
          const originalBuffer = Buffer.from(b64, 'base64');
          const compressedBuffer = await sharp(originalBuffer)
            .resize(512, 512, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer();
          
          const filename = `quiz-${Date.now()}`;
          
          // Upload to Cloudinary
          const uploadResult = await new Promise<any>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                public_id: `images/${filename}`,
                resource_type: 'image',
                folder: 'bestofgenx',
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            uploadStream.end(compressedBuffer);
          });
          imageUrl = uploadResult.secure_url;
          console.log(`DALL-E image compressed: ${originalBuffer.length} -> ${compressedBuffer.length} bytes`);
        }
      } catch (dalleError) {
        console.error("DALL-E image generation failed:", dalleError);
      }
    }

    // Check for duplicate question
    const duplicate = await findDuplicateQuestion(quizData.question);
    const questionHash = generateQuestionHash(quizData.question);
    
    // Also check if topic already exists
    const existingTopicCard = await Card.findOne({ 
      topic: { $regex: new RegExp(`^${quizData.topic?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    const isDuplicate = duplicate !== null || existingTopicCard !== null;
    
    if (isDuplicate) {
      console.log(`DUPLICATE DETECTED: topic="${quizData.topic}" or question already exists`);
    }

    // Record this topic as used (for future avoid lists)
    if (quizData.topic) {
      await recordUsedTopic(quizData.topic, quizData.theme || theme || 'UNKNOWN');
    }

    return NextResponse.json({
      success: true,
      topic: quizData.topic,
      subCategory: quizData.subCategory || '',
      theme: quizData.theme || theme,
      question: quizData.question,
      options: quizData.options,
      correctAnswer: quizData.correctAnswer,
      highlightWords: quizData.highlightWords || [],
      generatedImage: imageUrl,
      isDuplicate,
      questionHash,
    });

  } catch (error) {
    console.error("Quiz set generation error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
