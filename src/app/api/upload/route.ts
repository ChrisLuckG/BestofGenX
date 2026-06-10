import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success: rateLimitOk } = checkRateLimit(`upload:${ip}`, RATE_LIMITS.upload.limit, RATE_LIMITS.upload.window);
    if (!rateLimitOk) {
      return NextResponse.json({ success: false, error: 'Too many uploads. Please wait.' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large. Max 50MB.' }, { status: 400 });
    }

    // Validate file type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Only images and MP4/WebM allowed.' }, { status: 400 });
    }

    // Clean filename and add timestamp to avoid conflicts
    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 100); // Limit filename length
    const folder = isVideo ? 'videos' : 'images';
    const blobPath = `${folder}/${timestamp}_${cleanName}`;
    
    // Upload directly to Vercel Blob (no slow list/delete operation)
    const blob = await put(blobPath, file, {
      access: 'public',
    });

    // Add cache-busting query param
    const urlWithCacheBust = `${blob.url}?v=${timestamp}`;
    
    return NextResponse.json({ 
      success: true, 
      url: urlWithCacheBust,
      filename: cleanName 
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
