import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import SpotifyToken from "@/models/SpotifyToken";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const tokenDoc = await SpotifyToken.findOne().sort({ createdAt: -1 });
    
    return NextResponse.json({
      connected: !!tokenDoc,
      expired: tokenDoc ? new Date() >= tokenDoc.expiresAt : true,
    });
  } catch {
    return NextResponse.json({ connected: false, expired: true });
  }
}
