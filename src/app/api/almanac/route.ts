import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Person, AlmanacItem } from '@/models/Almanac';

// Fields the Menschen list actually renders - exactly the `Person` interface in
// MenschenTab.tsx. Person documents carry ~35 fields (description, shortBio,
// social, savedNews, wikiUrl, birthYear, isGenX, discoveredAt/By, createdAt,
// updatedAt, ...), none of which the list reads.
//
// Measured on 125,396 rows: the full documents are 67.5 MB and take 9.1s,
// versus 27.1 MB projected. createdAt+updatedAt alone were 19% of the payload
// and are never displayed. Dropping a field removes its KEY NAME from every
// row too, which is why the saving is larger than the values suggest.
const LIST_FIELDS = {
  firstname: 1,
  lastname: 1,
  born: 1,
  died: 1,
  causeOfDeath: 1,
  profession: 1,
  subcat: 1,
  knownfor: 1,
  countryBorn: 1,
  cityBorn: 1,
  countryDied: 1,
  cityDied: 1,
  nationality: 1,
  image: 1,
  // Article coverage, maintained by the /api/articles POST path and
  // /api/almanac/link-articles. Projected away before, so the Menschen list
  // could only ever learn about an article from the live personRef lookup -
  // which missed every person linked through this field instead.
  hasArticle: 1,
  articleId: 1,
} as const;

