import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ═══════════════════════════════════════════════════════════════
// BASE EMAIL TEMPLATE - Used by ALL emails
// Design: Cream background, retro icons header, orange accents
// ═══════════════════════════════════════════════════════════════

interface EmailTemplateParams {
  badgeIcon?: string; // e.g. "✉️" or SVG
  badgeText: string;
  title: string;
  subtitle?: string;
  username?: string;
  greeting?: string;
  bodyContent: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
  footerLink?: { text: string; url: string };
}

function createBaseEmailTemplate(params: EmailTemplateParams): string {
  const {
    badgeIcon = '✉️',
    badgeText,
    title,
    subtitle,
    username,
    greeting,
    bodyContent,
    ctaText,
    ctaUrl,
    footerNote,
    footerLink,
  } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F5F0E8; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 0;">

    <!-- Header with retro pattern background -->
    <div style="background: linear-gradient(135deg, #FDF8F0 0%, #F5F0E8 100%); padding: 32px 20px; text-align: center; position: relative;">
      <!-- Retro icons pattern (using emoji as fallback, ideally use hosted image) -->
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0.15; font-size: 24px; overflow: hidden; line-height: 1.8;">
        🎮 📺 🎸 👟 🎧 📼 🕹️ 📻 🎬 🎤
      </div>
      <!-- Logo -->
      <div style="position: relative; z-index: 1;">
        <img src="https://bestofgenx.com/images/genxlogo1.png" alt="BOGX" style="height: 48px; object-fit: contain;" />
      </div>
    </div>

    <!-- Main Card -->
    <div style="background-color: #FFFDFB; margin: 0 20px; border-radius: 20px; padding: 40px 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); position: relative; top: -20px;">
      
      <!-- Badge -->
      <div style="text-align: center; margin-bottom: 28px;">
        <span style="display: inline-flex; align-items: center; gap: 8px; background-color: #FDF6EE; color: #D4873A; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 10px 20px; border-radius: 24px; border: 1px solid #F5E6D3;">
          <span style="font-size: 14px;">${badgeIcon}</span>
          ${badgeText}
        </span>
      </div>

      <!-- Title -->
      <h1 style="color: #1a1a1a; font-size: 32px; font-weight: 700; margin: 0 0 8px 0; text-align: center; line-height: 1.2;">
        ${title}
      </h1>
      
      ${subtitle ? `
      <!-- Subtitle with username highlight -->
      <p style="color: #666666; font-size: 16px; margin: 0 0 24px 0; text-align: center; line-height: 1.5;">
        ${username ? `Hey <strong style="color: #D4873A;">${username}</strong>, ` : ''}${subtitle}
      </p>
      ` : ''}

      <!-- Decorative divider -->
      <div style="text-align: center; margin: 24px 0;">
        <div style="display: inline-block; width: 60px; height: 1px; background: linear-gradient(90deg, transparent, #E8E4DC, transparent);"></div>
        <span style="display: inline-block; margin: 0 12px; color: #D4873A; font-size: 14px;">⚡</span>
        <div style="display: inline-block; width: 60px; height: 1px; background: linear-gradient(90deg, transparent, #E8E4DC, transparent);"></div>
      </div>

      <!-- Body Content -->
      <div style="color: #555555; font-size: 15px; line-height: 1.7; text-align: center; margin-bottom: 28px;">
        ${bodyContent}
      </div>

      ${ctaText && ctaUrl ? `
      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${ctaUrl}" style="display: inline-block; background-color: #D4873A; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 48px; border-radius: 14px; box-shadow: 0 4px 12px rgba(212, 135, 58, 0.3);">
          ${ctaText}
        </a>
      </div>
      ` : ''}

      ${footerNote ? `
      <!-- Footer Note with icon -->
      <div style="display: flex; align-items: flex-start; gap: 12px; background-color: #FDF8F0; border-radius: 12px; padding: 16px; margin-top: 24px;">
        <div style="width: 36px; height: 36px; background-color: #D4873A20; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: #D4873A; font-size: 16px;">✓</span>
        </div>
        <p style="color: #888888; font-size: 13px; line-height: 1.5; margin: 0;">
          ${footerNote}
        </p>
      </div>
      ` : ''}

      ${footerLink ? `
      <!-- Copy Link Section -->
      <div style="display: flex; align-items: flex-start; gap: 12px; background-color: #FDF8F0; border-radius: 12px; padding: 16px; margin-top: 16px;">
        <div style="width: 36px; height: 36px; background-color: #D4873A20; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span style="color: #D4873A; font-size: 16px;">🔗</span>
        </div>
        <div>
          <p style="color: #666666; font-size: 12px; font-weight: 600; margin: 0 0 4px 0;">${footerLink.text}</p>
          <p style="color: #D4873A; font-size: 11px; margin: 0; word-break: break-all;">${footerLink.url}</p>
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Privacy Footer -->
    <div style="padding: 24px 20px 40px; text-align: center;">
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 16px;">
        <div style="width: 32px; height: 32px; border: 1px solid #E8E4DC; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 14px;">🛡️</span>
        </div>
        <div style="text-align: left;">
          <p style="color: #666666; font-size: 12px; font-weight: 600; margin: 0;">Your data is safe with us.</p>
          <p style="color: #999999; font-size: 11px; margin: 2px 0 0 0;">We'll never share your information with third parties.</p>
        </div>
        <div style="text-align: right; margin-left: auto;">
          <p style="color: #D4873A; font-size: 11px; font-weight: 600; margin: 0;">Privacy</p>
          <p style="color: #D4873A; font-size: 11px; font-weight: 600; margin: 0;">First</p>
          <p style="color: #999999; font-size: 10px; font-style: italic; margin: 2px 0 0 0;">Always.</p>
        </div>
      </div>
      <p style="color: #AAAAAA; font-size: 11px; margin: 0;">
        Best of GenX &middot; <a href="https://bestofgenx.com" style="color: #D4873A; text-decoration: none;">bestofgenx.com</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

// ═══════════════════════════════════════════════════════════════
// EMAIL TEMPLATES - Using the new base template
// ═══════════════════════════════════════════════════════════════

// Email templates
export function createNewMatchEmail(username: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000; padding: 40px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #f20550; font-size: 32px; margin: 0;">Best of GenX</h1>
      <p style="color: #888888; font-size: 14px; margin-top: 8px;">Daily Quiz Challenge</p>
    </div>
    
    <!-- Main Content -->
    <div style="background: linear-gradient(135deg, rgba(242,5,80,0.2), rgba(128,0,255,0.2)); border: 1px solid rgba(242,5,80,0.3); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
      <div style="font-size: 48px; margin-bottom: 16px;">🎮</div>
      <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 8px 0;">Neues Spiel gestartet!</h2>
      <p style="color: #cccccc; font-size: 16px; margin: 0;">Hey ${username}, die heutige Challenge wartet auf dich!</p>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 30px;">
      <a href="https://bestofgenx.com/mobile" style="display: inline-block; background: linear-gradient(135deg, #f20550, #8000ff); color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 40px; border-radius: 12px;">
        JETZT SPIELEN
      </a>
    </div>
    
    <!-- Info -->
    <div style="text-align: center; padding: 20px;">
      <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0;">
        Teste dein Wissen über die 80er, 90er und 2000er!<br>
        Sammle Punkte und klettere im Ranking nach oben.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
      <p style="color: #666666; font-size: 12px; margin: 0 0 8px 0;">
        Du erhältst diese E-Mail, weil du E-Mail-Benachrichtigungen aktiviert hast.
      </p>
      <p style="color: #666666; font-size: 12px; margin: 0;">
        © 2024 Best of GenX | Made with ❤️ for the 80s, 90s & 2000s Generation
      </p>
    </div>
    
  </div>
</body>
</html>
  `;
}

export function createReminderEmail(username: string, hoursUntilStart: number) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000; padding: 40px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #f20550; font-size: 32px; margin: 0;">Best of GenX</h1>
      <p style="color: #888888; font-size: 14px; margin-top: 8px;">Daily Quiz Challenge</p>
    </div>
    
    <!-- Main Content -->
    <div style="background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(128,0,255,0.2)); border: 1px solid rgba(59,130,246,0.3); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
      <div style="font-size: 48px; margin-bottom: 16px;">⏰</div>
      <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 8px 0;">Noch ${hoursUntilStart} Stunde${hoursUntilStart > 1 ? 'n' : ''}!</h2>
      <p style="color: #cccccc; font-size: 16px; margin: 0;">Hey ${username}, das nächste Spiel startet bald!</p>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 30px;">
      <a href="https://bestofgenx.com/mobile" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8000ff); color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 40px; border-radius: 12px;">
        APP ÖFFNEN
      </a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
      <p style="color: #666666; font-size: 12px; margin: 0;">
        © 2024 Best of GenX | Made with ❤️ for the 80s, 90s & 2000s Generation
      </p>
    </div>
    
  </div>
