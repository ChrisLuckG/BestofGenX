const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config({ path: '.env.local' });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadBase64ToCloudinary(base64String, articleId) {
  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder: 'bestofgenx/articles',
      public_id: `article_${articleId}_${Date.now()}`,
    });
    return result.secure_url;
  } catch (err) {
    console.error('Upload failed:', err.message);
    return null;
  }
}

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Article = mongoose.model('Article', new mongoose.Schema({}, { strict: false }));
  
  // Find articles with base64 images
  const articles = await Article.find({
    $or: [
      { coverImage: { $regex: '^data:image' } },
      { thumbnailUrl: { $regex: '^data:image' } },
    ]
  }).lean();
  
  console.log(`Found ${articles.length} articles with base64 images\n`);
  
  for (const art of articles) {
    console.log(`Processing: ${art.title?.substring(0, 50)}`);
    
    const updates = {};
    
    // Upload coverImage if base64
    if (art.coverImage?.startsWith('data:image')) {
      console.log('  Uploading coverImage...');
      const url = await uploadBase64ToCloudinary(art.coverImage, art._id);
      if (url) {
        updates.coverImage = url;
        console.log('  ✓ coverImage uploaded');
      }
    }
    
    // Upload thumbnailUrl if base64
    if (art.thumbnailUrl?.startsWith('data:image')) {
      console.log('  Uploading thumbnailUrl...');
      // Use same URL as cover if they were identical
      if (art.thumbnailUrl === art.coverImage && updates.coverImage) {
        updates.thumbnailUrl = updates.coverImage;
        console.log('  ✓ thumbnailUrl = coverImage');
      } else {
        const url = await uploadBase64ToCloudinary(art.thumbnailUrl, art._id);
        if (url) {
          updates.thumbnailUrl = url;
          console.log('  ✓ thumbnailUrl uploaded');
        }
      }
    }
    
    // Update article
    if (Object.keys(updates).length > 0) {
      await Article.updateOne({ _id: art._id }, { $set: updates });
      console.log('  ✓ Article updated\n');
    }
  }
  
  console.log('Done!');
  process.exit(0);
});
