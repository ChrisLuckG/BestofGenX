// The AdSense loader - ONLY on content pages (the article page, the magazine). Not in the root layout: auto ads
// on game, login, loading and notification screens are "ads on screens without publisher content", the reason
// the site was refused (19.10.2026). A plain <script>, as Google gives it: next/script adds a data-nscript
// attribute that AdSense complains about ("AdSense head tag doesn't support data-nscript attribute").
export const ADSENSE_CLIENT = "ca-pub-7466879486070831";

export default function AdSenseScript() {
  return (
    <script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
      crossOrigin="anonymous"
    />
  );
}
