"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SITE_PASSWORD = process.env.NEXT_PUBLIC_SITE_PASSWORD || 'bogx2025';
const STORAGE_KEY = 'bogx_site_access';

interface DevLockScreenProps {
  children: React.ReactNode;
}

export default function DevLockScreen({ children }: DevLockScreenProps) {
  const router = useRouter();
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    const siteAccess = localStorage.getItem(STORAGE_KEY);
    const user = localStorage.getItem('sporttock_user');
    if (siteAccess === SITE_PASSWORD) {
      setGranted(true);
    } else {
      router.replace('/');
    }
  }, [router]);

  if (!granted) return null;

  return <>{children}</>;
}
