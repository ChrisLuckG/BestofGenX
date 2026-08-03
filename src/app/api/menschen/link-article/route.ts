import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Menschen from '@/models/Menschen';

// POST - Link an article to a Menschen entry
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { name, birthday, articleId, articleCreatedBy } = body;
    
    if (!name || !birthday || !articleId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: name, birthday, articleId' 
      }, { status: 400 });
    }
    
    // Find the Menschen entry by name and birthday
    const mensch = await Menschen.findOneAndUpdate(
      { name, birthday },
      { 
        $set: {
          hasArticle: true,
          articleId,
          articleCreatedAt: new Date(),
          articleCreatedBy,
        }
      },
      { new: true }
    );
    
    if (!mensch) {
      // Person not in database yet - create them
      const newMensch = await Menschen.create({
        name,
        birthday,
        country: 'Unknown',
        description: 'Created when article was saved',
        discoveredBy: articleCreatedBy || 'system',
        discoveredByName: 'System',
        discoveredFor: 'birthday',
        hasArticle: true,
        articleId,
        articleCreatedAt: new Date(),
        articleCreatedBy,
      });
      
      return NextResponse.json({
        success: true,
        mensch: newMensch,
        created: true,
        message: 'Person created and linked to article',
      });
    }
    
    return NextResponse.json({
      success: true,
      mensch,
      created: false,
      message: 'Article linked to existing person',
    });
  } catch (error) {
    console.error('Error linking article to Menschen:', error);
    return NextResponse.json({ success: false, error: 'Failed to link article' }, { status: 500 });
  }
}
