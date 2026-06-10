import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import SpotifyToken from "@/models/SpotifyToken";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await dbConnect();
    await SpotifyToken.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
