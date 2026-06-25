import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const MAX_BACKUPS = 10; // Keep last 10 versions

// GET - Load template
export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise;
    const db = client.db("sporttock");
    
    // Check if requesting a backup restore
    const url = new URL(request.url);
    const backupId = url.searchParams.get('restore');
    
    if (backupId) {
      // Restore from backup
      const backup = await db.collection("templateBackups").findOne({ _id: new (await import('mongodb')).ObjectId(backupId) });
      if (backup) {
        // Save current as backup first, then restore
        const current = await db.collection("settings").findOne({ key: "articleTemplate" });
        if (current && current.items && current.items.length > 0) {
          await db.collection("templateBackups").insertOne({
            items: current.items,
            createdAt: new Date(),
            reason: "before-restore"
          });
        }
        // Restore the backup
        await db.collection("settings").updateOne(
          { key: "articleTemplate" },
          { $set: { key: "articleTemplate", items: backup.items, updatedAt: new Date() } },
          { upsert: true }
        );
        return NextResponse.json({ success: true, restored: true, itemCount: backup.items?.length || 0 });
      }
      return NextResponse.json({ success: false, error: "Backup not found" }, { status: 404 });
    }
    
    // Check if requesting backup list
    if (url.searchParams.get('backups') === 'true') {
      const backups = await db.collection("templateBackups")
        .find({})
        .sort({ createdAt: -1 })
        .limit(MAX_BACKUPS)
        .toArray();
      return NextResponse.json({ 
        success: true, 
        backups: backups.map(b => ({
          id: b._id.toString(),
          createdAt: b.createdAt,
          itemCount: b.items?.length || 0,
          reason: b.reason || "auto-save"
        }))
      });
    }
    
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

// POST - Save template WITH AUTOMATIC BACKUP
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Support both 'items' and 'template' keys for backwards compatibility
    const items = body.items || body.template;
    
    const client = await clientPromise;
    const db = client.db("sporttock");
    
    // SAFETY: Don't save empty template without explicit confirmation
    if (!items || items.length === 0) {
      const forceEmpty = body.forceEmpty === true;
      if (!forceEmpty) {
        console.warn("⚠️ Blocked saving empty template! Use forceEmpty:true to override.");
        return NextResponse.json({ 
          success: false, 
          error: "Cannot save empty template. If intentional, set forceEmpty:true",
          blocked: true
        }, { status: 400 });
      }
    }
    
    // BACKUP: Save current template before overwriting
    const current = await db.collection("settings").findOne({ key: "articleTemplate" });
    if (current?.items && current.items.length > 0) {
      // Only backup if current has content
      await db.collection("templateBackups").insertOne({
        items: current.items,
        createdAt: new Date(),
        reason: "auto-save"
      });
      
      // Cleanup old backups (keep only MAX_BACKUPS)
      const backupCount = await db.collection("templateBackups").countDocuments();
      if (backupCount > MAX_BACKUPS) {
        const oldBackups = await db.collection("templateBackups")
          .find({})
          .sort({ createdAt: 1 })
          .limit(backupCount - MAX_BACKUPS)
          .toArray();
        const oldIds = oldBackups.map(b => b._id);
        await db.collection("templateBackups").deleteMany({ _id: { $in: oldIds } });
      }
    }
    
    console.log(`Saving template with ${items?.length || 0} items (backup created)`);
    
    const result = await db.collection("settings").updateOne(
      { key: "articleTemplate" },
      { $set: { key: "articleTemplate", items, updatedAt: new Date() } },
      { upsert: true }
    );
    
    return NextResponse.json({ success: true, saved: items?.length || 0, backupCreated: true });
  } catch (error) {
    console.error("Error saving template:", error);
    return NextResponse.json({ success: false, error: "Failed to save template" }, { status: 500 });
  }
}
