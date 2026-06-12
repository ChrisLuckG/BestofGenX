import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Card from "@/models/Card";

export async function GET() {
  try {
    await dbConnect();
    
    // Find all cards grouped by topic
    const cards = await Card.find({}).lean();
    
    // Group by normalized topic
    const topicGroups: Record<string, any[]> = {};
    for (const card of cards) {
      const normalizedTopic = (card.topic || '').toLowerCase().trim();
      if (!topicGroups[normalizedTopic]) {
        topicGroups[normalizedTopic] = [];
      }
      topicGroups[normalizedTopic].push(card);
    }
    
    // Find duplicates (topics with more than 1 card)
    const duplicates: { topic: string; count: number; ids: string[] }[] = [];
    for (const [topic, group] of Object.entries(topicGroups)) {
      if (group.length > 1) {
        duplicates.push({
          topic,
          count: group.length,
          ids: group.map(c => c._id.toString())
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      totalCards: cards.length,
      duplicateTopics: duplicates.length,
      duplicates: duplicates.slice(0, 50)
    });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    
    // Find all cards grouped by topic
    const cards = await Card.find({}).sort({ createdAt: 1 }).lean();
    
    // Group by normalized topic
    const topicGroups: Record<string, any[]> = {};
    for (const card of cards) {
      const normalizedTopic = (card.topic || '').toLowerCase().trim();
      if (!topicGroups[normalizedTopic]) {
        topicGroups[normalizedTopic] = [];
      }
      topicGroups[normalizedTopic].push(card);
    }
    
    // Delete duplicates (keep the first/oldest one)
    let deleted = 0;
    for (const [topic, group] of Object.entries(topicGroups)) {
      if (group.length > 1) {
        // Keep the first one, delete the rest
        const toDelete = group.slice(1).map(c => c._id);
        await Card.deleteMany({ _id: { $in: toDelete } });
        deleted += toDelete.length;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      deleted
    });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
