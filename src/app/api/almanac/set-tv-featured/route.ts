import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import TVVideo from '@/models/TVVideo';
import { Person } from '@/models/Almanac';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    const { personId, personName, profession, videoId, title, duration, type, featuredPosition } = await req.json();
    
    if (!personId || !videoId || !featuredPosition) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    
    // 1. Clear this featuredPosition from any existing video
    await TVVideo.updateMany(
      { featuredPosition },
      { $set: { featuredPosition: null } }
    );
    
    // 2. Check if this person's video already exists in TVVideo
    let tvVideo = await TVVideo.findOne({ youtubeId: videoId });
    
    if (tvVideo) {
      // Update existing
      tvVideo.featuredPosition = featuredPosition;
      tvVideo.active = true;
      await tvVideo.save();
    } else {
      // Create new TVVideo entry
      tvVideo = await TVVideo.create({
        title: title || `${personName} - ${type || 'Documentary'}`,
        description: `${type || 'Documentary'} about ${personName} (${profession})`,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        youtubeId: videoId,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        category: 'GenX',
        duration: duration || '',
        language: 'en',
        featured: true,
        featuredPosition,
        active: true,
      });
    }
    
    // 3. Update the person's featuredVideoIndex
    const videoIndex = featuredPosition - 1; // Position 1,2,3 -> index 0,1,2
    await Person.updateOne(
      { _id: personId },
      { $set: { featuredVideoIndex: videoIndex } }
    );
    
    return NextResponse.json({ 
      success: true, 
      tvVideo,
      message: `Video set as featured #${featuredPosition}` 
    });
    
  } catch (error: any) {
    console.error('Set TV featured error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
