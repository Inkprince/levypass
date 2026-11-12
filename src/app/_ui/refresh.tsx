"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-reads the page from our database every few seconds while something is waiting (bank, office). */
export function Refresh({ every = 2000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}
