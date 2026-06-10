import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

// Test endpoint to verify email sending works
// DELETE THIS FILE AFTER TESTING!
export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get('to') || 'contact@bestofgenx.com';
  
  const result = await sendEmail(
    to,
    'BOGX Test Email',
    `<h1>Test Email</h1><p>If you see this, email sending works! Time: ${new Date().toISOString()}</p>`
  );

  return NextResponse.json({ 
    success: result.success, 
    to,
    error: result.error || null,
    timestamp: new Date().toISOString()
  });
}
