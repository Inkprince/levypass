"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Marks its box with data-play the first time most of it is on screen, so a one-shot CSS
 * animation inside starts when someone can see it rather than on page load.
 */
export function PlayInView({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPlay(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-play={play ? "" : undefined} className={className}>
      {children}
    </div>
  );
}
