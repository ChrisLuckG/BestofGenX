import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import User from '@/models/User';
import SongRequest from '@/models/SongRequest';
import Notification from '@/models/Notification';
import { sendEmail, createSongRequestEmail, createSongApprovedEmail, createSongRejectedEmail, createSongInProgressEmail } from '@/lib/email';
import { sendPushNotification } from '@/lib/webpush';
import { awardBogx } from '@/lib/awardBogx';

const TEAM_EMAIL = 'contact@bestofgenx.com';

// POST - Submit a song request. Stores it for the admin infostream,
// emails the BOGX team, and pushes a notification to all admins.
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const { userId, username, playlist, band, song, link } = await request.json();

    if (!playlist || !band || !song) {
      return NextResponse.json(
        { success: false, error: 'Playlist, band and song are required' },
        { status: 400 }
      );
    }

    const requesterName = username || 'A GenX member';

    // 1. Store request (admin infostream / future reuse)
    const saved = await SongRequest.create({
      userId: userId || null,
      username: requesterName,
      playlist,
      band,
      song,
      link: link || null,
      status: 'new',
    });

    // 2. Email the team (best-effort, never block the user)
    const subject = `BOGX - Spotify List Request ${playlist}`;
    try {
      await sendEmail(TEAM_EMAIL, subject, createSongRequestEmail({
        username: requesterName,
        playlist,
        band,
        song,
        link,
      }));
    } catch (emailError) {
      console.error('song-request email failed:', emailError);
    }

    // 3. Push notification to all admins (best-effort)
    try {
      const admins = await User.find({
        isAdmin: true,
        pushSubscription: { $ne: null },
      }).select('pushSubscription').lean();

      await Promise.all(
        admins.map((admin) =>
          admin.pushSubscription
            ? sendPushNotification(admin.pushSubscription, {
                title: '🎵 New Song Request',
                body: `${requesterName} suggested "${band} - ${song}" for ${playlist}`,
                tag: `song-request-${saved._id}`,
                url: '/admin',
              }).catch(() => null)
            : Promise.resolve(null)
        )
      );
    } catch (pushError) {
      console.error('song-request push failed:', pushError);
    }

    return NextResponse.json({ success: true, id: saved._id });
  } catch (error: any) {
    console.error('song-request error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// GET - List song requests for the admin infostream
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const requests = await SongRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    console.error('song-request list error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

// PUT - Vote on a song request (community)
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    const { id, userId } = await request.json();
    if (!id || !userId) {
      return NextResponse.json({ success: false, error: 'Missing id or userId' }, { status: 400 });
    }
    const song = await SongRequest.findById(id);
    if (!song) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const alreadyVoted = (song.votedBy ?? []).includes(userId);
    if (alreadyVoted) {
      // Toggle off
      await SongRequest.findByIdAndUpdate(id, { $inc: { votes: -1 }, $pull: { votedBy: userId } });
      return NextResponse.json({ success: true, voted: false, votes: song.votes - 1 });
    } else {
      await SongRequest.findByIdAndUpdate(id, { $inc: { votes: 1 }, $addToSet: { votedBy: userId } });
      return NextResponse.json({ success: true, voted: true, votes: song.votes + 1 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - Update a song request status (admin)
// Sends email + push notification to user when approved or rejected
export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'Missing id or status' }, { status: 400 });
    }

    const valid = ['new', 'in_progress', 'added', 'rejected'];
    if (!valid.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }

    // Get the song request before updating
    const songRequest = await SongRequest.findById(id);
    if (!songRequest) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    // Update status
    await SongRequest.findByIdAndUpdate(id, { status });

    // Send notification to user if status changed to in_progress, added, or rejected
    if ((status === 'in_progress' || status === 'added' || status === 'rejected') && songRequest.userId) {
      const user = await User.findById(songRequest.userId).lean();
      
      if (user) {
        const emailParams = {
          username: songRequest.username,
          playlist: songRequest.playlist,
          band: songRequest.band,
          song: songRequest.song,
        };

        // Determine notification content based on status
        let notifTitle: string;
        let notifMessage: string;
        let notifType: 'song_in_progress' | 'song_approved' | 'song_rejected';
        let emailSubject: string;
        let emailHtml: string;

        if (status === 'in_progress') {
          notifTitle = 'Song Being Reviewed!';
          notifMessage = `We're reviewing your request for "${songRequest.band} - ${songRequest.song}" for the ${songRequest.playlist} playlist!`;
          notifType = 'song_in_progress';
          emailSubject = `We're reviewing your song request!`;
          emailHtml = createSongInProgressEmail(emailParams);
        } else if (status === 'added') {
          notifTitle = 'Song Added! +0.50 BOGX';
          notifMessage = `Great news! "${songRequest.band} - ${songRequest.song}" was added to the ${songRequest.playlist} playlist! You earned 0.50 BOGX!`;
          notifType = 'song_approved';
          emailSubject = `Your song was added to ${songRequest.playlist}! +0.50 BOGX`;
          emailHtml = createSongApprovedEmail(emailParams);
          
          // Award 0.50 BOGX to the user (also creates a GameResult for rankings)
          try {
            await awardBogx({ userId: songRequest.userId.toString(), amount: 0.50, source: 'song-request', description: 'Song added to playlist' });
          } catch (pointsError) {
            console.error('song-request bogxCoins award failed:', pointsError);
          }
        } else {
          notifTitle = 'Song Request Update';
          notifMessage = `Thanks for your suggestion! "${songRequest.band} - ${songRequest.song}" wasn't added to ${songRequest.playlist} this time, but keep the ideas coming!`;
          notifType = 'song_rejected';
          emailSubject = `Update on your song request`;
          emailHtml = createSongRejectedEmail(emailParams);
        }

        // Create in-app notification
        try {
          await Notification.create({
            userId: songRequest.userId,
            type: notifType,
            title: notifTitle,
            message: notifMessage,
            read: false,
          });
        } catch (notifError) {
          console.error('song-request in-app notification failed:', notifError);
        }

        // Send email (best-effort)
        try {
          if (user.email) {
            await sendEmail(user.email, emailSubject, emailHtml);
          }
        } catch (emailError) {
          console.error('song-request user email failed:', emailError);
        }

        // Send push notification (best-effort)
        try {
          if (user.pushSubscription) {
            await sendPushNotification(user.pushSubscription, {
              title: notifTitle,
              body: notifMessage,
              tag: `song-request-${id}`,
              url: '/mobile',
            });
          }
        } catch (pushError) {
          console.error('song-request user push failed:', pushError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('song-request update error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
