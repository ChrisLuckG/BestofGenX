import { NextResponse } from 'next/server';

// Printful doesn't need auto-publish - products are managed directly in the Printful dashboard
// This endpoint is kept for compatibility but does nothing
export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'Printful products are managed in the dashboard - no auto-publish needed',
    published: 0 
  });
}
