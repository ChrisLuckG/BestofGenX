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

export default function Home() {
  const userAgent = headers().get('user-agent') || '';
  const isMobile = /mobile|android|iphone/i.test(userAgent);
  redirect(isMobile ? '/mobile' : '/desktop');
}
