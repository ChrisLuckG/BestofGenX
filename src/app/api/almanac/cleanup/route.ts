import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';

// Patterns that indicate this is NOT a real person
const INVALID_NAME_PATTERNS = [
  /^the\s/i,                    // "The World Cup", "The Beatles"
  /^top\s/i,                    // "Top World Cup"
  /\bcup\b/i,                   // World Cup, etc.
  /\bchampionship\b/i,          // Championship
  /\btournament\b/i,            // Tournament
  /\bleague\b/i,                // League
  /\bolympic/i,                 // Olympics
  /\bfestival\b/i,              // Festival
  /\baward/i,                   // Awards
  /\bshow\b$/i,                 // TV Show (at end)
  /\bseries\b$/i,               // Series (at end)
  /\bband\b$/i,                 // Band (at end)
  /\balbum\b$/i,                // Album (at end)
  /\bmovie\b$/i,                // Movie (at end)
  /\bfilm\b$/i,                 // Film (at end)
  /^\d+\s/,                     // Starts with number "1984 Olympics"
  /^[A-Z]{2,}\s/,               // Starts with acronym "FIFA World Cup"
];

// Check if a name looks like a real person
function isValidPersonName(firstname: string, lastname: string): boolean {
  const fullName = `${firstname} ${lastname}`.trim();
  
  // Must have both first and last name
  if (!firstname || !lastname || firstname.length < 2 || lastname.length < 2) {
    return false;
  }
  
  // Check against invalid patterns
  for (const pattern of INVALID_NAME_PATTERNS) {
    if (pattern.test(fullName) || pattern.test(firstname) || pattern.test(lastname)) {
      return false;
    }
  }
  
  // Names should be capitalized words, not all caps or all lowercase
  const isProperCase = (s: string) => /^[A-ZÀ-Ž][a-zà-ž]+$/.test(s);
  if (!isProperCase(firstname) && !/^[A-ZÀ-Ž]\.$/.test(firstname)) {
    // Allow "J." style initials
    return false;
  }
  
  return true;
}

// GET - List invalid entries
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'list' or 'count'
    
    // Get all people
    const allPeople = await Person.find({}).select('firstname lastname born countryBorn profession').lean();
    
    // Categorize issues
    const issues = {
      notAPerson: [] as any[],      // Events, things, not people
      noCountry: [] as any[],       // Missing country
      invalidDate: [] as any[],     // Invalid date format
      missingName: [] as any[],     // Missing first or last name
    };
    
    for (const p of allPeople) {
      const person = p as any;
      
      // Check if it's actually a person
      if (!isValidPersonName(person.firstname || '', person.lastname || '')) {
        issues.notAPerson.push(person);
        continue; // Don't double-count
      }
      
      // Check for missing name
      if (!person.firstname || !person.lastname) {
        issues.missingName.push(person);
        continue;
      }
      
      // Check for missing country
      if (!person.countryBorn || person.countryBorn === 'Unknown' || person.countryBorn === '') {
        issues.noCountry.push(person);
      }
      
      // Check for invalid date
      if (!person.born || !/^\d{4}-\d{2}-\d{2}$/.test(person.born)) {
        issues.invalidDate.push(person);
      }
    }
    
    const totalIssues = issues.notAPerson.length + issues.noCountry.length + 
                        issues.invalidDate.length + issues.missingName.length;
    
    if (action === 'count') {
      return NextResponse.json({ 
        success: true, 
        count: totalIssues,
        breakdown: {
          notAPerson: issues.notAPerson.length,
          noCountry: issues.noCountry.length,
          invalidDate: issues.invalidDate.length,
          missingName: issues.missingName.length,
        },
        // Show some examples of non-person entries
        notAPersonExamples: issues.notAPerson.slice(0, 5).map(p => `${p.firstname} ${p.lastname}`)
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      issues,
      count: totalIssues 
    });
  } catch (error: any) {
    console.error('Cleanup GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Remove invalid entries
export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'all', 'notAPerson', 'noCountry', 'invalidDate', 'missingName'
    
    // Get all people to check
    const allPeople = await Person.find({}).lean();
    
    const toDelete: string[] = [];
    
    for (const p of allPeople) {
      const person = p as any;
      let shouldDelete = false;
      
      switch (mode) {
        case 'notAPerson':
          shouldDelete = !isValidPersonName(person.firstname || '', person.lastname || '');
          break;
        case 'noCountry':
          shouldDelete = !person.countryBorn || person.countryBorn === 'Unknown' || person.countryBorn === '';
          break;
        case 'invalidDate':
          shouldDelete = !person.born || !/^\d{4}-\d{2}-\d{2}$/.test(person.born);
          break;
        case 'missingName':
          shouldDelete = !person.firstname || !person.lastname;
          break;
        case 'all':
          // Delete if ANY issue
          shouldDelete = !isValidPersonName(person.firstname || '', person.lastname || '') ||
                        !person.firstname || !person.lastname ||
                        !person.countryBorn || person.countryBorn === 'Unknown' ||
                        !person.born || !/^\d{4}-\d{2}-\d{2}$/.test(person.born);
          break;
        default:
          return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
      }
      
      if (shouldDelete) {
        toDelete.push(person._id.toString());
      }
    }
    
    // Delete all marked entries
    if (toDelete.length > 0) {
      await Person.deleteMany({ _id: { $in: toDelete } });
    }
    
    return NextResponse.json({ 
      success: true, 
      deleted: toDelete.length,
      message: `Deleted ${toDelete.length} invalid entries`
    });
  } catch (error: any) {
    console.error('Cleanup DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
