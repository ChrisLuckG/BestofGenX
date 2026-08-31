// Simple script to regenerate today's Daily Champions image via API

const CHAMPION_THEMES = [
  // Sunday - Retro Arcade
  `Elegant retro arcade championship scene. Warm cream #F5F0E8 background with soft purple #7C3AED gradient accents. Vintage 80s arcade cabinet silhouettes, glowing pixel stars, subtle geometric patterns. Art deco inspired composition with golden light rays. Dreamy nostalgic atmosphere, soft bokeh lights.`,
  // Monday - Synthwave Sunset
  `Synthwave sunset landscape with purple and orange gradient sky. Retro grid floor stretching to horizon, palm tree silhouettes. Warm cream #F5F0E8 foreground elements, neon purple #7C3AED accents. 80s Miami Vice aesthetic, dreamy atmosphere, geometric sun rays.`,
  // Tuesday - Vintage TV Studio
  `Vintage 1980s TV game show studio scene. Warm cream #F5F0E8 stage with purple #7C3AED spotlights and curtains. Retro microphones, old CRT monitors, studio lights creating bokeh. Art deco patterns, glamorous Hollywood golden age feel.`,
  // Wednesday - Space Invaders
  `Retro space scene with pixel art asteroids and stars. Deep purple #7C3AED cosmos with warm cream #F5F0E8 celestial bodies. Vintage spacecraft silhouettes, 8-bit aesthetic, glowing nebula clouds. Dreamy cosmic atmosphere, soft gradients.`,
  // Thursday - Vinyl Records
  `Vintage vinyl record collection scene. Warm cream #F5F0E8 background with purple #7C3AED vinyl records and album covers. Retro turntable silhouette, musical notes floating, 80s disco ball reflections. Nostalgic music lover aesthetic.`,
  // Friday - Neon City
  `Retro futuristic cityscape at dusk. Purple #7C3AED neon signs and buildings against warm cream #F5F0E8 sky. Art deco skyscrapers, vintage cars silhouettes, rain-slicked streets reflecting lights. Blade Runner meets Miami aesthetic.`,
  // Saturday - Victory Celebration
  `Elegant victory celebration scene. Warm cream #F5F0E8 background with purple #7C3AED confetti and streamers. Vintage champagne glasses, art deco fireworks, golden sparkles. Glamorous 1920s meets 1980s party atmosphere.`,
];

async function main() {
  const baseUrl = 'http://localhost:3000';
  
  // Use the correct article ID for "Daily Champions: Sunday, August 23"
  const articleId = '6a8bf4a0d5ba5e3e65ee969d';
  
  console.log('Updating Daily Champions article:', articleId);
  
  // Get current article info
  const articleRes = await fetch(`${baseUrl}/api/articles/${articleId}`);
  const articleData = await articleRes.json();
  
  if (!articleData.article) {
    console.error('Article not found');
    return;
  }
  
  console.log('Title:', articleData.article.title);
  console.log('Current image:', articleData.article.coverImage?.substring(0, 80) + '...');
  
  // Generate new image
  const dayOfWeek = new Date().getDay();
  const themeBase = CHAMPION_THEMES[dayOfWeek];
  const prompt = `${themeBase} Minimalist illustration style, no people, no faces, no text. Clean sophisticated design with purple and cream color harmony.`;
  
  const dayNames = ['Sunday (Retro Arcade)', 'Monday (Synthwave Sunset)', 'Tuesday (Vintage TV)', 'Wednesday (Space)', 'Thursday (Vinyl)', 'Friday (Neon City)', 'Saturday (Victory)'];
  console.log('\nGenerating new image with theme:', dayNames[dayOfWeek]);
  console.log('Prompt preview:', prompt.substring(0, 100) + '...');
  
  console.log('\n⏳ Generating image (this takes ~1-2 minutes)...');
  
  const imgRes = await fetch(`${baseUrl}/api/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, style: 'article', aspectRatio: 'landscape' }),
  });
  
  if (!imgRes.ok) {
    console.error('Image generation failed:', imgRes.status, await imgRes.text());
    return;
  }
  
  const imgData = await imgRes.json();
  
  if (!imgData.success || !imgData.imageUrl) {
    console.error('No image URL:', imgData);
    return;
  }
  
  console.log('\n✅ New image generated:', imgData.imageUrl);
  
  // Update article via admin API
  const updateRes = await fetch(`${baseUrl}/api/articles/${articleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      coverImage: imgData.imageUrl,
      thumbnailUrl: imgData.imageUrl 
    }),
  });
  
  if (!updateRes.ok) {
    console.error('Update failed:', updateRes.status, await updateRes.text());
    return;
  }
  
  console.log('\n🎉 Article updated with new Synthwave Sunset image!');
  console.log('Refresh the page to see the new banner.');
}

main().catch(console.error);
