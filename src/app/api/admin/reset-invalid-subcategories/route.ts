import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Card from "@/models/Card";

// Valid subcategories per theme
const VALID_SUBS: Record<string, string[]> = {
  'SPORTS': ['Basketball', 'Soccer', 'American Football', 'Rugby', 'Tennis', 'Table Tennis', 'Boxing', 'Golf', 'Hockey', 'Baseball', 'Wrestling', 'Olympics', 'Racing', 'Cycling', 'Swimming', 'X-Games'],
  'MUSIC': ['Rock', 'Pop', 'Hip Hop', 'R&B', 'Electronic', 'Metal', 'Punk', 'Alternative'],
  'MOVIES': ['Action', 'Comedy', 'Horror', 'Sci-Fi', 'Drama', 'Thriller', 'Animation', 'Romance'],
  'TV SHOWS': ['Sitcom', 'Drama', 'Sci-Fi', 'Animation', 'Reality', 'Talk Show', 'Crime'],
  'GAMING': ['Nintendo', 'PlayStation', 'Sega', 'PC Gaming', 'Fighting', 'RPG'],
};

export async function POST() {
  try {
    await dbConnect();
    
    const cards = await Card.find({ subCategory: { $exists: true, $ne: '' } });
    
    let reset = 0;
    for (const card of cards) {
      const validList = VALID_SUBS[card.theme] || [];
      if (card.subCategory && !validList.includes(card.subCategory)) {
        await Card.updateOne({ _id: card._id }, { subCategory: '' });
        reset++;
        console.log(`Reset invalid subCategory "${card.subCategory}" for ${card.theme}: ${card.topic}`);
      }
    }
    
    return NextResponse.json({ success: true, reset });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
