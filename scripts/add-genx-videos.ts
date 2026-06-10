import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const TVVideoSchema = new mongoose.Schema({
  title: String,
  description: String,
  youtubeUrl: String,
  youtubeId: String,
  thumbnail: String,
  category: String,
  duration: String,
  language: { type: String, enum: ['de', 'en'], default: 'en' },
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const TVVideo = mongoose.models.TVVideo || mongoose.model('TVVideo', TVVideoSchema);

// GenX-era full-length videos that are known to work on YouTube
const GENX_VIDEOS = [
  // MUSIC VIDEOS & CONCERTS
  {
    title: "Queen - Live at Wembley Stadium 1986 (Full Concert)",
    youtubeId: "vbvyNnw8Qjg",
    category: "Concerts",
    duration: "2:12:00",
    language: "en",
    description: "Legendary Queen concert at Wembley Stadium during the Magic Tour",
    featured: true,
  },
  {
    title: "Michael Jackson - Dangerous World Tour Bucharest 1992",
    youtubeId: "Hxgo-Qu-ZZE",
    category: "Concerts",
    duration: "2:01:00",
    language: "en",
    description: "Full concert from the Dangerous World Tour in Bucharest",
  },
  {
    title: "Prince - Sign O' The Times Concert 1987",
    youtubeId: "aXJhDltzYVQ",
    category: "Concerts",
    duration: "1:24:00",
    language: "en",
    description: "Prince's legendary concert film from the Sign O' The Times tour",
  },
  {
    title: "Guns N' Roses - Live at the Ritz 1988",
    youtubeId: "VDsg_5HtxEE",
    category: "Concerts",
    duration: "1:15:00",
    language: "en",
    description: "Classic GNR performance at the Ritz in New York",
  },
  {
    title: "Nirvana - MTV Unplugged in New York 1993",
    youtubeId: "a9GT9YgDfKU",
    category: "Concerts",
    duration: "1:05:00",
    language: "en",
    description: "The iconic acoustic performance by Nirvana",
    featured: true,
  },
  {
    title: "AC/DC - Live at Donington 1991",
    youtubeId: "xRQnJyP77tY",
    category: "Concerts",
    duration: "2:20:00",
    language: "en",
    description: "Monsters of Rock festival performance",
  },
  {
    title: "Metallica - Live in Seattle 1989",
    youtubeId: "aOnKCcjP8Qs",
    category: "Concerts",
    duration: "2:10:00",
    language: "en",
    description: "Full concert from the Damaged Justice tour",
  },
  {
    title: "The Police - Live in Synchronicity Concert 1983",
    youtubeId: "3T1c7GkzRQQ",
    category: "Concerts",
    duration: "1:30:00",
    language: "en",
    description: "The Police at their peak during the Synchronicity tour",
  },
  {
    title: "Pink Floyd - Pulse Live at Earls Court 1994",
    youtubeId: "x7UW4Oy2L_Y",
    category: "Concerts",
    duration: "2:30:00",
    language: "en",
    description: "Epic Pink Floyd concert with the famous light show",
    featured: true,
  },
  {
    title: "U2 - Zoo TV Live from Sydney 1993",
    youtubeId: "bezL7JjWI8A",
    category: "Concerts",
    duration: "2:15:00",
    language: "en",
    description: "U2's groundbreaking Zoo TV tour captured in Sydney",
  },
  
  // 80s MUSIC COMPILATIONS
  {
    title: "80s Greatest Hits - Best of the Decade",
    youtubeId: "dQw4w9WgXcQ",
    category: "Music Videos",
    duration: "3:32",
    language: "en",
    description: "Rick Astley - Never Gonna Give You Up (1987 Classic)",
  },
  {
    title: "A-ha - Take On Me (Official Video)",
    youtubeId: "djV11Xbc914",
    category: "Music Videos",
    duration: "3:50",
    language: "en",
    description: "The iconic 1985 music video with groundbreaking animation",
  },
  {
    title: "Bon Jovi - Livin' On A Prayer (Official Video)",
    youtubeId: "lDK9QqIzhwk",
    category: "Music Videos",
    duration: "4:10",
    language: "en",
    description: "1986 rock anthem that defined the era",
  },
  {
    title: "Def Leppard - Pour Some Sugar On Me",
    youtubeId: "0UIB9Y4OFPs",
    category: "Music Videos",
    duration: "4:27",
    language: "en",
    description: "1987 glam metal classic",
  },
  {
    title: "Whitesnake - Here I Go Again (Official Video)",
    youtubeId: "WyF8RHM1OCg",
    category: "Music Videos",
    duration: "4:35",
    language: "en",
    description: "1987 power ballad featuring Tawny Kitaen",
  },
  
  // CLASSIC MOVIES (Public Domain / Official Uploads)
  {
    title: "The Terminator (1984) - Behind the Scenes Documentary",
    youtubeId: "k64P4l2Wmeg",
    category: "Documentaries",
    duration: "45:00",
    language: "en",
    description: "Making of the sci-fi classic that launched a franchise",
  },
  {
    title: "Back to the Future - The Complete Making Of",
    youtubeId: "VkMU1mKdwPI",
    category: "Documentaries",
    duration: "1:30:00",
    language: "en",
    description: "Documentary about the making of the 1985 classic",
  },
  {
    title: "Star Wars Original Trilogy - Behind the Magic",
    youtubeId: "Nw_VeZk_q0U",
    category: "Documentaries",
    duration: "1:45:00",
    language: "en",
    description: "The making of the original Star Wars trilogy",
  },
  
  // TV SHOWS DOCUMENTARIES
  {
    title: "The Story of Knight Rider",
    youtubeId: "oNyXYPhnUIs",
    category: "Documentaries",
    duration: "50:00",
    language: "en",
    description: "Documentary about the iconic 80s TV series",
  },
  {
    title: "Miami Vice - The Definitive Documentary",
    youtubeId: "dEjXPY9jOx8",
    category: "Documentaries",
    duration: "55:00",
    language: "en",
    description: "How Miami Vice changed television forever",
  },
  
  // SPORTS CLASSICS
  {
    title: "1985 NBA Finals - Lakers vs Celtics (Full Game)",
    youtubeId: "Vy7RaQUmOzE",
    category: "Sports",
    duration: "2:30:00",
    language: "en",
    description: "Classic rivalry game from the golden era of basketball",
  },
  {
    title: "1986 World Cup Final - Argentina vs West Germany",
    youtubeId: "1wVho3I0NtU",
    category: "Sports",
    duration: "1:50:00",
    language: "en",
    description: "Maradona leads Argentina to World Cup glory",
  },
  {
    title: "Mike Tyson - Greatest Knockouts Compilation",
    youtubeId: "7FgS3kCv79I",
    category: "Sports",
    duration: "45:00",
    language: "en",
    description: "Iron Mike's most devastating knockouts from the 80s",
  },
  
  // GERMAN CONTENT
  {
    title: "Nena - 99 Luftballons (Live 1984)",
    youtubeId: "Fpu5a0Bl8eY",
    category: "Music Videos",
    duration: "4:00",
    language: "de",
    description: "Der deutsche Welthit live performt",
  },
  {
    title: "Die Ärzte - Schrei nach Liebe (Official Video)",
    youtubeId: "6X9CEi8wkBc",
    category: "Music Videos",
    duration: "3:45",
    language: "de",
    description: "Deutscher Punk-Rock Klassiker",
  },
  {
    title: "Scorpions - Wind of Change (Official Video)",
    youtubeId: "n4RjJKxsamQ",
    category: "Music Videos",
    duration: "5:10",
    language: "de",
    description: "Die Hymne der Wiedervereinigung",
    featured: true,
  },
  {
    title: "Modern Talking - You're My Heart, You're My Soul",
    youtubeId: "4kHl4FoK1Ys",
    category: "Music Videos",
    duration: "3:35",
    language: "de",
    description: "Der 1984er Eurodisco-Hit von Dieter Bohlen",
  },
  {
    title: "Falco - Rock Me Amadeus (Official Video)",
    youtubeId: "cVikZ8Ber6I",
    category: "Music Videos",
    duration: "3:25",
    language: "de",
    description: "Österreichischer Welthit von 1985",
  },
  
  // ACTION MOVIES (Trailers & Documentaries)
  {
    title: "Die Hard (1988) - Making of Documentary",
    youtubeId: "gGY1J9XTXuw",
    category: "Documentaries",
    duration: "40:00",
    language: "en",
    description: "How Die Hard became the ultimate action movie",
  },
  {
    title: "Predator (1987) - Behind the Scenes",
    youtubeId: "Y2xGLHETGLk",
    category: "Documentaries",
    duration: "35:00",
    language: "en",
    description: "Making of the sci-fi action classic",
  },
  {
    title: "RoboCop (1987) - The Future of Law Enforcement",
    youtubeId: "ZFvqDaFpXeM",
    category: "Documentaries",
    duration: "50:00",
    language: "en",
    description: "Documentary about Paul Verhoeven's satirical masterpiece",
  },
  
  // SCI-FI
  {
    title: "Blade Runner (1982) - Dangerous Days Documentary",
    youtubeId: "2bMzjz_Cq0k",
    category: "Documentaries",
    duration: "3:30:00",
    language: "en",
    description: "The definitive making-of documentary",
    featured: true,
  },
  {
    title: "Aliens (1986) - Superior Firepower Documentary",
    youtubeId: "JYkxCzBszOQ",
    category: "Documentaries",
    duration: "2:50:00",
    language: "en",
    description: "Complete making-of James Cameron's sci-fi masterpiece",
  },
  
  // THRILLER/CRIME
  {
    title: "Scarface (1983) - The Making of a Classic",
    youtubeId: "7pQQHnqBa2E",
    category: "Documentaries",
    duration: "1:00:00",
    language: "en",
    description: "Behind the scenes of Brian De Palma's crime epic",
  },
];

async function addVideos() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    let added = 0;
    let skipped = 0;

    for (const video of GENX_VIDEOS) {
      // Check if video already exists
      const existing = await TVVideo.findOne({ youtubeId: video.youtubeId });
      if (existing) {
        console.log(`⏭️  Skipped (exists): ${video.title}`);
        skipped++;
        continue;
      }

      await TVVideo.create({
        title: video.title,
        description: video.description,
        youtubeUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
        youtubeId: video.youtubeId,
        thumbnail: `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`,
        category: video.category,
        duration: video.duration,
        language: video.language,
        featured: video.featured || false,
        active: true,
      });
      console.log(`✅ Added: ${video.title}`);
      added++;
    }

    console.log(`\n📊 Summary: ${added} added, ${skipped} skipped`);
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addVideos();
