"use client";

import { useEffect, useState } from "react";
import AlertModal from "./AlertModal";

// Lands here from Stripe (?donation=thanks&session_id=...). Confirms the payment with the
// server - which also records it, so the war chest is right even before the webhook
// arrives - shows the thank-you, and removes the parameters from the address bar.
export default function DonationThanks() {
  const [thanks, setThanks] = useState<{ amount: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('donation');
    if (!state) return;
    const sessionId = params.get('session_id');

    const url = new URL(window.location.href);
    url.searchParams.delete('donation');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);

    if (state !== 'thanks' || !sessionId) return;
    fetch(`/api/donate/verify?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(d => { if (d.success && d.paid) setThanks({ amount: d.amountEur }); })
      .catch(() => {});
  }, []);

  return (
    <AlertModal
      show={!!thanks}
      type="success"
      title="THANK YOU!"
      message={thanks ? `Your €${thanks.amount.toLocaleString('de-DE', { maximumFractionDigits: 2 })} just went into the war chest. No perks, just my eternal gratitude.` : ''}
      buttonText="You're welcome"
      onClose={() => setThanks(null)}
    />
  );
}
