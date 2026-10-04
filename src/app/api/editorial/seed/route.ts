import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import ReporterProfile from '@/models/ReporterProfile';
import bcrypt from 'bcryptjs';

// FOUR reporters, one per author voice.
//
// This was nine, spread over nine regions, and five of them pointed at writing styles
// that no longer exist - two ('bill-bryson', and 'chimamanda-ngozi-adichie' in the
// ranking route) never had a brief at all, so those reporters were writing in the
// fallback voice while the newsroom listed them as distinct personalities.
//
// The four voices are the four kinds of funny (see lib/authorStylePrompts.ts), and each
// reporter owns one of them plus the beats that came with the retired reporters. Region
// spread is kept where it costs nothing, but coverage now follows the voice, not the map.
const DEFAULT_REPORTERS = [
  {
    name: 'Frank Scottish',
    slug: 'frank-scottish',
    nationality: 'Wales, UK',
    country: 'UK',
    countryFlag: '🏴',
    countryCode: 'gb-wls',
    region: 'united-kingdom',
    specialty: 'Sports · Boxing · Football',
    role: 'journalist',
    politicalTendency: 'Slightly right of center',
    // Absorbed from Marcus Wellington (rugby, cricket, outdoor culture).
    responsibilities: 'Sports of every kind: Football, Boxing, MMA, Rugby, Cricket, Olympics. Working-class heroes, pub culture, British nostalgia, the outdoors. Homepage sport section. Also handles BOGX product feedback from a regular-user perspective.',
    writingStyle: 'irvine-welsh',
    personality: 'Sarcastic, street-smart, cynical, brutally honest, working-class humour. Loves underdogs. Hates corporate nonsense. Reads like a bloke telling stories after three beers. No Scottish dialect — clean English.',
  },
  {
    name: 'Kristina Losandra',
    slug: 'kristina-losandra',
    nationality: 'Sydney, Australia',
    country: 'Australia',
    countryFlag: '🇦🇺',
    countryCode: 'au',
    region: 'oceania',
    specialty: 'RIP · Celebrities · Movies',
    role: 'journalist',
    politicalTendency: 'Center-left',
    // Absorbed from Amara Okonkwo (music, diaspora culture) - the warm register.
    responsibilities: 'RIP articles, Celebrities, TV, Movies, Music worldwide including Afrobeat and non-Western scenes. Warm human-interest stories. Social media for lifestyle content. Covers the emotional side of GenX culture — the losses, the comebacks, the nostalgia.',
    writingStyle: 'nora-ephron',
    personality: 'Warm, funny, empathetic, never sentimental. Makes people smile instead of cry. Elegant but accessible.',
  },
  {
    name: 'Robert Crombaker',
    slug: 'robert-crombaker',
    nationality: 'Berlin, Germany',
    country: 'Germany',
    countryFlag: '🇩🇪',
    countryCode: 'de',
    region: 'europe',
    specialty: 'Culture · Music · Gaming · Editor',
    role: 'journalist',
    politicalTendency: 'Left',
    // Absorbed from Jolie Clarkson (music, indie, gaming), Kazuo Sato (tech, anime,
    // games) and Gustavo Madrina (lifestyle, travel, food).
    responsibilities: 'Culture, Society, Music, Indie, Gaming, Tech, Anime, Lifestyle, Travel, Food. The generalist who can write about anything from a human angle. Also acts as Editor reviewing other reporters\' work. Covers the big picture stuff.',
    writingStyle: 'benjamin-stuckrad-barre',
    personality: 'Dry humour, self-ironic, intelligent, media-savvy. Name-drops constantly. Mixes high and low culture in the same sentence. Hates fake people and corporate culture.',
  },
  {
    name: 'Katharina Obslewskina',
    slug: 'katharina-obslewskina',
    nationality: 'Warsaw, Poland',
    country: 'Poland',
    countryFlag: '🇵🇱',
    countryCode: 'pl',
    region: 'europe',
    specialty: 'Politics · History · Europe',
    role: 'journalist',
    politicalTendency: 'Conservative',
    responsibilities: 'Politics, History, Europe, Society. Analytical deep-dives. Fact Checker for the whole team. Covers the harder, more serious side of GenX history and current events.',
    writingStyle: 'slavenka-drakulic',
    personality: 'Sharp, intelligent, direct. Dry ironic humour — the joke that is also an indictment. No emotional manipulation. European lens. Challenges lazy thinking.',
  },
];

