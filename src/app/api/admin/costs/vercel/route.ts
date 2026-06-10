import { NextResponse } from 'next/server';

/**
 * Vercel Usage API
 *
 * Requires in env:
 *  - VERCEL_TOKEN (create at https://vercel.com/account/tokens)
 *  - VERCEL_TEAM_ID (optional, for team-owned projects)
 *
 * Docs: https://vercel.com/docs/rest-api
 */
export async function GET() {
  try {
    const token = process.env.VERCEL_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID; // optional

    if (!token) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'VERCEL_TOKEN not set in environment',
        helpUrl: 'https://vercel.com/account/tokens',
      });
    }

    const teamQuery = teamId ? `?teamId=${teamId}` : '';

    // Try to fetch user info (sanity check + identify scope)
    const userRes = await fetch(`https://api.vercel.com/v2/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let username = 'unknown';
    let userEmail = '';
    if (userRes.ok) {
      const userData = await userRes.json();
      username = userData.user?.username || userData.user?.name || 'user';
      userEmail = userData.user?.email || '';
    }

    // Fetch projects
    const projectsRes = await fetch(`https://api.vercel.com/v9/projects${teamQuery}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let projects: { id: string; name: string }[] = [];
    if (projectsRes.ok) {
      const projectsData = await projectsRes.json();
      projects = (projectsData.projects || []).map((p: any) => ({
        id: p.id,
        name: p.name,
      }));
    }

    // Fetch Blob stores (storage data)
    const blobRes = await fetch(`https://api.vercel.com/v1/storage/stores${teamQuery}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let blobStores: { name: string; sizeBytes: number }[] = [];
    let blobTotalBytes = 0;
    if (blobRes.ok) {
      const blobData = await blobRes.json();
      const stores = Array.isArray(blobData.stores) ? blobData.stores : (Array.isArray(blobData) ? blobData : []);
      for (const store of stores) {
        if (store.type === 'blob' || store.id?.startsWith('store_')) {
          const size = store.size || store.byteSize || 0;
          blobTotalBytes += size;
          blobStores.push({ name: store.name || store.id, sizeBytes: size });
        }
      }
    }

    // Fetch deployments for current project (last 30 days, to count invocations approximately)
    const last30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const deploymentsRes = await fetch(
      `https://api.vercel.com/v6/deployments?since=${last30}&limit=100${teamId ? `&teamId=${teamId}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    let deploymentCount = 0;
    if (deploymentsRes.ok) {
      const depData = await deploymentsRes.json();
      deploymentCount = (depData.deployments || []).length;
    }

    return NextResponse.json({
      success: true,
      configured: true,
      account: { username, email: userEmail, teamId: teamId || null },
      projects,
      projectCount: projects.length,
      blob: {
        stores: blobStores,
        totalBytes: blobTotalBytes,
      },
      recentDeployments: deploymentCount,
      note: 'Vercel does not expose billing $ amounts via public API. View detailed costs on https://vercel.com/dashboard/usage',
    });
  } catch (error: any) {
    console.error('Vercel costs error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch Vercel data',
    }, { status: 500 });
  }
}
