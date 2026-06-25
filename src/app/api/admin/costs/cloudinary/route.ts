import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export async function GET() {
  const configured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  if (!configured) {
    return NextResponse.json({
      success: false,
      configured: false,
      error: 'CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET not set',
    });
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    const usage = await cloudinary.api.usage();
    return NextResponse.json({
      success: true,
      storage: usage.storage,
      bandwidth: usage.bandwidth,
      resources: usage.resources,
      transformations: usage.transformations,
      credits: usage.credits,
      plan: usage.plan,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, configured: true, error: error.message },
      { status: 500 }
    );
  }
}
