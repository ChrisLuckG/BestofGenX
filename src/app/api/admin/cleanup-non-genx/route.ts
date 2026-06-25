import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';

export async function POST() {
  try {
    await dbConnect();
    
    // Find all people with birth year outside Gen X range (1965-1980)
    const allPeople = await Person.find({});
    
    const toDelete: string[] = [];
    const deleted: string[] = [];
    
    for (const person of allPeople) {
      if (person.born) {
        const birthYear = parseInt(person.born.substring(0, 4));
        if (birthYear < 1965 || birthYear > 1980) {
          toDelete.push(`${person.firstname} ${person.lastname} (${birthYear})`);
          await Person.deleteOne({ _id: person._id });
          deleted.push(`${person.firstname} ${person.lastname}`);
        }
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      deleted: deleted.length,
      names: deleted
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
