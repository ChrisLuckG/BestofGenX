import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import dbConnect from '@/lib/mongoose';
import { Person } from '@/models/Almanac';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROFESSIONS = ['Music', 'Actor', 'Sport', 'Politik', 'Art', 'Tech', 'Comedy', 'Model', 'Other'];

export async function POST(request: NextRequest) {
  try {
    await dbConnect();
    const { name, born, died, causeOfDeath, nationality, profession, context } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name required' }, { status: 400 });
    }

    // Clean the name - remove any description in parentheses or after comma
    let cleanName = name.trim()
      .replace(/\s*\([^)]*\)/g, '') // Remove (died 2024), (American wrestler), etc.
      .replace(/,.*$/, '') // Remove everything after comma
      .trim();
    
    // If name still looks like it has a description, extract just the name
    if (cleanName.includes(' - ') || cleanName.toLowerCase().includes('american') || 
        cleanName.toLowerCase().includes('british') || cleanName.toLowerCase().includes('singer') ||
        cleanName.toLowerCase().includes('actor') || cleanName.toLowerCase().includes('wrestler')) {
      // Try to extract just the proper name (capitalized words at start)
      const nameMatch = cleanName.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      if (nameMatch) cleanName = nameMatch[1];
    }

    const [firstname, ...rest] = cleanName.split(' ');
    const lastname = rest.join(' ') || '';
    
    // Validate: firstname and lastname should be proper names (not descriptions)
    if (!firstname || firstname.length < 2 || !lastname || lastname.length < 2) {
      return NextResponse.json({ success: false, error: 'Invalid name format - need first and last name' }, { status: 400 });
    }
    
    // Reject if name contains obvious non-name words
    const invalidWords = ['american', 'british', 'german', 'french', 'singer', 'actor', 'wrestler', 'driver', 'executive', 'politician', 'died', 'born'];
    if (invalidWords.some(w => firstname.toLowerCase().includes(w) || lastname.toLowerCase().includes(w))) {
      return NextResponse.json({ success: false, error: 'Name contains description - please provide clean name only' }, { status: 400 });
    }

    // Check if already exists (case-insensitive)
    const existing = await Person.findOne({
      firstname: { $regex: new RegExp(`^${firstname}$`, 'i') },
      lastname: { $regex: new RegExp(`^${lastname}$`, 'i') },
    });
    if (existing) {
      return NextResponse.json({ success: true, exists: true, person: existing });
    }

    // Build context from provided data
    let additionalContext = context || '';
    if (born) additionalContext += `\nBorn: ${born}`;
    if (died) additionalContext += `\nDied: ${died}`;
    if (causeOfDeath) additionalContext += `\nCause of death: ${causeOfDeath}`;
    if (nationality) additionalContext += `\nNationality: ${nationality}`;
    if (profession) additionalContext += `\nProfession: ${profession}`;

    // Generate profile with GPT-4o
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are a factual assistant. Generate a JSON profile for a celebrity/public figure. Output ONLY valid JSON, no markdown.\nSchema: {"firstname":"...","lastname":"...","born":"YYYY-MM-DD","died":"YYYY-MM-DD or null","causeOfDeath":"string or null","profession":"${PROFESSIONS.join('|')}","subcat":"e.g. Rock Singer, Boxer, Film Director","knownfor":"1-2 sentence summary","countryBorn":"country name","nationality":"nationality adjective","image":null}\nProfession must be EXACTLY one of: ${PROFESSIONS.join(', ')}\nCRITICAL: If this person is deceased, you MUST include their death date in "died" (format YYYY-MM-DD) and their cause of death in "causeOfDeath". NEVER leave "died" as null for someone who has passed away.\nIf birth/death dates are provided in the context, USE THEM exactly as given (convert DD.MM.YYYY to YYYY-MM-DD format).`,
        },
        { role: 'user', content: `Generate profile for: ${cleanName}${additionalContext ? `\nAdditional context: ${additionalContext}` : ''}` },
      ],
    });

    const raw = (completion.choices[0]?.message?.content || '').replace(/```json|```/g, '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: 'Could not generate profile' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Override with provided data if available (convert DD.MM.YYYY to YYYY-MM-DD)
    const convertDate = (d: string) => {
      if (!d) return null;
      const match = d.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      return d;
    };
    
    if (born) parsed.born = convertDate(born);
    if (died) parsed.died = convertDate(died);
    if (causeOfDeath) parsed.causeOfDeath = causeOfDeath;
    
    // Validate profession
    if (!PROFESSIONS.includes(parsed.profession)) parsed.profession = 'Other';
    // Only remove truly null/unknown fields — keep died if it has a value
    if (!parsed.died) delete parsed.died;
    if (!parsed.causeOfDeath) delete parsed.causeOfDeath;

    const person = await Person.create(parsed);
    return NextResponse.json({ success: true, created: true, person });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
