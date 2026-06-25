import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    const { topic, theme, prompt, style, allowText } = await request.json();

    console.log("Generating image for topic:", topic, "theme:", theme, "prompt:", prompt, "allowText:", allowText);

    // Theme-specific image prompts (no people/celebrities to avoid safety filters)
    const themePrompts: Record<string, string> = {
      'MUSIC': 'Retro 80s 90s music aesthetic. Vinyl records, cassette tapes, boombox, neon lights, synthesizers, concert stage lights. Vaporwave synthwave style. NO people, NO faces.',
      'MOVIES': 'Retro cinema aesthetic. Film reels, movie theater seats, popcorn, clapperboard, Hollywood spotlights, red carpet. Cinematic dramatic lighting. NO people, NO faces.',
      'TV SHOWS': 'Retro TV aesthetic. Old CRT television sets, VHS tapes, TV antennas, living room 90s style, remote controls. Nostalgic warm lighting. NO people, NO faces.',
      'SPORTS': 'Retro sports aesthetic. Stadium lights, trophies, sports equipment, grass field, scoreboard, championship banners. Dynamic dramatic lighting. NO people, NO faces.',
      'GAMING': 'Retro gaming aesthetic. Arcade machines, game controllers, pixel art screens, neon arcade lights, joysticks, cartridges. Cyberpunk neon style. NO people, NO faces.',
      'FASHION': 'Retro 80s 90s fashion aesthetic. Vintage clothing racks, designer accessories, runway lights, fashion magazines, sunglasses, jewelry. Glamorous studio lighting. NO people, NO faces.',
      'TECHNOLOGY': 'Retro tech aesthetic. Old computers, floppy disks, early internet, dial-up modems, chunky phones, circuit boards. Cyberpunk blue glow. NO people, NO faces.',
      'CELEBRITIES': 'Hollywood glamour aesthetic. Star walk of fame, paparazzi cameras, red carpet, spotlights, awards trophies, limousines. Golden hour lighting. NO people, NO faces.',
    };

    // If direct prompt provided (for articles), use it   // allowText=true uses the prompt as-is (for banners with slogans/text)
    let photoPrompt: string;
    
    if (prompt && allowText) {
      // Banner mode: use prompt exactly as provided, no restrictions
      photoPrompt = prompt;
    } else if (prompt) {
      // Article mode: add quality hints and NO TEXT restriction
      photoPrompt = `${prompt}. Photorealistic photography style, shot on professional camera, natural lighting, high resolution. NO people, NO faces, NO illustrations, NO cartoon, NO AI-looking art, NO TEXT, NO WORDS, NO LETTERS, NO WRITING.`;
    } else {
      const basePrompt = themePrompts[theme] || themePrompts['MUSIC'];
      photoPrompt = `${basePrompt} Photorealistic photography style, shot on professional camera, natural lighting, high resolution. NO illustrations, NO cartoon, NO AI-looking art, NO TEXT, NO WORDS, NO LETTERS, NO WRITING.`;
    }

    console.log("Using prompt for theme:", theme);

    // Use GPT Image 2 - state-of-the-art model (same as ChatGPT uses)
    const imageResponse = await openai.images.generate({
      model: "gpt-image-2",
      prompt: photoPrompt,
      n: 1,
      size: "1024x1024",
      quality: "medium",
    });

    const b64 = imageResponse.data?.[0]?.b64_json;
    const url = imageResponse.data?.[0]?.url;

    if (!b64 && !url) {
      return NextResponse.json({ success: false, error: "No image generated" }, { status: 500 });
    }

    let imageUrl: string;

    if (url) {
      // Already a URL - use directly
      imageUrl = url;
    } else if (b64) {
      // Convert base64 to Buffer, resize and compress to WebP
      const originalBuffer = Buffer.from(b64, 'base64');
      
      // Resize to 512x512 and convert to WebP (much smaller file size)
      const compressedBuffer = await sharp(originalBuffer)
        .resize(512, 512, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();
      
      // Upload to Cloudinary
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      
      const publicId = `images/ai-generated-${Date.now()}`;
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
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
      
      console.log(`Image compressed: ${originalBuffer.length} -> ${compressedBuffer.length} bytes (${Math.round(compressedBuffer.length / originalBuffer.length * 100)}%)`);
    } else {
      return NextResponse.json({ success: false, error: "No image data" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imageUrl
    });

  } catch (error: any) {
    console.error("Generate image error:", error);
    const errorMessage = error?.message || error?.toString() || "Failed to generate image";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