/**
 * Reporters that used to be seeded and are now retired. Their User accounts are kept
 * (articles reference them as author, and deleting the user would orphan the byline),
 * but the ReporterProfile is removed and isAIReporter is cleared so they disappear from
 * the newsroom. Without this the seed - which only ever upserts - would leave all nine
 * in place and the reduction to four would exist only in this file.
 */
const RETIRED_REPORTER_SLUGS = [
  'gustavo-madrina',
  'jolie-clarkson',
  'kazuo-sato',
  'amara-okonkwo',
  'marcus-wellington',
];

export async function POST() {
  try {
    await dbConnect();

    const results = [];
    for (const reporter of DEFAULT_REPORTERS) {
      try {
        const username = `ai_${reporter.slug}`.slice(0, 20);
        const email = `${reporter.slug}@bogx-editorial.internal`;
        // Placeholder stored in DB — full prompt generated fresh in chat route
        const systemPrompt = `You are ${reporter.name}, ${reporter.role} at BOGX. ${reporter.personality}`;

        let userId: string | null = null;

        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) {
          userId = existing._id.toString();
          // Update all fields including country/nationality and displayName
          await User.collection.updateOne(
            { _id: existing._id },
            { $set: { 
              isAIReporter: true, 
              isAuthor: true, 
              displayName: reporter.name,
              country: reporter.country,
              countryFlag: reporter.countryFlag,
              bio: `AI Reporter at BOGX. ${reporter.nationality}. ${reporter.specialty}.` 
            } }
          );
        } else {
          // Create new reporter user
          const hashedPassword = await bcrypt.hash(`bogx_${reporter.slug}_seed`, 8);
          const avatar = `https://api.dicebear.com/7.x/personas/svg?seed=${reporter.slug}&backgroundColor=E36B11`;
          const user = await User.create({
            username,
            email,
            password: hashedPassword,
            displayName: reporter.name,
            avatar,
            country: reporter.country,
            countryFlag: reporter.countryFlag,
            isAuthor: true,
            isAIReporter: true,
            isBot: false,
            emailVerified: true,
            bio: `AI Reporter at BOGX. ${reporter.nationality}. ${reporter.specialty}.`,
          });
          userId = user._id.toString();
        }

        // Create or update ReporterProfile
        await ReporterProfile.findOneAndUpdate(
          { slug: reporter.slug },
          {
            $set: {
              userId,
              slug: reporter.slug,
              role: reporter.role,
              region: reporter.region,
              nationality: reporter.nationality,
              countryFlag: reporter.countryFlag,
              countryCode: reporter.countryCode,
              specialty: reporter.specialty,
              politicalTendency: reporter.politicalTendency,
              responsibilities: reporter.responsibilities,
              writingStyle: reporter.writingStyle,
              personality: reporter.personality,
              systemPrompt,
            },
            $setOnInsert: { memories: [], articleCount: 0 },
          },
          { upsert: true, new: true, strict: false }
        );

        results.push({ name: reporter.name, status: existing ? 'updated' : 'created' });
      } catch (reporterError: any) {
        console.error(`Seed error for ${reporter.name}:`, reporterError?.message);
        results.push({ name: reporter.name, status: 'error', error: reporterError?.message });
      }
    }

    // Retire the reporters that are no longer part of the four. The User survives so
    // existing bylines keep resolving; only the newsroom presence goes away.
    for (const slug of RETIRED_REPORTER_SLUGS) {
      try {
        const profile = await ReporterProfile.findOne({ slug });
        if (!profile) continue;
        if (profile.userId) {
          await User.findByIdAndUpdate(profile.userId, { $set: { isAIReporter: false } });
        }
        await ReporterProfile.deleteOne({ slug });
        results.push({ name: slug, status: 'retired' });
      } catch (retireError: any) {
        console.error(`Retire error for ${slug}:`, retireError?.message);
        results.push({ name: slug, status: 'error', error: retireError?.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Editorial seed error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Seed failed' }, { status: 500 });
  }
}
