import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

// Generate a history banner image with date calendar and event thumbnails

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

interface HistoryEvent {
  title: string;
  year: number;
  category: string;
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
    const monthShort = MONTH_SHORT[now.getMonth()];
    const day = now.getDate();

    // Build event list for the prompt - each event as a polaroid/photo
    const eventList = events.slice(0, 6).map(e => `"${e.title} (${e.year})"`).join(', ');

    const prompt = `A dramatic wide cinematic banner for "${month} ${day}" in history.

CENTER ELEMENT (REQUIRED):
- In the EXACT CENTER: A large vintage tear-off desk calendar
- Calendar shows "${monthShort}" on top in red, and big bold "${day}" below in black
- Calendar is the FOCAL POINT - prominent and clearly visible
- Classic paper calendar style with metal ring binding at top

SURROUNDING PHOTOS - These SPECIFIC events (not generic history):
${events.slice(0, 4).map(e => `- Photo representing: ${e.title}`).join('\n')}

LAYOUT:
- Calendar centered, photos arranged around it
- Photos are vintage sepia-toned polaroids with white borders
- Photos overlap slightly behind the calendar

STYLE:
- Warm sepia and golden-brown tones
- Aged parchment background
- Film grain, nostalgic 80s/90s feel

RULES:
- The ONLY text allowed is "${monthShort}" and "${day}" on the calendar
- NO other text, captions, labels, or titles anywhere
- NO clocks, watches, compasses, cameras, typewriters`;

    // Try up to 2 times with retry on failure
    let response: any = null;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`History banner generation attempt ${attempt}/2`);
        response = await openai.images.generate({
          model: "gpt-image-1",  // Faster, consistent style
          prompt,
          n: 1,
          size: "1024x1024",  // Square, faster generation
          quality: "medium",  // Much faster, still good quality
        } as Parameters<typeof openai.images.generate>[0]) as any;
        break; // Success, exit loop
      } catch (err: any) {
        lastError = err;
        console.error(`Attempt ${attempt} failed:`, err?.message || err);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
        }
      }
    }
    
    if (!response) {
      return NextResponse.json({ 
        success: false, 
        error: `Image generation failed: ${lastError?.message || 'Unknown error'}` 
      });
    }

    // Handle both URL and base64 responses
    let imageUrl = response.data?.[0]?.url;
    const b64Json = response.data?.[0]?.b64_json;
    
    if (!imageUrl && b64Json) {
      // Compress and upload to Cloudinary instead of storing huge base64
      try {
        const originalBuffer = Buffer.from(b64Json, 'base64');
        
        // Crop to 21:9 aspect ratio (1200x514) and convert to WebP
        const compressedBuffer = await sharp(originalBuffer)
          .resize(1200, 514, { fit: 'cover', position: 'center' })
          .webp({ quality: 80 })
          .toBuffer();
        
        console.log(`History banner compressed: ${originalBuffer.length} -> ${compressedBuffer.length} bytes`);
        
        // Upload to Cloudinary
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        
        const publicId = `images/history-banner-${Date.now()}`;
        const uploadResult = await new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { public_id: publicId, resource_type: 'image', folder: 'bestofgenx' },
            (error, result) => error ? reject(error) : resolve(result)
          );
          uploadStream.end(compressedBuffer);
        });
        
        imageUrl = uploadResult.secure_url;
      } catch (uploadErr) {
        console.error("Failed to compress/upload history banner:", uploadErr);
        return NextResponse.json({ success: false, error: "Failed to process image" });
      }
    }
    
    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "Failed to generate image" });
    }

    // Generate a catchy headline that summarizes all events
    const headlineCompletion = await openai.chat.completions.create({
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
Keep it under 10 words after the date. Be creative but not cheesy.`
        },
        { 
          role: "user", 
          content: `Create a headline for ${month} ${day} that captures these events:\n${events.map(e => `- ${e.title} (${e.year})`).join('\n')}`
        }
      ],
      temperature: 0.8,
      max_tokens: 50,
    });

    const headline = headlineCompletion.choices[0]?.message?.content?.trim() || `${month} ${day}: Moments That Shaped History`;

    return NextResponse.json({
      success: true,
      imageUrl,
      headline,
      date: `${month} ${day}`,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate history banner";
    console.error("history-banner error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
