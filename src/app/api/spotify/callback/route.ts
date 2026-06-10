import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongoose";
import SpotifyToken from "@/models/SpotifyToken";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/admin?spotify=error", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/admin?spotify=nocode", request.url));
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/admin?spotify=nocreds", request.url));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Spotify token error:", tokens);
      return NextResponse.redirect(new URL("/admin?spotify=tokenerror", request.url));
    }

    // Store tokens in MongoDB
    await dbConnect();
    
    // Delete old tokens and save new ones (only one set of tokens needed)
    await SpotifyToken.deleteMany({});
    await SpotifyToken.create({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    });

    return NextResponse.redirect(new URL("/admin?spotify=success", request.url));
  } catch (error) {
    console.error("Spotify callback error:", error);
    return NextResponse.redirect(new URL("/admin?spotify=error", request.url));
  }
}
