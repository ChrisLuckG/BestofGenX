import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Menschen from '@/models/Menschen';

// GET - List Menschen with optional filters
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const birthday = searchParams.get('birthday'); // DD.MM format
    const deathday = searchParams.get('deathday'); // DD.MM format
    const category = searchParams.get('category');
    const hasArticle = searchParams.get('hasArticle');
    const search = searchParams.get('search'); // Name search
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    const query: any = {};
    
    // Search by name (case-insensitive)
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    // Filter by birthday (day.month)
    if (birthday) {
      query.birthday = { $regex: `^${birthday}\\.` };
    }
    
    // Filter by deathday (day.month)
    if (deathday) {
      query.deathday = { $regex: `^${deathday}\\.` };
    }
    
    if (category) {
      query.category = category;
    }
    
    if (hasArticle === 'true') {
      query.hasArticle = true;
    } else if (hasArticle === 'false') {
      query.hasArticle = false;
    }
    
    const [menschen, total] = await Promise.all([
      Menschen.find(query)
        .sort({ discoveredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Menschen.countDocuments(query),
    ]);
    
    return NextResponse.json({
      success: true,
      menschen,
      total,
      hasMore: skip + menschen.length < total,
    });
  } catch (error) {
    console.error('Error fetching Menschen:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch Menschen' }, { status: 500 });
  }
}

// POST - Save a new Mensch (from proposal)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const {
      name,
      birthday,
      deathday,
      causeOfDeath,
      country,
      countryCode,
      category,
      profession,
      description,
      imageUrl,
      wikiUrl,
      discoveredBy,
      discoveredByName,
      discoveredFor, // 'birthday' or 'rip'
    } = body;
    
    if (!name || !discoveredBy || !discoveredByName || !discoveredFor) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: name, discoveredBy, discoveredByName, discoveredFor' 
      }, { status: 400 });
    }
    
    // Extract birth year and check if GenX
    const yearMatch = birthday?.match(/(\d{4})$/);
    const birthYear = yearMatch ? parseInt(yearMatch[1]) : null;
    const isGenX = birthYear ? (birthYear >= 1965 && birthYear <= 1980) : true;
    
    // Check if already exists (by name + birthday)
    const existing = await Menschen.findOne({ name, birthday: birthday || '' });
    if (existing) {
      return NextResponse.json({
        success: true,
        mensch: existing,
        alreadyExists: true,
        message: 'Person already in database',
      });
    }
    
    // Create new Mensch
    const mensch = await Menschen.create({
      name,
      birthday: birthday || '',
      deathday: deathday || '',
      causeOfDeath: causeOfDeath || '',
      country: country || '',
      countryCode: countryCode || '',
      category: category || 'unknown',
      profession: profession || '',
      description: description || '',
      imageUrl: imageUrl || '',
      wikiUrl: wikiUrl || '',
      discoveredBy,
      discoveredByName,
      discoveredFor,
      birthYear: birthYear || undefined,
      isGenX,
      hasArticle: false,
      isVerified: false,
      isRejected: false,
    });
    
    return NextResponse.json({
      success: true,
      mensch,
      alreadyExists: false,
      message: 'Person saved to Menschen database',
    });
  } catch (error: any) {
    // Handle duplicate key error
    if (error.code === 11000) {
      const existing = await Menschen.findOne({ 
        name: (await request.json()).name 
      });
      return NextResponse.json({
        success: true,
        mensch: existing,
        alreadyExists: true,
        message: 'Person already in database',
      });
    }
    
    console.error('Error saving Mensch:', error);
    return NextResponse.json({ success: false, error: 'Failed to save Mensch' }, { status: 500 });
  }
}

// PATCH - Update a Mensch (e.g., mark as having article)
export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { menschId, articleId, articleCreatedBy, ...updates } = body;
    
    if (!menschId) {
      return NextResponse.json({ success: false, error: 'menschId required' }, { status: 400 });
    }
    
    // If linking to article
    if (articleId) {
      updates.hasArticle = true;
      updates.articleId = articleId;
      updates.articleCreatedAt = new Date();
      if (articleCreatedBy) updates.articleCreatedBy = articleCreatedBy;
    }
    
    const mensch = await Menschen.findByIdAndUpdate(
      menschId,
      { $set: updates },
      { new: true }
    );
    
    if (!mensch) {
      return NextResponse.json({ success: false, error: 'Mensch not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, mensch });
  } catch (error) {
    console.error('Error updating Mensch:', error);
    return NextResponse.json({ success: false, error: 'Failed to update Mensch' }, { status: 500 });
  }
}
