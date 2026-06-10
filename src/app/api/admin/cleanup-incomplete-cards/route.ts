import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Card from "@/models/Card";

export async function POST() {
  try {
    await dbConnect();
    
    // Find all cards with less than 3 questions
    const incompleteCards = await Card.find({
      $or: [
        { questions: { $exists: false } },
        { questions: { $size: 0 } },
        { questions: { $size: 1 } },
        { questions: { $size: 2 } },
      ]
    });
    
    const count = incompleteCards.length;
    const deletedIds = incompleteCards.map(c => c._id);
    
    // Delete them
    const result = await Card.deleteMany({
      $or: [
        { questions: { $exists: false } },
        { questions: { $size: 0 } },
        { questions: { $size: 1 } },
        { questions: { $size: 2 } },
      ]
    });
    
    console.log(`Deleted ${result.deletedCount} incomplete cards`);
    
    return NextResponse.json({ 
      success: true, 
      deleted: result.deletedCount,
      deletedIds 
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// Also allow GET for easy testing
export async function GET() {
  try {
    await dbConnect();
    
    // Just count, don't delete
    const count = await Card.countDocuments({
      $or: [
        { questions: { $exists: false } },
        { questions: { $size: 0 } },
        { questions: { $size: 1 } },
        { questions: { $size: 2 } },
      ]
    });
    
    return NextResponse.json({ 
      success: true, 
      incompleteCount: count,
      message: `Found ${count} cards with less than 3 questions. POST to delete them.`
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
