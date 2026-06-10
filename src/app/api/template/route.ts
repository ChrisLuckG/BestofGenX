import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

// GET - Load template
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("sporttock");
    
    const template = await db.collection("settings").findOne({ key: "articleTemplate" });
    
    return NextResponse.json({ 
      success: true, 
      template: template?.items || [] 
    });
  } catch (error) {
    console.error("Error loading template:", error);
    return NextResponse.json({ success: false, error: "Failed to load template" }, { status: 500 });
  }
}

// POST - Save template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Support both 'items' and 'template' keys for backwards compatibility
    const items = body.items || body.template;
    console.log("Saving template with items:", JSON.stringify(items));
    
    const client = await clientPromise;
    const db = client.db("sporttock");
    
    const result = await db.collection("settings").updateOne(
      { key: "articleTemplate" },
      { $set: { key: "articleTemplate", items, updatedAt: new Date() } },
      { upsert: true }
    );
    
    console.log("Template save result:", result);
    
    return NextResponse.json({ success: true, saved: items.length });
  } catch (error) {
    console.error("Error saving template:", error);
    return NextResponse.json({ success: false, error: "Failed to save template" }, { status: 500 });
  }
}