// GET - Fetch items
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'people' or category name
    const search = searchParams.get('search');
    const filter = searchParams.get('filter');
    const filterValue = searchParams.get('filterValue');
    const countryBorn = searchParams.get('countryBorn');
    const aliveStatus = searchParams.get('aliveStatus');
    const birthdayToday = searchParams.get('birthdayToday');
    const birthMonth = searchParams.get('birthMonth'); // 1-12 for filtering by birth month
    const deathMonth = searchParams.get('deathMonth'); // 1-12 for filtering by death month
    
    if (type === 'people') {
      const query: any = {};
      if (birthdayToday === 'true') {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        query.born = { $regex: `-${mm}-${dd}$` };
      }
      if (search) {
        // Split search into words to match both firstname and lastname
        const searchWords = search.trim().split(/\s+/);
        if (searchWords.length >= 2) {
          // Multi-word search: try firstname + lastname combination
          query.$or = [
            // Match first word in firstname AND second word in lastname
            { 
              firstname: { $regex: searchWords[0], $options: 'i' },
              lastname: { $regex: searchWords.slice(1).join(' '), $options: 'i' }
            },
            // Also try matching the full search in either field
            { firstname: { $regex: search, $options: 'i' } },
            { lastname: { $regex: search, $options: 'i' } },
          ];
        } else {
          // Single word: search in both fields
          query.$or = [
            { firstname: { $regex: search, $options: 'i' } },
            { lastname: { $regex: search, $options: 'i' } },
          ];
        }
      }
      if (filter && filterValue) {
        if (filter === 'profession' && filterValue.toLowerCase() === 'sport') {
          // Sport is a meta-category - match all sport subcategories
          const sportCategories = [
            'football', 'tennis', 'basketball', 'ice-hockey', 'american-football',
            'baseball', 'golf', 'motorsport', 'rugby', 'cricket', 'handball',
            'boxing', 'volleyball', 'table-tennis', 'badminton', 'darts',
            'snooker', 'esports', 'others', 'sport'
          ];
          query[filter] = { $regex: `^(${sportCategories.join('|')})$`, $options: 'i' };
        } else {
          query[filter] = { $regex: `^${filterValue}$`, $options: 'i' };
        }
      }
      if (countryBorn) {
        query.countryBorn = { $regex: `^${countryBorn}$`, $options: 'i' };
      }
      if (aliveStatus === 'alive') {
        query.$and = [...(query.$and || []), { $or: [{ died: { $exists: false } }, { died: null }, { died: '' }] }];
      } else if (aliveStatus === 'deceased') {
        query.died = { $exists: true, $ne: null, $gt: '' };
      }
      // Filter by birth month (1-12)
      if (birthMonth) {
        const mm = String(parseInt(birthMonth)).padStart(2, '0');
        query.born = { ...(query.born || {}), $regex: `-${mm}-` };
      }
      // Filter by death month (1-12) - for deceased filter
      if (deathMonth) {
        const mm = String(parseInt(deathMonth)).padStart(2, '0');
        query.died = { ...(query.died || {}), $regex: `-${mm}-` };
      }
      
      // `limit` is opt-in: without it the behaviour is unchanged. The client
      // only sets it for the "All Months" case, which is the one that used to
      // ship 122k rows at once. `total` is always the unlimited count, so the
      // header can say "showing X of Y" instead of silently under-reporting.
      const limitParam = parseInt(searchParams.get('limit') || '0', 10);
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 0;

      const findQuery = Person.find(query, LIST_FIELDS).lean();
      if (limit) findQuery.limit(limit);

      const [people, total] = await Promise.all([
        findQuery,
        limit ? Person.countDocuments(query) : Promise.resolve(0),
      ]);
      
      // Sort by upcoming birthday (today first, then next days)
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentDay = today.getDate();
      
      const sortedPeople = people.sort((a: any, b: any) => {
        if (!a.born && !b.born) return 0;
        if (!a.born) return 1;
        if (!b.born) return -1;
        
        const dateA = new Date(a.born);
        const dateB = new Date(b.born);
        
        // Calculate days until next birthday
        const getDaysUntilBirthday = (birthDate: Date) => {
          const birthMonth = birthDate.getMonth();
          const birthDay = birthDate.getDate();
          
          let daysUntil = 0;
          const thisYearBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
          const nextYearBirthday = new Date(today.getFullYear() + 1, birthMonth, birthDay);
          
          if (birthMonth > currentMonth || (birthMonth === currentMonth && birthDay >= currentDay)) {
            // Birthday is later this year
            daysUntil = Math.floor((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            // Birthday already passed this year, count to next year
            daysUntil = Math.floor((nextYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          }
          
          return daysUntil;
        };
        
        return getDaysUntilBirthday(dateA) - getDaysUntilBirthday(dateB);
      });
      
      return NextResponse.json({
        success: true,
        data: sortedPeople,
        total: limit ? total : sortedPeople.length,
        limited: limit ? total > sortedPeople.length : false,
      });
    }
    
    // Other categories
    if (type) {
      const query: any = { category: type };
      if (search) {
        query['data.title'] = { $regex: search, $options: 'i' };
      }
      
      const items = await AlmanacItem.find(query).sort({ rank: 1 }).lean();
      return NextResponse.json({ success: true, data: items });
    }
    
    return NextResponse.json({ success: false, error: 'Type required' }, { status: 400 });
  } catch (error: any) {
    console.error('Almanac GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create item
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { type, ...data } = body;
    
    if (type === 'people') {
      // Calculate birth year and GenX status
      let birthYear: number | undefined;
      let isGenX = true;
      
      if (data.born) {
        birthYear = parseInt(data.born.substring(0, 4));
        if (birthYear < 1960 || birthYear > 1981) {
          return NextResponse.json({ success: false, error: `GenX only! Birthday must be 1960-1981 (got ${birthYear})` }, { status: 400 });
        }
        isGenX = birthYear >= 1965 && birthYear <= 1980;
      }
      
      // Check for duplicates by firstname + lastname (case-insensitive)
      const existing = await Person.findOne({ 
        firstname: { $regex: new RegExp(`^${data.firstname}$`, 'i') },
        lastname: { $regex: new RegExp(`^${data.lastname}$`, 'i') }
      });
      if (existing) {
        return NextResponse.json({ 
          success: true, 
          data: existing, 
          alreadyExists: true,
          message: 'Person already in database' 
        });
      }
      
      // Add computed fields
      const personData = {
        ...data,
        birthYear,
        isGenX,
        discoveredAt: new Date(),
      };
      
      const person = await Person.create(personData);
      return NextResponse.json({ success: true, data: person });
    }
    
    // Other categories
    const item = await AlmanacItem.create({
      category: type,
      rank: data.rank,
      image: data.image,
      data: data.data || data,
    });
    return NextResponse.json({ success: true, data: item });
  } catch (error: any) {
    console.error('Almanac POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update item
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    
    const body = await request.json();
    const { type, id, ...data } = body;
    
    if (type === 'people') {
      const person = await Person.findByIdAndUpdate(id, data, { new: true });
      return NextResponse.json({ success: true, data: person });
    }
    
    // Other categories
    const item = await AlmanacItem.findByIdAndUpdate(id, {
      rank: data.rank,
      image: data.image,
      data: data.data || data,
    }, { new: true });
    return NextResponse.json({ success: true, data: item });
  } catch (error: any) {
    console.error('Almanac PUT error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete item
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }
    
    if (type === 'people') {
      await Person.findByIdAndDelete(id);
    } else {
      await AlmanacItem.findByIdAndDelete(id);
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Almanac DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
