import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  
  // Parse date or use today
  const date = dateParam ? new Date(dateParam) : new Date();
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Create SVG calendar tear-off style
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="paperGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#FFF8F0;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#F5E6D3;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="headerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#E36B11;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#B86E2A;stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="3" dy="5" stdDeviation="8" flood-opacity="0.3"/>
        </filter>
        <filter id="innerShadow">
          <feOffset dx="0" dy="2"/>
          <feGaussianBlur stdDeviation="2" result="offset-blur"/>
          <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
          <feFlood flood-color="black" flood-opacity="0.1" result="color"/>
          <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
          <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="400" height="400" fill="#2A2A2A"/>
      
      <!-- Calendar paper with shadow -->
      <g filter="url(#shadow)">
        <!-- Main calendar body -->
        <rect x="50" y="60" width="300" height="300" rx="8" fill="url(#paperGrad)"/>
        
        <!-- Header bar -->
        <rect x="50" y="60" width="300" height="70" rx="8" fill="url(#headerGrad)"/>
        <rect x="50" y="100" width="300" height="30" fill="url(#headerGrad)"/>
        
        <!-- Binding holes -->
        <circle cx="100" cy="50" r="8" fill="#1A1A1A"/>
        <circle cx="200" cy="50" r="8" fill="#1A1A1A"/>
        <circle cx="300" cy="50" r="8" fill="#1A1A1A"/>
        
        <!-- Binding rings -->
        <ellipse cx="100" cy="55" rx="12" ry="15" fill="none" stroke="#888" stroke-width="4"/>
        <ellipse cx="200" cy="55" rx="12" ry="15" fill="none" stroke="#888" stroke-width="4"/>
        <ellipse cx="300" cy="55" rx="12" ry="15" fill="none" stroke="#888" stroke-width="4"/>
      </g>
      
      <!-- Month text -->
      <text x="200" y="105" font-family="Georgia, serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">${month.toUpperCase()}</text>
      
      <!-- Day number - big and bold -->
      <text x="200" y="250" font-family="Georgia, serif" font-size="140" font-weight="bold" fill="#E36B11" text-anchor="middle">${day}</text>
      
      <!-- Weekday -->
      <text x="200" y="320" font-family="Georgia, serif" font-size="24" fill="#666" text-anchor="middle">${weekday}</text>
      
      <!-- "On This Day" subtitle -->
      <text x="200" y="350" font-family="Arial, sans-serif" font-size="14" fill="#999" text-anchor="middle" letter-spacing="3">ON THIS DAY IN HISTORY</text>
      
      <!-- Torn paper effect at bottom -->
      <path d="M50,355 Q60,360 70,355 Q80,350 90,355 Q100,360 110,355 Q120,350 130,355 Q140,360 150,355 Q160,350 170,355 Q180,360 190,355 Q200,350 210,355 Q220,360 230,355 Q240,350 250,355 Q260,360 270,355 Q280,350 290,355 Q300,360 310,355 Q320,350 330,355 Q340,360 350,355 L350,360 L50,360 Z" fill="url(#paperGrad)"/>
    </svg>
  `;
  
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400', // Cache for 1 day
    },
  });
}
