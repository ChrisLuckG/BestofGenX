import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import ArticleView from '@/models/ArticleView';
import User from '@/models/User';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    // Get all article views
    const views = await ArticleView.find({ articleId: id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    
    // Get user names for logged-in viewers
    const userIds = Array.from(new Set(views.map((v: any) => v.userId?.toString()).filter(Boolean)));
    const users = userIds.length > 0 
      ? await User.find({ _id: { $in: userIds } }).select('username email').lean()
      : [];
    
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u.username || u.email?.split('@')[0] || 'Unknown']));
    
    // Build viewer list with analytics
    const viewers = views.map((v: any) => ({
      name: v.userId ? (userMap.get(v.userId.toString()) || 'User') : 'Anonymous',
      isLoggedIn: !!v.userId,
      country: v.country || 'Unknown',
      city: v.city || 'Unknown',
      device: v.device || 'Unknown',
      browser: v.browser || 'Unknown',
      os: v.os || 'Unknown',
      referrer: v.referrer || '',
      date: v.createdAt ? new Date(v.createdAt).toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      }) : 'Unknown'
    }));
    
    // Calculate analytics summaries
    const countryStats: Record<string, number> = {};
    const cityStats: Record<string, number> = {};
    const regionStats: Record<string, number> = {};
    const deviceStats: Record<string, number> = {};
    const browserStats: Record<string, number> = {};
    const osStats: Record<string, number> = {};
    const referrerStats: Record<string, number> = {};
    const hourlyStats: Record<number, number> = {};
    let loggedInCount = 0;
    let anonymousCount = 0;
    
    views.forEach((v: any) => {
      // Country
      const country = v.country || 'Unknown';
      countryStats[country] = (countryStats[country] || 0) + 1;
      
      // City
      const city = v.city || 'Unknown';
      cityStats[city] = (cityStats[city] || 0) + 1;
      
      // Region
      const region = v.region || 'Unknown';
      regionStats[region] = (regionStats[region] || 0) + 1;
      
      // Device
      const device = v.device || 'Unknown';
      deviceStats[device] = (deviceStats[device] || 0) + 1;
      
      // Browser
      const browser = v.browser || 'Unknown';
      browserStats[browser] = (browserStats[browser] || 0) + 1;
      
      // OS
      const os = v.os || 'Unknown';
      osStats[os] = (osStats[os] || 0) + 1;
      
      // Referrer (extract domain)
      let referrer = 'Direct';
      if (v.referrer) {
        try {
          const url = new URL(v.referrer);
          referrer = url.hostname.replace('www.', '');
        } catch {
          referrer = v.referrer.substring(0, 30);
        }
      }
      referrerStats[referrer] = (referrerStats[referrer] || 0) + 1;
      
      // Hourly
      if (v.createdAt) {
        const hour = new Date(v.createdAt).getHours();
        hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
      }
      
      // Logged in vs anonymous
      if (v.userId) loggedInCount++;
      else anonymousCount++;
    });
    
    // Sort stats by count
    const sortedCountries = Object.entries(countryStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    const sortedCities = Object.entries(cityStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    const sortedRegions = Object.entries(regionStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    const sortedDevices = Object.entries(deviceStats)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    
    const sortedBrowsers = Object.entries(browserStats)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    
    const sortedOs = Object.entries(osStats)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    
    const sortedReferrers = Object.entries(referrerStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    
    const sortedHourly = Object.entries(hourlyStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));
    
    return NextResponse.json({ 
      viewers,
      analytics: {
        total: views.length,
        loggedIn: loggedInCount,
        anonymous: anonymousCount,
        countries: sortedCountries,
        cities: sortedCities,
        regions: sortedRegions,
        devices: sortedDevices,
        browsers: sortedBrowsers,
        os: sortedOs,
        referrers: sortedReferrers,
        hourly: sortedHourly
      }
    });
  } catch (error) {
    console.error('Error fetching viewers:', error);
    return NextResponse.json({ viewers: [], analytics: null });
  }
}
