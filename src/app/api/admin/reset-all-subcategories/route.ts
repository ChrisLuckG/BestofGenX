import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import Card from "@/models/Card";

// Reset ALL subcategories to empty so they get re-categorized
export async function POST() {
  try {
    await dbConnect();
    
    const result = await Card.updateMany(
      {}, 
      { $set: { subCategory: '' } }
    );
    
    return NextResponse.json({ 
      success: true, 
      reset: result.modifiedCount 
    });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
