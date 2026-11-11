"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName, buttonClass } from "./kit";

export type MenuLink = { href: string; label: string; icon: IconName };

/**
 * The home page menu below 1024 px: a 44 px button in the header opens a panel under it with
 * every link and the two account actions. Escape, a tap outside or choosing a link closes it.
 */
export function MobileMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onResize = () => window.matchMedia("(min-width: 1024px)").matches && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-fill"
      >
        <Icon name={open ? "x" : "menu"} size={26} solid />
      </button>
      {open ? (
        <>
          <div className="animate-fadein absolute inset-x-0 top-full h-dvh bg-ink/25" aria-hidden="true" onClick={close} />
          <div ref={panel} id={id} className="animate-fadein absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-line bg-cream shadow-[0_24px_40px_-24px_rgb(12_28_21/0.35)]">
            <nav aria-label="Menu" className="gutter flex flex-col py-3">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={close} className="flex min-h-14 items-center gap-3.5 border-b border-line text-[17px] font-semibold text-ink last:border-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mist-2 text-forest">
                    <Icon name={l.icon} size={18} />
                  </span>
                  {l.label}
                  <Icon name="chevronRight" size={18} stroke={2} className="ml-auto text-ink-3" />
                </Link>
              ))}
            </nav>
            <div className="gutter grid grid-cols-2 gap-2.5 pb-6 pt-1">
              <Link href="/login" onClick={close} className={buttonClass("primary", "lg", "w-full")}>
                Log in
              </Link>
              <Link href="/register" onClick={close} className={buttonClass("secondary", "lg", "w-full")}>
                Register
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
