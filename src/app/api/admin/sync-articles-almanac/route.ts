import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Article from '@/models/Article';
import { Person } from '@/models/Almanac';
import { countryNameToCode } from '@/lib/countryFlags';

// POST - Sync articles with Almanac data
export async function POST() {
  try {
    await dbConnect();
    
    // Get all published articles without personBirthday
    const articles = await Article.find({
      status: 'published',
      $or: [
        { personBirthday: { $exists: false } },
        { personBirthday: null },
        { personBirthday: '' }
      ]
    }).lean();
    
    // Get all Almanac people
    const people = await Person.find({}).lean();
    
    // Create lookup map by full name (lowercase)
    const peopleByName = new Map<string, any>();
    for (const p of people) {
      const fullName = `${p.firstname} ${p.lastname}`.toLowerCase().trim();
      peopleByName.set(fullName, p);
    }
    
    let updated = 0;
    let notFound = 0;
    const results: { title: string; matched: boolean; person?: string }[] = [];
    
    for (const article of articles) {
      let person = null;
      
      // First try personName if set
      if (article.personName) {
        const searchName = article.personName.toLowerCase().trim();
        person = peopleByName.get(searchName);
      }
      
      // Then try to find person name in title
      if (!person && article.title) {
        const titleLower = article.title.toLowerCase().trim();
        const entries = Array.from(peopleByName.entries());
        for (const [name, p] of entries) {
          // Check if the full name appears in the title
          if (titleLower.includes(name)) {
            person = p;
            break;
          }
        }
      }
      
      if (person && person.born) {
        // Convert ISO date (YYYY-MM-DD) to DD.MM.YYYY
        const [year, month, day] = person.born.split('-');
        const birthday = `${day}.${month}.${year}`;
        
        // Get country code
        const countryCode = countryNameToCode(person.countryBorn || '');
        
        // Update article
        await Article.findByIdAndUpdate(article._id, {
          personBirthday: birthday,
          personName: `${person.firstname} ${person.lastname}`,
          personCountry: person.countryBorn || '',
          personCountryCode: countryCode || ''
        });
        
        results.push({ 
          title: article.title, 
          matched: true, 
          person: `${person.firstname} ${person.lastname} (${birthday})` 
        });
        updated++;
      } else {
        results.push({ title: article.title, matched: false });
        notFound++;
      }
    }
    
    return NextResponse.json({
      success: true,
      totalArticles: articles.length,
      totalPeople: people.length,
      updated,
      notFound,
      results
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET - Preview what would be synced
export async function GET() {
  try {
    await dbConnect();
    
    const articlesWithoutBday = await Article.countDocuments({
      status: 'published',
      $or: [
        { personBirthday: { $exists: false } },
        { personBirthday: null },
        { personBirthday: '' }
      ]
    });
    
    const articlesWithBday = await Article.countDocuments({
      status: 'published',
      personBirthday: { $exists: true, $ne: null, $gt: '' }
    });
    
    const totalPeople = await Person.countDocuments({});
    
    return NextResponse.json({
      success: true,
      articlesWithoutBirthday: articlesWithoutBday,
      articlesWithBirthday: articlesWithBday,
      totalPeopleInAlmanac: totalPeople
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
