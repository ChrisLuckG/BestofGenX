"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface DevLockScreenProps {
  children: React.ReactNode;
}

export default function DevLockScreen({ children }: DevLockScreenProps) {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check auth after mount - give AuthContext time to load from localStorage
  useEffect(() => {
    if (!mounted) return;
    
    // Small delay to let AuthContext load from localStorage
    const timer = setTimeout(() => {
      setCheckedAuth(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [mounted]);

  // Redirect to login page if not logged in (only after auth check)
  useEffect(() => {
    if (checkedAuth && !isLoggedIn) {
      router.replace('/');
    }
  }, [checkedAuth, isLoggedIn, router]);

  // Show nothing while mounting or checking auth
  if (!mounted || !checkedAuth) {
    return null;
  }

  // If not logged in after check, show nothing (redirecting)
  if (!isLoggedIn) {
    return null;
  }

  // User is logged in, show the app
  return <>{children}</>;
}
