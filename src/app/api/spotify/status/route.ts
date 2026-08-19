import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import SpotifyToken from "@/models/SpotifyToken";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const tokenDoc = await SpotifyToken.findOne().sort({ createdAt: -1 });
    
    // Get user info to show which account is connected
    let userInfo = null;
    if (tokenDoc && tokenDoc.accessToken) {
      try {
        const res = await fetch("https://api.spotify.com/v1/me", {
          headers: { Authorization: `Bearer ${tokenDoc.accessToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          userInfo = { id: data.id, name: data.display_name, email: data.email };
        }
      } catch {}
    }
    
    return NextResponse.json({
      connected: !!tokenDoc,
      expired: tokenDoc ? new Date() >= tokenDoc.expiresAt : true,
      user: userInfo,
    });
  } catch {
    return NextResponse.json({ connected: false, expired: true });
  }
}
