require('dotenv').config({path: '.env.local'});
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  
  <!-- Main Container -->
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    
    <!-- White Card -->
    <div style="background-color:#ffffff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
      
      <!-- Header -->
      <div style="background-color:#000000;padding:24px;text-align:center;">
        <img src="https://sporttock.vercel.app/images/genxlogo.png" alt="Best of GenX" style="width:auto;height:80px;display:inline-block;"/>
      </div>
      
      <!-- Content -->
      <div style="padding:32px 24px;">
        
        <!-- Greeting -->
        <h1 style="color:#1a1a1a;font-size:20px;font-weight:600;margin:0 0 8px 0;">Vielen Dank für deine Bestellung!</h1>
        <p style="color:#666666;font-size:14px;margin:0 0 24px 0;line-height:1.5;">
          Hallo Christian, wir haben deine Bestellung erhalten und sie wird jetzt für dich produziert.
        </p>
        
        <!-- Order Box -->
        <div style="background-color:#f9f9f9;border:1px solid #e5e5e5;border-radius:6px;padding:16px;margin-bottom:20px;">
          <p style="color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0;">Bestellung</p>
          <p style="color:#1a1a1a;font-size:14px;margin:0 0 4px 0;">1x Unisex Softstyle T-Shirt (Größe L)</p>
          <p style="color:#1a1a1a;font-size:16px;font-weight:600;margin:12px 0 0 0;">€22,99</p>
        </div>
        
        <!-- Shipping Box -->
        <div style="background-color:#f9f9f9;border:1px solid #e5e5e5;border-radius:6px;padding:16px;margin-bottom:24px;">
          <p style="color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px 0;">Lieferadresse</p>
          <p style="color:#1a1a1a;font-size:14px;line-height:1.5;margin:0;">
            Christian Glück<br/>
            Zabelstraße 22<br/>
            07545 Gera, Deutschland
          </p>
        </div>
        
        <!-- Delivery Estimate -->
        <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;margin-bottom:20px;">
          <p style="color:#166534;font-size:13px;margin:0;">
            <strong>Geschätzte Lieferung:</strong> 7-10 Werktage
          </p>
        </div>
        
        <!-- Info -->
        <p style="color:#666666;font-size:13px;line-height:1.6;margin:0;">
          Du erhältst eine weitere E-Mail mit Tracking-Informationen, sobald dein Paket unterwegs ist.
        </p>
        
      </div>
      
      <!-- Footer -->
      <div style="border-top:1px solid #e5e5e5;padding:20px 24px;text-align:center;">
        <p style="color:#666666;font-size:12px;margin:0 0 8px 0;">
          <strong>Fragen zu deiner Bestellung?</strong>
        </p>
        <p style="color:#999999;font-size:11px;line-height:1.6;margin:0;">
          E-Mail: support@bestofgenx.com<br/>
          Web: www.bestofgenx.com
        </p>
        <p style="color:#bbbbbb;font-size:10px;margin:16px 0 0 0;">
          Best of GenX · Zabelstraße 22 · 07545 Gera · Deutschland
        </p>
      </div>
      
    </div>
    
  </div>
</body>
</html>
`;

resend.emails.send({
  from: 'Best of GenX <orders@resend.dev>',
  to: 'scouthunter16@gmail.com',
  subject: 'Deine Best of GenX Bestellung ist bestätigt',
  html: html
}).then(r => {
  console.log('✅ E-Mail gesendet!', r);
}).catch(e => {
  console.log('❌ Fehler:', e);
});
