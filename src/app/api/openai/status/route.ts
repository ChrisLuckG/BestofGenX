import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  try {
    // Quick test call to check if API key works
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 5,
    });
    
    return NextResponse.json({ 
      success: true, 
      status: 'active',
      message: 'OpenAI API is working'
    });
  } catch (err: any) {
    const isQuotaError = err.code === 'insufficient_quota' || err.status === 429;
    const isAuthError = err.status === 401;
    
    return NextResponse.json({ 
      success: false, 
      status: isQuotaError ? 'quota_exceeded' : isAuthError ? 'invalid_key' : 'error',
      message: isQuotaError 
        ? '⚠️ OpenAI Quota aufgebraucht! Bitte Guthaben aufladen.'
        : isAuthError
        ? '🔑 OpenAI API Key ungültig!'
        : err.message,
      code: err.code,
    });
  }
}
