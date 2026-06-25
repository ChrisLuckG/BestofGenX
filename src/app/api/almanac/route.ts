import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Person, AlmanacItem } from '@/models/Almanac';

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
    
    if (type === 'people') {
      const query: any = {};
      if (search) {
        query.$or = [
          { firstname: { $regex: search, $options: 'i' } },
          { lastname: { $regex: search, $options: 'i' } },
        ];
      }
      if (filter && filterValue) {
        query[filter] = { $regex: `^${filterValue}$`, $options: 'i' };
      }
      if (countryBorn) {
        query.countryBorn = { $regex: `^${countryBorn}$`, $options: 'i' };
      }
      
      const people = await Person.find(query).lean();
      
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
      
      return NextResponse.json({ success: true, data: sortedPeople });
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
      if (data.born) {
        const year = parseInt(data.born.substring(0, 4));
        if (year < 1960 || year > 1981) {
          return NextResponse.json({ success: false, error: `GenX only! Birthday must be 1960-1981 (got ${year})` }, { status: 400 });
        }
      }
      const person = await Person.create(data);
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
