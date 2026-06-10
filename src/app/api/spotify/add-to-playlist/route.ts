import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import SpotifyToken from "@/models/SpotifyToken";

export const dynamic = "force-dynamic";

// Refresh the access token if needed
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return data.access_token || null;
    } catch {
      console.error("Failed to parse refresh token response:", text.substring(0, 200));
      return null;
    }
  } catch (e) {
    console.error("Refresh token fetch error:", e);
    return null;
  }
}

// Extract track ID from Spotify URL
function extractTrackId(url: string): string | null {
  const trackMatch = url.match(/track[/:]([a-zA-Z0-9]+)/);
  return trackMatch ? trackMatch[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spotifyUrl, playlistId } = body;

    if (!spotifyUrl || !playlistId) {
      return NextResponse.json({ error: "Missing spotifyUrl or playlistId" }, { status: 400 });
    }

    const trackId = extractTrackId(spotifyUrl);
    if (!trackId) {
      return NextResponse.json({ error: "Invalid Spotify URL" }, { status: 400 });
    }

    // Get tokens from MongoDB
    await dbConnect();
    const tokenDoc = await SpotifyToken.findOne().sort({ createdAt: -1 });
    
    if (!tokenDoc) {
      return NextResponse.json({ error: "Not authenticated with Spotify", needsAuth: true }, { status: 401 });
    }

    let accessToken = tokenDoc.accessToken;
    const refreshToken = tokenDoc.refreshToken;

    // Check if token is expired
    if (new Date() >= tokenDoc.expiresAt) {
      console.log("Token expired, refreshing...");
      const newToken = await refreshAccessToken(refreshToken);
      if (newToken) {
        accessToken = newToken;
        // Update token in DB
        await SpotifyToken.updateOne(
          { _id: tokenDoc._id },
          { accessToken: newToken, expiresAt: new Date(Date.now() + 3600 * 1000) }
        );
      } else {
        return NextResponse.json({ error: "Failed to refresh token", needsAuth: true }, { status: 401 });
      }
    }

    // Add track to playlist
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [`spotify:track:${trackId}`],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Spotify API error status:", response.status, "body:", text.substring(0, 500));
      
      if (response.status === 401) {
        return NextResponse.json({ error: "Token expired, please reconnect Spotify", needsAuth: true }, { status: 401 });
      }
      
      // Try to parse as JSON
      try {
        const errorData = JSON.parse(text);
        return NextResponse.json({ error: errorData.error?.message || "Failed to add track" }, { status: response.status });
      } catch {
        return NextResponse.json({ error: `Spotify error: ${response.status}` }, { status: response.status });
      }
    }

    return NextResponse.json({ success: true, trackId });
  } catch (error) {
    console.error("Add to playlist error:", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
