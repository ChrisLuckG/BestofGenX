import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';
import Article from '@/models/Article';

// GET - Check how many articles could be linked
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get all articles that have personName but might not be linked
    const articles = await Article.find({
      $or: [
        { personName: { $exists: true, $nin: [null, ''] } },
        { title: { $regex: /birthday|geburtstag|rip|memorial/i } }
      ]
    }).select('title personName personBirthday createdAt').lean();
    
    // Get all people
    const people = await Person.find({}).select('firstname lastname hasArticle articleId').lean();
    
    // Find potential matches
    const potentialLinks: { article: string; person: string; matched: boolean }[] = [];
    
    for (const article of articles) {
      const personName = (article as any).personName || '';
      const title = (article as any).title || '';
      
      // Try to find matching person
      for (const person of people) {
        const fullName = `${person.firstname} ${person.lastname}`.toLowerCase();
        const searchName = personName.toLowerCase() || title.toLowerCase();
        
        if (searchName.includes(fullName) || fullName.includes(searchName.split(' ').slice(0, 2).join(' '))) {
          potentialLinks.push({
            article: (article as any).title,
            person: `${person.firstname} ${person.lastname}`,
            matched: !!(person as any).hasArticle
          });
          break;
        }
      }
    }
    
    const unlinked = potentialLinks.filter(l => !l.matched);
    
    return NextResponse.json({
      success: true,
      totalArticles: articles.length,
      totalPeople: people.length,
      potentialLinks: potentialLinks.length,
      alreadyLinked: potentialLinks.filter(l => l.matched).length,
      unlinked: unlinked.length,
      samples: unlinked.slice(0, 10)
    });
  } catch (error: any) {
    console.error('Link check error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Link articles to people
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    // Get all articles
    const articles = await Article.find({}).select('_id title personName personBirthday createdAt').lean();
    
    let linked = 0;
    const results: { article: string; person: string; status: string }[] = [];
    
    for (const article of articles) {
      const personName = (article as any).personName || '';
      const title = (article as any).title || '';
      
      if (!personName && !title) continue;
      
      // Try to find matching person by name
      let person = null;
      
      if (personName) {
        const nameParts = personName.trim().split(/\s+/);
        const firstname = nameParts[0] || '';
        const lastname = nameParts.slice(1).join(' ') || '';
        
        if (firstname && lastname) {
          person = await Person.findOne({
            firstname: { $regex: new RegExp(`^${firstname}$`, 'i') },
            lastname: { $regex: new RegExp(`^${lastname}$`, 'i') }
          });
        }
      }
      
      // Fallback: search by title
      if (!person && title) {
        // Extract potential names from title (capitalized words)
        const words = title.match(/[A-ZÀ-Ž][a-zà-ž]+/g) || [];
        if (words.length >= 2) {
          // Try combinations
          for (let i = 0; i < words.length - 1; i++) {
            person = await Person.findOne({
              firstname: { $regex: new RegExp(`^${words[i]}$`, 'i') },
              lastname: { $regex: new RegExp(`^${words[i + 1]}$`, 'i') }
            });
            if (person) break;
          }
        }
      }
      
      if (person) {
        // Check if already linked
        if ((person as any).hasArticle && (person as any).articleId?.toString() === (article as any)._id.toString()) {
          results.push({
            article: title,
            person: `${person.firstname} ${person.lastname}`,
            status: 'already linked'
          });
          continue;
        }
        
        // Link the article to the person
        await Person.findByIdAndUpdate(person._id, {
          hasArticle: true,
          articleId: (article as any)._id,
          articleCreatedAt: (article as any).createdAt
        });
        
        linked++;
        results.push({
          article: title,
          person: `${person.firstname} ${person.lastname}`,
          status: 'linked'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      linked,
      total: articles.length,
      results: results.slice(0, 50),
      message: `Linked ${linked} articles to people`
    });
  } catch (error: any) {
    console.error('Link articles error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
