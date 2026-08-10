require('dotenv').config({ path: '.env.local' });

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

async function test() {
  console.log('Client ID:', clientId?.substring(0, 8) + '...');
  
  // Get token
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData = await tokenRes.json();
  console.log('Token:', tokenData.access_token ? 'OK (' + tokenData.access_token.substring(0, 20) + '...)' : JSON.stringify(tokenData));
  
  if (!tokenData.access_token) return;
  
  // Test track - Groovejet by Spiller
  const trackId = '2XdBKKsKOVJqjpUhvLFkLe'; // Groovejet
  console.log('\nFetching track:', trackId);
  
  const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
  });
  
  console.log('Status:', trackRes.status);
  const track = await trackRes.json();
  
  if (track.error) {
    console.log('Error:', track.error);
  } else {
    console.log('Track:', track.name, '-', track.artists?.[0]?.name);
    console.log('Album:', track.album?.name);
    console.log('Cover:', track.album?.images?.[1]?.url || track.album?.images?.[0]?.url);
  }
}

test().catch(console.error);
