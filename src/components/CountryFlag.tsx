"use client";

// Convert a flag emoji (regional indicators) to ISO 3166-1 alpha-2 code.
// Windows can't render flag emojis, so we map to real flag images via flagcdn.
function flagEmojiToCode(flag?: string): string | null {
  if (!flag) return null;
  // If it's already an ISO code (2 letters, ASCII)
  if (flag.length === 2 && flag.charCodeAt(0) < 127) {
    return flag.toLowerCase();
  }
  // Convert emoji to code
  const cps = Array.from(flag).map((c) => c.codePointAt(0) ?? 0);
  if (cps.length >= 2 && cps[0] >= 0x1f1e6 && cps[0] <= 0x1f1ff && cps[1] >= 0x1f1e6 && cps[1] <= 0x1f1ff) {
    const a = String.fromCharCode(cps[0] - 0x1f1e6 + 65);
    const b = String.fromCharCode(cps[1] - 0x1f1e6 + 65);
    return (a + b).toLowerCase();
  }
  return null;
}

interface CountryFlagProps {
  flag?: string;
  className?: string;
}

export default function CountryFlag({ flag, className = "w-5 h-4 rounded-[2px]" }: CountryFlagProps) {
  const code = flagEmojiToCode(flag);
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/24x18/${code}.png`}
      srcSet={`https://flagcdn.com/48x36/${code}.png 2x`}
      alt=""
      className={className}
    />
  );
}
