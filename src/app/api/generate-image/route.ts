import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

// gpt-image-2 at quality "high" needs ~2 minutes, well past the platform's
// default serverless timeout. Without this the route dies mid-generation in
// production while appearing to work locally (`next dev` has no limit).
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    const { topic, theme, prompt, style, allowText, aspectRatio } = await request.json();

    console.log("Generating image for topic:", topic, "theme:", theme, "prompt:", prompt, "allowText:", allowText);

    // Theme-specific image prompts (no people/celebrities to avoid safety filters)
    const themePrompts: Record<string, string> = {
      'MUSIC': 'Retro 80s 90s music aesthetic. Vinyl records, cassette tapes, boombox, neon lights, synthesizers, concert stage lights. Vaporwave synthwave style. NO people, NO faces.',
      'MOVIES': 'Retro cinema aesthetic. Film reels, movie theater seats, popcorn, clapperboard, Hollywood spotlights, red carpet. Cinematic dramatic lighting. NO people, NO faces.',
      'TV SHOWS': 'Retro TV aesthetic. Old CRT television sets, VHS tapes, TV antennas, living room 90s style, remote controls. Nostalgic warm lighting. NO people, NO faces.',
      'SPORTS': 'Retro sports aesthetic. Stadium lights, trophies, sports equipment, grass field, scoreboard, championship banners. Dynamic dramatic lighting. NO people, NO faces.',
      'GAMING': 'Elegant trivia knowledge aesthetic. A glowing 3D brain on a cream/beige pedestal, soft purple and lavender accents, floating question marks, lightbulb icons, trophy. Clean minimalist cream background with subtle purple gradients. Soft studio lighting, elegant and sophisticated. NO dark colors, NO neon, NO arcade machines.',
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
      // Article mode: add quality hints, faces allowed
      photoPrompt = `${prompt}. Ultra high quality, sharp details, crisp image, professional photography, 8K resolution, cinematic lighting. NO blurry, NO washed out, NO low quality.`;
    } else {
      const basePrompt = themePrompts[theme] || themePrompts['MUSIC'];
      photoPrompt = `${basePrompt} Ultra high quality, sharp details, crisp image, professional photography, 8K resolution, cinematic lighting. NO blurry, NO washed out, NO low quality.`;
    }

    console.log("Using prompt for theme:", theme);

    // Determine image size based on aspectRatio parameter
    // gpt-image-2 supports: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait)
    let imageSize: "1024x1024" | "1536x1024" | "1024x1536" = "1024x1024";
    if (aspectRatio === 'landscape' || aspectRatio === '16:9' || aspectRatio === '21:9') {
      imageSize = "1536x1024"; // Closest to wide/landscape format
    } else if (aspectRatio === 'portrait') {
      imageSize = "1024x1536";
    }
    
    // gpt-image-2 is the newest image model available on this account.
    const imageResponse = await openai.images.generate({
      model: "gpt-image-2",
      prompt: photoPrompt,
      n: 1,
      size: imageSize,
      quality: "high",
    } as Parameters<typeof openai.images.generate>[0]) as any;

    const b64 = imageResponse.data?.[0]?.b64_json;
    const url = imageResponse.data?.[0]?.url;

    if (!b64 && !url) {
      return NextResponse.json({ success: false, error: "No image generated" }, { status: 500 });
    }

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const persistImage = async (sourceBuffer: Buffer): Promise<string> => {
      // The generated resolution is kept as-is. It used to be halved
      // (1536x1024 -> 768x512), which threw away half the detail that
      // quality:"high" just paid for and looked soft as an article cover.
      // Cloudinary can still downscale on delivery when a small variant is needed.
      const processed = await sharp(sourceBuffer)
        .webp({ quality: 90 })
        .toBuffer();

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
        uploadStream.end(processed);
      });

      console.log(`Image ${imageSize}: ${sourceBuffer.length} -> ${processed.length} bytes (webp q90)`);
      return uploadResult.secure_url;
    };

    // base64 first - that is what gpt-image-* returns. A URL from OpenAI is only a
    // short-lived link that expires within the hour; it used to be stored directly,
    // which would leave the article with a dead image. It is downloaded and pushed
    // to Cloudinary instead.
    let imageUrl: string;
    if (b64) {
      imageUrl = await persistImage(Buffer.from(b64, 'base64'));
    } else {
      const dl = await fetch(url as string);
      if (!dl.ok) {
        return NextResponse.json({ success: false, error: "Failed to download generated image" }, { status: 500 });
      }
      imageUrl = await persistImage(Buffer.from(await dl.arrayBuffer()));
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