</body>
</html>
  `;
}

export function createResultsEmail(username: string, rank: number, points: number) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #000000; padding: 40px 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #f20550; font-size: 32px; margin: 0;">Best of GenX</h1>
      <p style="color: #888888; font-size: 14px; margin-top: 8px;">Daily Quiz Challenge</p>
    </div>
    
    <!-- Main Content -->
    <div style="background: linear-gradient(135deg, rgba(234,179,8,0.2), rgba(242,5,80,0.2)); border: 1px solid rgba(234,179,8,0.3); border-radius: 16px; padding: 30px; text-align: center; margin-bottom: 30px;">
      <div style="font-size: 48px; margin-bottom: 16px;">🏆</div>
      <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 8px 0;">Ergebnisse sind da!</h2>
      <p style="color: #cccccc; font-size: 16px; margin: 0;">Hey ${username}, schau dir dein Ranking an!</p>
    </div>
    
    <!-- Stats -->
    <div style="display: flex; justify-content: center; gap: 20px; margin-bottom: 30px;">
      <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; text-align: center; flex: 1;">
        <p style="color: #888888; font-size: 12px; margin: 0 0 8px 0;">DEIN RANG</p>
        <p style="color: #f20550; font-size: 32px; font-weight: bold; margin: 0;">#${rank}</p>
      </div>
      <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; text-align: center; flex: 1;">
        <p style="color: #888888; font-size: 12px; margin: 0 0 8px 0;">PUNKTE HEUTE</p>
        <p style="color: #eab308; font-size: 32px; font-weight: bold; margin: 0;">${points}</p>
      </div>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 30px;">
      <a href="https://bestofgenx.com/mobile" style="display: inline-block; background: linear-gradient(135deg, #eab308, #f20550); color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 16px 40px; border-radius: 12px;">
        RANKING ANSEHEN
      </a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
      <p style="color: #666666; font-size: 12px; margin: 0;">
        © 2024 Best of GenX | Made with ❤️ for the 80s, 90s & 2000s Generation
      </p>
    </div>
    
  </div>
</body>
</html>
  `;
}

