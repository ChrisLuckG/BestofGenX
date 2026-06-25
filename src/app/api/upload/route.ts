import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import sharp from 'sharp';

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

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
    
    let fileBuffer = Buffer.from(await file.arrayBuffer());
    let contentType = file.type;
    let finalName = cleanName;
    
    // Compress images (except SVG and GIF)
    if (isImage && !['image/svg+xml', 'image/gif'].includes(file.type)) {
      try {
        const metadata = await sharp(fileBuffer).metadata();
        const maxDimension = 1200; // Max width/height for uploaded images
        
        // Only resize if larger than max
        let sharpInstance = sharp(fileBuffer);
        if (metadata.width && metadata.width > maxDimension) {
          sharpInstance = sharpInstance.resize(maxDimension, undefined, { withoutEnlargement: true });
        }
        
        // Convert to WebP for better compression
        const compressed = await sharpInstance.webp({ quality: 85 }).toBuffer();
        fileBuffer = compressed as Buffer<ArrayBuffer>;
        contentType = 'image/webp';
        finalName = cleanName.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        
        console.log(`Image compressed: ${file.size} -> ${fileBuffer.length} bytes`);
      } catch (compressError) {
        console.error('Image compression failed, using original:', compressError);
        // Continue with original file if compression fails
      }
    }
    
    const publicId = `${folder}/${timestamp}_${finalName.replace(/\.[^.]+$/, '')}`;
    
    // Upload to Cloudinary
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: isVideo ? 'video' : 'image',
          folder: 'bestofgenx',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(fileBuffer);
    });

    // Cloudinary URL with cache-busting
    const urlWithCacheBust = `${uploadResult.secure_url}?v=${timestamp}`;
    
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
