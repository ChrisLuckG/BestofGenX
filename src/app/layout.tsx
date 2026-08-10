import type { Metadata } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

// Inter — body text, meta, small labels
const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "600", "700", "800"],
});

// Bebas Neue — headlines, nav labels, buttons, card titles
const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: "400",
});

export const metadata: Metadata = {
  title: "BOGX - Best of GenX",
  description: "Test your retro knowledge - 80s, 90s, Early 2000s!",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BOGX - Best of GenX",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    interactiveWidget: "resizes-visual",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${inter.variable} ${bebasNeue.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="theme-color" content="#F5F0E8" />
        <meta name="msapplication-navbutton-color" content="#F5F0E8" />
        <link rel="icon" href="/images/genxlogo1.png" type="image/png" sizes="32x32" />
        <link rel="shortcut icon" href="/images/genxlogo1.png" type="image/png" />
        <link rel="apple-touch-icon" href="/images/ioslogo.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/ioslogo.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-visual" />
        {/*
          Capture the PWA install prompt as early as possible.
          Chrome fires 'beforeinstallprompt' once, very soon after load - usually
          BEFORE React has hydrated and InstallBanner could attach its listener.
          Missing it means the banner can only show manual "Tap menu" instructions
          instead of a real Install button, which is why the button appeared on
          some devices but not others (pure timing luck).
          Stashing the event here makes it available whenever the banner mounts.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__bogxInstallPrompt = null;
              window.addEventListener('beforeinstallprompt', function (e) {
                e.preventDefault();
                window.__bogxInstallPrompt = e;
                window.dispatchEvent(new Event('bogx-install-prompt-ready'));
              });
              window.addEventListener('appinstalled', function () {
                window.__bogxInstallPrompt = null;
                try { localStorage.setItem('bogx_app_installed', 'true'); } catch (err) {}
              });
            `,
          }}
        />
        {/* Google AdSense */}
        <script 
          async 
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7466879486070831"
          crossOrigin="anonymous"
        />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
        {/* Register Service Worker for PWA */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('SW registered:', registration.scope);
                  }).catch(function(error) {
                    console.log('SW registration failed:', error);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
