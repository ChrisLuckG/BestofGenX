import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

// Generate a history banner image with date calendar and event thumbnails

// gpt-image-2 at quality "high" takes ~2 minutes for a 1536x1024 image, plus the
// Cloudinary upload and the headline call. Without this the route dies on the
// platform's default serverless timeout (~10-15s) - it only appears to work
// locally because `next dev` has no limit.
export const maxDuration = 300;

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
        // This is a WIDE banner, so it must be generated in landscape.
        // It used to be generated square (1024x1024) and then cropped to 21:9,
        // which threw away ~57% of the height and cut straight through the
        // centre calendar and the polaroids around it.
        response = await openai.images.generate({
          model: "gpt-image-2",   // newest image model available on this account
          prompt,
          n: 1,
          size: "1536x1024",      // landscape 3:2
          quality: "high",        // highest quality tier
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
    const openaiUrl = response.data?.[0]?.url;
    const b64Json = response.data?.[0]?.b64_json;

    const persistBanner = async (sourceBuffer: Buffer): Promise<string> => {
      // Keep the generated 3:2 landscape frame instead of cropping to 21:9.
      // The old 1200x514 crop cut the centre calendar in half; a light trim to
      // 16:9 keeps the composition intact and still reads as a wide banner.
      // Full 1536px width is kept - 1200px looked soft on desktop.
      const processed = await sharp(sourceBuffer)
        .resize(1536, 864, { fit: 'cover', position: 'center' })
        .webp({ quality: 92 })
        .toBuffer();

      console.log(`History banner: ${sourceBuffer.length} -> ${processed.length} bytes (1536x864 webp q92)`);

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
        uploadStream.end(processed);
      });
      return uploadResult.secure_url;
    };

    // base64 is handled first because that is what gpt-image-* returns. A URL from
    // OpenAI is only a short-lived link that expires within the hour, so it is
    // downloaded and pushed to Cloudinary rather than stored directly - storing it
    // would leave the article with a dead image.
    let imageUrl: string | undefined;
    try {
      if (b64Json) {
        imageUrl = await persistBanner(Buffer.from(b64Json, 'base64'));
      } else if (openaiUrl) {
        const dl = await fetch(openaiUrl);
        if (!dl.ok) {
          console.error('Failed to download generated banner:', dl.status);
          return NextResponse.json({ success: false, error: "Failed to download image" });
        }
        imageUrl = await persistBanner(Buffer.from(await dl.arrayBuffer()));
      }
    } catch (uploadErr) {
      console.error("Failed to compress/upload history banner:", uploadErr);
      return NextResponse.json({ success: false, error: "Failed to process image" });
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
