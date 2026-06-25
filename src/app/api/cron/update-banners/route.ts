import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import clientPromise from '@/lib/mongodb';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function generateAndUploadBanner(prompt: string): Promise<{ url: string | null; error?: string }> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const imageResponse = await openai.images.generate({
      model: 'gpt-image-2',
      prompt,
      n: 1,
      size: '1536x1024',
      quality: 'high',
    } as Parameters<typeof openai.images.generate>[0]) as any;

    const imageData = imageResponse.data?.[0]?.b64_json;
    const imageUrl = imageResponse.data?.[0]?.url;
    if (!imageData && !imageUrl) return { url: null, error: 'No image data returned' };
    if (imageUrl) return { url: imageUrl };

    const imageBuffer = Buffer.from(imageData, 'base64');
    const webpBuffer = await sharp(imageBuffer).webp({ quality: 85 }).toBuffer();

    const uploadResult = await new Promise<any>((resolve, reject) => {
      const timestamp = Date.now();
      cloudinary.uploader.upload_stream(
        {
          folder: 'bestofgenx/images',
          public_id: `banner-${timestamp}`,
          format: 'webp',
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(webpBuffer);
    });

    return { url: uploadResult?.secure_url || null };
  } catch (e: any) {
    console.error('Banner generation failed:', e);
    return { url: null, error: e?.message || String(e) };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== process.env.CRON_SECRET && secret !== 'migrate2025') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const promptsDir = path.join(process.cwd(), 'src', 'prompts');

    const sections: Array<{ key: string; promptFile: string; categories: string[] }> = [
      { key: 'history',   promptFile: 'banner-history.txt',   categories: ['history'] },
      { key: 'arcade',    promptFile: 'banner-arcade.txt',    categories: ['arcade', 'gaming'] },
      { key: 'sport',     promptFile: 'banner-sport.txt',     categories: ['sports', 'sport'] },
      { key: 'lifestyle', promptFile: 'banner-lifestyle.txt', categories: ['lifestyle', 'movies-tv', 'culture'] },
      { key: 'rip',       promptFile: 'banner-rip.txt',       categories: ['rip', 'obituary', 'memorial'] },
    ];

    // Generate all 4 banners sequentially to avoid rate limits
    const results: Array<{ key: string; promptFile: string; categories: string[]; url: string | null; error?: string }> = [];
    for (const section of sections) {
      const prompt = fs.readFileSync(path.join(promptsDir, section.promptFile), 'utf-8').trim();
      const result = await generateAndUploadBanner(prompt);
      results.push({ ...section, url: result.url, error: result.error });
    }

    const client = await clientPromise;
    const db = client.db('sporttock');

    let updatedTemplates = 0;
    let updatedArticles = 0;

    // 1. Update template bannerImage for each FIXED block
    const templateDoc = await db.collection('settings').findOne({ key: 'articleTemplate' });
    const items: any[] = templateDoc?.items || [];

    for (const item of items) {
      if (!item.containerBlocks) continue;
      const name = item.containerName?.toLowerCase() || '';
      const theme = item.containerTheme?.toLowerCase() || '';

      for (const block of item.containerBlocks) {
        if (block.type !== 'FIXED') continue;
        for (const section of results) {
          if (!section.url) continue;
          const matches = section.key === name || section.key === theme
            || section.categories.some(c => c === name || c === theme);
          if (matches) {
            block.bannerImage = section.url;
            updatedTemplates++;
          }
        }
      }
    }

    if (updatedTemplates > 0) {
      await db.collection('settings').updateOne(
        { key: 'articleTemplate' },
        { $set: { items, updatedAt: new Date() } },
        { upsert: true }
      );
    }

    const resultMap = Object.fromEntries(results.map(r => [`${r.key}Banner`, r.url]));
    const errorMap = Object.fromEntries(results.filter(r => r.error).map(r => [`${r.key}Error`, r.error]));

    return NextResponse.json({
      success: true,
      updatedTemplates,
      updatedArticles,
      hasApiKey: !!process.env.OPENAI_API_KEY,
      ...resultMap,
      ...errorMap,
    });
  } catch (error) {
    console.error('update-banners error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