// Branded "Song Request" email sent to the BOGX team (contact@bestofgenx.com)
export function createSongRequestEmail(params: {
  username: string;
  playlist: string;
  band: string;
  song: string;
  link?: string | null;
}) {
  const { username, playlist, band, song, link } = params;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F5F5F0; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header / Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="https://bestofgenx.com/images/genxlogo1.png" alt="Best of GenX" style="height: 52px; object-fit: contain;" />
    </div>

    <!-- Main Card -->
    <div style="background-color: #ffffff; border: 1px solid #E8E4DC; border-radius: 16px; padding: 32px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      
      <!-- Badge -->
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; background-color: #FDF6EE; color: #D4873A; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 8px 16px; border-radius: 20px; border: 1px solid #F5E6D3;">
          Spotify Playlist Request
        </span>
      </div>

      <p style="color: #333333; font-size: 16px; margin: 0 0 16px 0; line-height: 1.5;">Hi Team,</p>
      <p style="color: #666666; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        <strong style="color: #D4873A;">${username}</strong> has requested a song for the
        <strong style="color: #D4873A;">${playlist}</strong> playlist:
      </p>

      <!-- Song Details -->
      <div style="background-color: #FAFAF8; border: 1px solid #E8E4DC; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #999999; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 10px 0; width: 100px; vertical-align: top;">Playlist</td>
            <td style="color: #333333; font-size: 15px; font-weight: 600; padding: 10px 0;">${playlist}</td>
          </tr>
          <tr>
            <td style="color: #999999; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 10px 0; border-top: 1px solid #E8E4DC; vertical-align: top;">Artist</td>
            <td style="color: #333333; font-size: 15px; font-weight: 600; padding: 10px 0; border-top: 1px solid #E8E4DC;">${band}</td>
          </tr>
          <tr>
            <td style="color: #999999; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 10px 0; border-top: 1px solid #E8E4DC; vertical-align: top;">Song</td>
            <td style="color: #333333; font-size: 15px; font-weight: 600; padding: 10px 0; border-top: 1px solid #E8E4DC;">${song}</td>
          </tr>
          ${link ? `<tr>
            <td style="color: #999999; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 10px 0; border-top: 1px solid #E8E4DC; vertical-align: top;">Link</td>
            <td style="padding: 10px 0; border-top: 1px solid #E8E4DC;"><a href="${link}" style="color: #D4873A; font-size: 14px; word-break: break-all;">${link}</a></td>
          </tr>` : ''}
        </table>
      </div>

      <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 0; text-align: center; font-style: italic;">
        Let's keep the GenX vibes alive!
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 20px;">
      <p style="color: #AAAAAA; font-size: 12px; margin: 0 0 8px 0;">
        Best of GenX &middot; The 80s, 90s & 2000s Trivia App
      </p>
      <p style="color: #CCCCCC; font-size: 11px; margin: 0;">
        <a href="https://bestofgenx.com" style="color: #D4873A; text-decoration: none;">bestofgenx.com</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

// Email sent to user when their song request is APPROVED
export function createSongApprovedEmail(params: {
  username: string;
  playlist: string;
  band: string;
  song: string;
}) {
  const { username, playlist, band, song } = params;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F5F5F0; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header / Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="https://bestofgenx.com/images/genxlogo1.png" alt="Best of GenX" style="height: 52px; object-fit: contain;" />
    </div>

    <!-- Main Card -->
    <div style="background-color: #ffffff; border: 1px solid #E8E4DC; border-radius: 16px; padding: 32px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      
      <!-- Success Badge -->
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; background-color: #ECFDF5; color: #059669; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 8px 16px; border-radius: 20px; border: 1px solid #A7F3D0;">
          Song Added
        </span>
      </div>

      <p style="color: #333333; font-size: 16px; margin: 0 0 16px 0; line-height: 1.5;">Hey ${username}!</p>
      <p style="color: #666666; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Great news! Your song request has been <strong style="color: #059669;">approved</strong> and added to our 
        <strong style="color: #D4873A;">${playlist}</strong> playlist!
      </p>

      <!-- Song Details -->
      <div style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6B7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0; width: 80px; vertical-align: top;">Artist</td>
            <td style="color: #333333; font-size: 15px; font-weight: 600; padding: 8px 0;">${band}</td>
          </tr>
          <tr>
            <td style="color: #6B7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0; border-top: 1px solid #A7F3D0; vertical-align: top;">Song</td>
            <td style="color: #333333; font-size: 15px; font-weight: 600; padding: 8px 0; border-top: 1px solid #A7F3D0;">${song}</td>
          </tr>
        </table>
      </div>

      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
        Thanks for helping us build the ultimate GenX playlist!<br>
        <span style="color: #D4873A; font-weight: 600;">Keep the suggestions coming!</span>
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://bestofgenx.com/mobile" style="display: inline-block; background-color: #D4873A; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px;">
        Open App
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 20px;">
      <p style="color: #AAAAAA; font-size: 12px; margin: 0 0 8px 0;">
        Best of GenX &middot; The 80s, 90s & 2000s Trivia App
      </p>
      <p style="color: #CCCCCC; font-size: 11px; margin: 0;">
        <a href="https://bestofgenx.com" style="color: #D4873A; text-decoration: none;">bestofgenx.com</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

// Email sent to user when their song request is REJECTED
export function createSongRejectedEmail(params: {
  username: string;
  playlist: string;
  band: string;
  song: string;
}) {
  const { username, playlist, band, song } = params;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F5F5F0; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header / Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="https://bestofgenx.com/images/genxlogo1.png" alt="Best of GenX" style="height: 52px; object-fit: contain;" />
    </div>

    <!-- Main Card -->
    <div style="background-color: #ffffff; border: 1px solid #E8E4DC; border-radius: 16px; padding: 32px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      
      <!-- Badge -->
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; background-color: #FEF2F2; color: #DC2626; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 8px 16px; border-radius: 20px; border: 1px solid #FECACA;">
          Not Added
        </span>
      </div>

      <p style="color: #333333; font-size: 16px; margin: 0 0 16px 0; line-height: 1.5;">Hey ${username},</p>
      <p style="color: #666666; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Thanks for your song suggestion! Unfortunately, we couldn't add this one to the 
        <strong style="color: #D4873A;">${playlist}</strong> playlist this time.
      </p>

      <!-- Song Details -->
      <div style="background-color: #FAFAF8; border: 1px solid #E8E4DC; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #999999; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0; width: 80px; vertical-align: top;">Artist</td>
            <td style="color: #666666; font-size: 15px; padding: 8px 0;">${band}</td>
          </tr>
          <tr>
            <td style="color: #999999; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0; border-top: 1px solid #E8E4DC; vertical-align: top;">Song</td>
            <td style="color: #666666; font-size: 15px; padding: 8px 0; border-top: 1px solid #E8E4DC;">${song}</td>
          </tr>
        </table>
      </div>

      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
        This could be because it doesn't quite fit the era or the playlist vibe.<br>
        <span style="color: #D4873A; font-weight: 600;">But don't stop suggesting — we love hearing from you!</span>
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://bestofgenx.com/mobile" style="display: inline-block; background-color: #D4873A; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px;">
        Suggest Another Song
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 20px;">
      <p style="color: #AAAAAA; font-size: 12px; margin: 0 0 8px 0;">
        Best of GenX &middot; The 80s, 90s & 2000s Trivia App
      </p>
      <p style="color: #CCCCCC; font-size: 11px; margin: 0;">
        <a href="https://bestofgenx.com" style="color: #D4873A; text-decoration: none;">bestofgenx.com</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

// Email sent to user when their song request is IN PROGRESS
export function createSongInProgressEmail(params: {
  username: string;
  playlist: string;
  band: string;
  song: string;
}) {
  const { username, playlist, band, song } = params;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F5F5F0; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header / Logo -->
    <div style="text-align: center; margin-bottom: 32px;">
      <img src="https://bestofgenx.com/images/genxlogo1.png" alt="Best of GenX" style="height: 52px; object-fit: contain;" />
    </div>

    <!-- Main Card -->
    <div style="background-color: #ffffff; border: 1px solid #E8E4DC; border-radius: 16px; padding: 32px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
      
      <!-- In Progress Badge -->
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; background-color: #FDF6EE; color: #D4873A; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 8px 16px; border-radius: 20px; border: 1px solid #F5E6D3;">
          Being Reviewed
        </span>
      </div>

      <p style="color: #333333; font-size: 16px; margin: 0 0 16px 0; line-height: 1.5;">Hey ${username}!</p>
      <p style="color: #666666; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
        Good news! We're currently reviewing your song request for the 
        <strong style="color: #D4873A;">${playlist}</strong> playlist.
      </p>

      <!-- Song Details -->
      <div style="background-color: #FDF6EE; border: 1px solid #F5E6D3; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6B7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0; width: 80px; vertical-align: top;">Artist</td>
            <td style="color: #333333; font-size: 15px; font-weight: 600; padding: 8px 0;">${band}</td>
          </tr>
          <tr>
            <td style="color: #6B7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 8px 0; border-top: 1px solid #F5E6D3; vertical-align: top;">Song</td>
            <td style="color: #333333; font-size: 15px; font-weight: 600; padding: 8px 0; border-top: 1px solid #F5E6D3;">${song}</td>
          </tr>
        </table>
      </div>

      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
        We'll let you know once we've made a decision.<br>
        <span style="color: #D4873A; font-weight: 600;">Thanks for your patience!</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding-top: 20px;">
      <p style="color: #AAAAAA; font-size: 12px; margin: 0 0 8px 0;">
        Best of GenX &middot; The 80s, 90s & 2000s Trivia App
      </p>
      <p style="color: #CCCCCC; font-size: 11px; margin: 0;">
        <a href="https://bestofgenx.com" style="color: #D4873A; text-decoration: none;">bestofgenx.com</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

// Email Verification Template - Using new base template
export function createVerificationEmail(username: string, verificationUrl: string) {
  return createBaseEmailTemplate({
    badgeIcon: '✉️',
    badgeText: 'Verify Your Email',
    title: 'Welcome to<br>Best of Gen<span style="color: #D4873A;">X</span>!',
    subtitle: 'thanks for signing up!',
    username: username,
    bodyContent: 'Please verify your email address to activate your account.',
    ctaText: 'Verify Email Address',
    ctaUrl: verificationUrl,
    footerNote: 'This link will expire in 24 hours.<br>If you didn\'t create an account, you can safely ignore this email.',
    footerLink: { text: 'Or copy and paste this link:', url: verificationUrl },
  });
}

// Password Reset Email Template - Using new base template
export function createPasswordResetEmail(username: string, resetUrl: string) {
  return createBaseEmailTemplate({
    badgeIcon: '🔐',
    badgeText: 'Password Reset',
    title: 'Reset Your Password',
    subtitle: 'we received a request to reset your password.',
    username: username,
    bodyContent: 'Click the button below to create a new password.',
    ctaText: 'Reset Password',
    ctaUrl: resetUrl,
    footerNote: 'This link will expire in 1 hour.<br>If you didn\'t request this, you can safely ignore this email.',
  });
}

// Send email function
export async function sendEmail(to: string, subject: string, html: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Best of GenX <noreply@bestofgenx.com>',
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error('Email send error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error };
  }
}

// Send notification emails to all subscribed users
export async function sendNotificationEmails(type: 'new_match' | '1h_reminder' | 'results', users: Array<{ email: string; username: string; rank?: number; points?: number }>) {
  const results = [];
  
  for (const user of users) {
    let subject = '';
    let html = '';
    
    switch (type) {
      case 'new_match':
        subject = '🎮 Neues Spiel gestartet! - Best of GenX';
        html = createNewMatchEmail(user.username);
        break;
      case '1h_reminder':
        subject = '⏰ Noch 1 Stunde bis zum nächsten Spiel! - Best of GenX';
        html = createReminderEmail(user.username, 1);
        break;
      case 'results':
        subject = '🏆 Die Ergebnisse sind da! - Best of GenX';
        html = createResultsEmail(user.username, user.rank || 0, user.points || 0);
        break;
    }
    
    const result = await sendEmail(user.email, subject, html);
    results.push({ email: user.email, ...result });
  }
  
  return results;
}
