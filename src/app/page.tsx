import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

// ============================================================
// Entry point: nothing but a device redirect.
//
// Done on the server on purpose. The previous client-side version rendered a
// page and then called location.replace() in an effect, which meant a visible
// blank/loading flash - and, together with the old dev password gate that sent
// users back to `/`, an endless chain of full page loads (/ -> /desktop -> /)
// that pegged the CPU and froze the browser. A server redirect cannot loop:
// nothing redirects back here any more.
// ============================================================

// The query is passed on: push notifications and shared links point at "/?article=..." (lib/appLinks.ts)
// and the device decides which app opens it. Dropping it here lost every deep link.
export default function Home({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const userAgent = headers().get('user-agent') || '';
  const isMobile = /mobile|android|iphone/i.test(userAgent);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams || {})) for (const one of Array.isArray(v) ? v : v != null ? [v] : []) qs.append(k, one);
  const query = qs.toString();
  redirect((isMobile ? '/mobile' : '/desktop') + (query ? `?${query}` : ''));
}
