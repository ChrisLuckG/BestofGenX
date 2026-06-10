import { NextResponse } from 'next/server';
import crypto from 'crypto';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';

/**
 * MongoDB Atlas Costs API
 *
 * Requires in env:
 *  - MONGODB_ATLAS_PUBLIC_KEY
 *  - MONGODB_ATLAS_PRIVATE_KEY
 *  - MONGODB_ATLAS_ORG_ID
 *
 * Atlas API uses HTTP Digest Authentication.
 * Create API key at: https://www.mongodb.com/account/login -> Organization -> Access Manager -> API Keys
 *
 * Docs: https://www.mongodb.com/docs/atlas/reference/api-resources-spec/v2/
 */

// Minimal HTTP Digest Auth implementation for fetch
async function fetchWithDigestAuth(url: string, publicKey: string, privateKey: string): Promise<Response> {
  // First request - get the challenge
  const firstRes = await fetch(url, {
    headers: { Accept: 'application/vnd.atlas.2023-01-01+json' },
  });

  if (firstRes.status !== 401) {
    return firstRes;
  }

  const wwwAuth = firstRes.headers.get('www-authenticate');
  if (!wwwAuth || !wwwAuth.toLowerCase().startsWith('digest')) {
    return firstRes;
  }

  // Parse challenge
  const challenge: Record<string, string> = {};
  wwwAuth.substring(7).split(',').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    challenge[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '');
  });

  const cnonce = crypto.randomBytes(8).toString('hex');
  const nc = '00000001';
  const urlPath = new URL(url).pathname + new URL(url).search;

  // HA1, HA2, response
  const ha1 = crypto.createHash('md5').update(`${publicKey}:${challenge.realm}:${privateKey}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`GET:${urlPath}`).digest('hex');
  const response = crypto.createHash('md5')
    .update(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`)
    .digest('hex');

  const authHeader =
    `Digest username="${publicKey}", realm="${challenge.realm}", nonce="${challenge.nonce}", ` +
    `uri="${urlPath}", qop=${challenge.qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"` +
    (challenge.opaque ? `, opaque="${challenge.opaque}"` : '');

  return fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/vnd.atlas.2023-01-01+json',
    },
  });
}

export async function GET() {
  try {
    const publicKey = process.env.MONGODB_ATLAS_PUBLIC_KEY;
    const privateKey = process.env.MONGODB_ATLAS_PRIVATE_KEY;
    const orgId = process.env.MONGODB_ATLAS_ORG_ID;

    if (!publicKey || !privateKey || !orgId) {
      return NextResponse.json({
        success: false,
        configured: false,
        error: 'MongoDB Atlas credentials not configured',
        helpUrl: 'https://www.mongodb.com/account/login',
        missing: {
          MONGODB_ATLAS_PUBLIC_KEY: !publicKey,
          MONGODB_ATLAS_PRIVATE_KEY: !privateKey,
          MONGODB_ATLAS_ORG_ID: !orgId,
        },
      });
    }

    // Fetch the latest pending/current invoice
    const invoiceUrl = `https://cloud.mongodb.com/api/atlas/v2/orgs/${orgId}/invoices/pending`;
    const res = await fetchWithDigestAuth(invoiceUrl, publicKey, privateKey);

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        success: false,
        configured: true,
        error: `Atlas API error (${res.status}): ${errText.slice(0, 300)}`,
      });
    }

    const data = await res.json();

    // Atlas amounts are in cents (US cents)
    const amountCents = data.amountBilledCents ?? data.amountPaidCents ?? data.subTotalCents ?? 0;
    const amountUsd = amountCents / 100;

    // Line items grouped
    const lineItems: { sku: string; description: string; amountUsd: number }[] = [];
    if (Array.isArray(data.lineItems)) {
      for (const item of data.lineItems) {
        lineItems.push({
          sku: item.sku || 'UNKNOWN',
          description: item.note || item.groupName || item.sku || '',
          amountUsd: (item.totalPriceCents || 0) / 100,
        });
      }
    }

    // Also fetch cluster stats (data size, tier, region)
    const clusters: any[] = [];
    let clusterError: string | null = null;
    try {
      // First get all projects in this org
      const projectsRes = await fetchWithDigestAuth(
        `https://cloud.mongodb.com/api/atlas/v2/orgs/${orgId}/groups`,
        publicKey,
        privateKey
      );
      if (!projectsRes.ok) {
        const txt = await projectsRes.text();
        clusterError = `Cannot list projects (${projectsRes.status}): ${txt.slice(0, 150)}. Needs Organization Read Only permission.`;
        console.warn('Atlas cluster fetch:', clusterError);
      } else {
        const projectsData = await projectsRes.json();
        const projects = projectsData.results || [];

        for (const project of projects) {
          try {
            const clustersRes = await fetchWithDigestAuth(
              `https://cloud.mongodb.com/api/atlas/v2/groups/${project.id}/clusters`,
              publicKey,
              privateKey
            );
            if (clustersRes.ok) {
              const clustersData = await clustersRes.json();
              for (const cluster of clustersData.results || []) {
                clusters.push({
                  name: cluster.name,
                  project: project.name,
                  tier: cluster.providerSettings?.instanceSizeName || cluster.clusterType || 'Unknown',
                  region: cluster.providerSettings?.regionName || '',
                  diskSizeGB: cluster.diskSizeGB || 0,
                  mongoVersion: cluster.mongoDBVersion || '',
                  state: cluster.stateName || '',
                  backupEnabled: !!cluster.backupEnabled,
                });
              }
            } else {
              const txt = await clustersRes.text();
              console.warn(`Atlas cluster fetch for ${project.name} (${clustersRes.status}):`, txt.slice(0, 200));
            }
          } catch (e: any) {
            console.warn('Atlas cluster fetch error:', e?.message);
          }
        }
      }
    } catch (e: any) {
      clusterError = e?.message || 'Cluster fetch failed';
      console.warn('Atlas cluster fetch error:', clusterError);
    }

    // Live DB stats - actual data size from MongoDB connection
    let dbStats: any = null;
    try {
      await dbConnect();
      const db = mongoose.connection.db;
      if (db) {
        const stats = await db.stats();
        // Collection counts
        const collections = await db.listCollections().toArray();
        dbStats = {
          dbName: db.databaseName,
          dataSize: stats.dataSize || 0, // actual data
          storageSize: stats.storageSize || 0, // disk used (compressed)
          indexSize: stats.indexSize || 0,
          totalSize: (stats.dataSize || 0) + (stats.indexSize || 0),
          objects: stats.objects || 0, // total documents
          collectionCount: collections.length,
        };
      }
    } catch (e: any) {
      console.warn('DB stats error:', e?.message);
    }

    return NextResponse.json({
      success: true,
      configured: true,
      currency: 'USD',
      monthlyCostUsd: amountUsd,
      status: data.statusName || 'PENDING',
      startDate: data.startDate,
      endDate: data.endDate,
      lineItems: lineItems.slice(0, 20),
      clusters,
      clusterError,
      dbStats,
    });
  } catch (error: any) {
    console.error('Atlas costs error:', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch MongoDB Atlas costs',
    }, { status: 500 });
  }
}
