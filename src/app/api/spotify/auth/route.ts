import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  // MUST use explicit env variable - Spotify is strict about exact URI match
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  
  if (!redirectUri) {
    return NextResponse.json({ error: "SPOTIFY_REDIRECT_URI not configured" }, { status: 500 });
  }

  if (!clientId) {
    return NextResponse.json({ error: "Spotify not configured" }, { status: 500 });
  }

  const scopes = [
    "playlist-modify-public",
    "playlist-modify-private",
    "playlist-read-private",
  ].join(" ");

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scopes);

  return NextResponse.redirect(authUrl.toString());
}
