import type { ReactNode } from "react";

/** Officer screens are staff tools: they share the revenue office desk look. */
export default function OfficerLayout({ children }: { children: ReactNode }) {
  return <div className="desk min-h-dvh">{children}</div>;
}
