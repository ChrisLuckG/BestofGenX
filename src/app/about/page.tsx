"use client";

import DynamicPage from "@/components/DynamicPage";

const DEFAULT_CONTENT = `
<div class="text-center mb-8">
  <img src="/images/genxlogo1.png" alt="Best of GenX" class="h-16 mx-auto mb-4" />
  <h2 class="text-2xl font-bold text-gray-900 mb-2">Welcome to Best of GenX</h2>
  <p class="text-gray-600">The ultimate nostalgia platform for Generation X</p>
</div>

<h3>Who We Are</h3>
<p>
  Best of GenX is an entertainment platform built by and for Generation X. 
  We celebrate the music, movies, TV shows, games, and culture that defined our generation - 
  the 80s, 90s, and early 2000s.
</p>

<h3>What We Offer</h3>
<ul>
  <li><strong>Quiz Battles</strong> - Test your knowledge against other GenXers</li>
  <li><strong>Curated Playlists</strong> - The best music from our era on Spotify</li>
  <li><strong>Articles & Stories</strong> - Deep dives into pop culture nostalgia</li>
  <li><strong>Predictions & Voting</strong> - Share your opinions with the community</li>
  <li><strong>Rewards</strong> - Earn points and unlock exclusive content</li>
</ul>

<h3>Our Mission</h3>
<p>
  We believe that Generation X deserves a dedicated space to celebrate and share 
  the cultural moments that shaped us. From MTV to Nintendo, from grunge to hip-hop, 
  we're here to keep those memories alive.
</p>

<h3>Contact Us</h3>
<p>
  Have questions, feedback, or just want to say hi?<br/>
  Email us at <a href="mailto:contact@bestofgenx.com">contact@bestofgenx.com</a>
</p>

<p class="text-xs text-gray-500 mt-8 text-center">
  © 2026 Best of GenX · For Generation X
</p>
`;

export default function AboutPage() {
  return (
    <DynamicPage 
      slug="about" 
      defaultTitle="About Us" 
      defaultContent={DEFAULT_CONTENT} 
    />
  );
}
