import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Find duplicates (same firstname + lastname, case-insensitive)
async function findDuplicates(): Promise<{ duplicateGroups: any[]; totalDuplicates: number }> {
  const allPeople = await Person.find({}).lean();
  
  // Group by normalized name
  const nameMap: Record<string, any[]> = {};
  for (const p of allPeople) {
    const person = p as any;
    const key = `${(person.firstname || '').toLowerCase().trim()}|${(person.lastname || '').toLowerCase().trim()}`;
    if (!nameMap[key]) {
      nameMap[key] = [];
    }
    nameMap[key].push(person);
  }
  
  // Find groups with more than one entry
  const duplicateGroups: any[] = [];
  let totalDuplicates = 0;
  
  for (const key of Object.keys(nameMap)) {
    const group = nameMap[key];
    if (group.length > 1) {
      duplicateGroups.push({
        name: `${group[0].firstname} ${group[0].lastname}`,
        count: group.length,
        entries: group.map((p: any) => ({
          _id: p._id,
          born: p.born,
          countryBorn: p.countryBorn,
          hasArticle: p.hasArticle,
          createdAt: p.createdAt
        }))
      });
      totalDuplicates += group.length - 1; // Count extras (keep one)
    }
  }
  
  return { duplicateGroups, totalDuplicates };
}

// Remove duplicates, keeping the best entry (most complete data, or has article)
async function removeDuplicates(): Promise<{ removed: number; details: string[] }> {
  const allPeople = await Person.find({}).lean();
  
  // Group by normalized name
  const nameMap: Record<string, any[]> = {};
  for (const p of allPeople) {
    const person = p as any;
    const key = `${(person.firstname || '').toLowerCase().trim()}|${(person.lastname || '').toLowerCase().trim()}`;
    if (!nameMap[key]) {
      nameMap[key] = [];
    }
    nameMap[key].push(person);
  }
  
  const toDelete: string[] = [];
  const details: string[] = [];
  
  for (const key of Object.keys(nameMap)) {
    const group = nameMap[key];
    if (group.length > 1) {
      // Score each entry - higher is better
      const scored = group.map((p: any) => {
        let score = 0;
        if (p.hasArticle) score += 100; // Has article is most important
        if (p.born && /^\d{4}-\d{2}-\d{2}$/.test(p.born)) score += 10;
        if (p.countryBorn && p.countryBorn !== 'Unknown') score += 10;
        if (p.image) score += 5;
        if (p.cityBorn) score += 2;
        if (p.knownfor) score += 2;
        return { person: p, score };
      });
      
      // Sort by score descending
      scored.sort((a: { person: any; score: number }, b: { person: any; score: number }) => b.score - a.score);
      
      // Keep the first (best), delete the rest
      const keep = scored[0].person;
      const deleteThese = scored.slice(1).map((s: { person: any; score: number }) => s.person);
      
      for (const d of deleteThese) {
        toDelete.push(d._id.toString());
      }
      
      details.push(`${keep.firstname} ${keep.lastname}: kept 1, removed ${deleteThese.length}`);
    }
  }
  
  if (toDelete.length > 0) {
    await Person.deleteMany({ _id: { $in: toDelete } });
  }
  
  return { removed: toDelete.length, details };
}

