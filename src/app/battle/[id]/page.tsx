"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function BattleInvitePage() {
  const params = useParams();
  const router = useRouter();
  const battleId = params.id as string;

  useEffect(() => {
    // Redirect to main app with battle ID as parameter
    // The main app will handle showing the battle
    if (battleId) {
      router.replace(`/?battle=${battleId}`);
    }
  }, [battleId, router]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#E36B11] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading battle...</p>
      </div>
    </div>
  );
}
