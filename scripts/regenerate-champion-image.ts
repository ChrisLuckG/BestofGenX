import dbConnect from '../src/lib/mongoose';
import Article from '../src/models/Article';
import { buildChampionImagePrompt } from '../src/lib/championImagePrompt';

async function regenerateImage() {
  await dbConnect();
  
  // Find today's Daily Champions article (covers yesterday's winners)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tag = `daily-winners-${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  
  console.log('Looking for article with tag:', tag);
  
  const article = await Article.findOne({ tags: tag });
  
  if (!article) {
    console.log('No article found for today');
    process.exit(1);
  }
  
  console.log('Found article:', article.title);
  console.log('Current image:', article.coverImage);
  
  // Generate new image
  const dayOfWeek = new Date().getDay(); // Today's day determines the theme
  const prompt = buildChampionImagePrompt(dayOfWeek);
  
  console.log('\nGenerating new image for day', dayOfWeek);
  console.log('Prompt:', prompt.substring(0, 100) + '...');
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  const response = await fetch(`${baseUrl}/api/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, style: 'article', aspectRatio: 'landscape' }),
  });
  
  if (!response.ok) {
    console.error('Image generation failed:', response.status);
    process.exit(1);
  }
  
  const data = await response.json();
  
  if (!data.success || !data.imageUrl) {
    console.error('No image URL returned:', data);
    process.exit(1);
  }
  
  console.log('\nNew image URL:', data.imageUrl);
  
  // Update article
  await Article.findByIdAndUpdate(article._id, {
    coverImage: data.imageUrl,
    thumbnailUrl: data.imageUrl,
  });
  
  console.log('\n✅ Article updated with new image!');
  process.exit(0);
}

regenerateImage().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