// GET - List entries that need fixing
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'list' or 'count'
    
    // Find entries with issues
    const invalidEntries = await Person.find({
      $or: [
        { countryBorn: { $in: [null, '', 'Unknown'] } },
        { born: { $not: /^\d{4}-\d{2}-\d{2}$/ } },
      ]
    }).select('firstname lastname born countryBorn profession knownfor').lean();
    
    // Find duplicates
    const { duplicateGroups, totalDuplicates } = await findDuplicates();
    
    if (action === 'count') {
      return NextResponse.json({ 
        success: true, 
        count: invalidEntries.length + totalDuplicates,
        breakdown: {
          noCountry: invalidEntries.filter(e => !e.countryBorn || e.countryBorn === 'Unknown').length,
          invalidDate: invalidEntries.filter(e => !e.born || !/^\d{4}-\d{2}-\d{2}$/.test(e.born || '')).length,
          duplicates: totalDuplicates,
        },
        duplicateExamples: duplicateGroups.slice(0, 5).map(g => `${g.name} (${g.count}x)`)
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      entries: invalidEntries,
      duplicateGroups,
      count: invalidEntries.length + totalDuplicates
    });
  } catch (error: any) {
    console.error('Fix GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Fix entries using AI and/or remove duplicates
export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'all', 'noCountry', 'invalidDate', 'duplicates'
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Handle duplicates removal
    if (mode === 'duplicates') {
      const { removed, details } = await removeDuplicates();
      return NextResponse.json({
        success: true,
        fixed: removed,
        total: removed,
        results: details.slice(0, 20).map(d => ({ name: d, status: 'removed duplicate' })),
        message: `Removed ${removed} duplicate entries`
      });
    }
    
    let query: any = {};
    
    switch (mode) {
      case 'noCountry':
        query = { countryBorn: { $in: [null, '', 'Unknown'] } };
        break;
      case 'invalidDate':
        query = { born: { $not: /^\d{4}-\d{2}-\d{2}$/ } };
        break;
      case 'all':
        // First remove duplicates
        const dupResult = await removeDuplicates();
        
        // Then fix missing data
        query = {
          $or: [
            { countryBorn: { $in: [null, '', 'Unknown'] } },
            { born: { $not: /^\d{4}-\d{2}-\d{2}$/ } },
          ]
        };
        break;
      default:
        return NextResponse.json({ success: false, error: 'Invalid mode. Use: all, noCountry, invalidDate, duplicates' }, { status: 400 });
    }
    
    const entries = await Person.find(query).limit(limit).lean();
    
    // Track duplicates removed in 'all' mode
    let duplicatesRemoved = 0;
    if (mode === 'all') {
      const { removed } = await removeDuplicates();
      duplicatesRemoved = removed;
    }
    
    if (entries.length === 0 && duplicatesRemoved === 0) {
      return NextResponse.json({ success: true, fixed: 0, message: 'No entries to fix' });
    }
    
    let fixed = 0;
    const results: { name: string; status: string; changes?: any }[] = [];
    
    // Add duplicate removal results
    if (duplicatesRemoved > 0) {
      results.push({ name: `${duplicatesRemoved} Duplikate`, status: 'removed' });
      fixed += duplicatesRemoved;
    }
    
    if (entries.length === 0) {
      return NextResponse.json({
        success: true,
        fixed,
        total: fixed,
        results,
        message: `Fixed ${fixed} entries`
      });
    }
    
    // Process in batches of 10 for efficiency
    const batchSize = 10;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      // Build prompt for batch
      const peopleList = batch.map((p, idx) => 
        `${idx + 1}. ${p.firstname} ${p.lastname} (${p.profession || 'Unknown profession'}${p.knownfor ? `, known for: ${p.knownfor}` : ''})`
      ).join('\n');
      
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 2000,
          messages: [
            {
              role: 'system',
              content: `You are a factual assistant. For each celebrity, provide their birth date and country of birth.
Output ONLY valid JSON array, no markdown. Each item must have:
- index: number (1-based, matching input)
- born: "YYYY-MM-DD" format (exact date, not just year)
- countryBorn: country name (e.g., "USA", "UK", "Germany")
- cityBorn: city name if known (optional)

If you cannot find accurate information for someone, use null for that field.
Example: [{"index":1,"born":"1965-06-18","countryBorn":"USA","cityBorn":"Los Angeles"},{"index":2,"born":"1970-03-15","countryBorn":"UK","cityBorn":null}]`
            },
            { role: 'user', content: `Find birth dates and countries for these GenX celebrities:\n${peopleList}` }
          ],
        });
        
        const raw = (completion.choices[0]?.message?.content || '').replace(/```json|```/g, '').trim();
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          for (const item of parsed) {
            const person = batch[item.index - 1];
            if (!person) continue;
            
            const updates: any = {};
            
            // Fix birth date if needed and we have valid data
            if (item.born && /^\d{4}-\d{2}-\d{2}$/.test(item.born)) {
              const currentBorn = person.born || '';
              if (!/^\d{4}-\d{2}-\d{2}$/.test(currentBorn)) {
                updates.born = item.born;
                // Calculate birth year
                updates.birthYear = parseInt(item.born.substring(0, 4));
                updates.isGenX = updates.birthYear >= 1965 && updates.birthYear <= 1980;
              }
            }
            
            // Fix country if needed and we have valid data
            if (item.countryBorn && (!person.countryBorn || person.countryBorn === 'Unknown')) {
              updates.countryBorn = item.countryBorn;
              updates.nationality = item.countryBorn;
            }
            
            // Add city if provided
            if (item.cityBorn && !person.cityBorn) {
              updates.cityBorn = item.cityBorn;
            }
            
            // Apply updates if any
            if (Object.keys(updates).length > 0) {
              await Person.findByIdAndUpdate(person._id, { $set: updates });
              fixed++;
              results.push({
                name: `${person.firstname} ${person.lastname}`,
                status: 'fixed',
                changes: updates
              });
            } else {
              results.push({
                name: `${person.firstname} ${person.lastname}`,
                status: 'no changes needed or no data found'
              });
            }
          }
        }
      } catch (batchErr: any) {
        console.error('Batch fix error:', batchErr.message);
        batch.forEach(p => {
          results.push({
            name: `${p.firstname} ${p.lastname}`,
            status: 'error: ' + batchErr.message
          });
        });
      }
      
      // Small delay between batches
      if (i + batchSize < entries.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      fixed,
      total: entries.length + duplicatesRemoved,
      results,
      message: `Fixed ${fixed} entries`
    });
  } catch (error: any) {
    console.error('Fix POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
