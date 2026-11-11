import Link from "next/link";
import type { ReactNode } from "react";
import { IlloBadge, IlloFeaturePhone, IlloGovernment, IlloReceipt, IlloScan, IlloStall } from "./illustrations";
import { Icon, Logo } from "./kit";

/*
 * Layout for the sign-in and lookup forms. Large screens: a forest panel on the left with the
 * logo and a drawing for who is signing in, the form on the right. Small screens: the plain
 * single column, with a small drawing above the title, same as PageShell.
 */

export type FormScene = "trader" | "register" | "code" | "officer" | "admin" | "receipt";

type Scene = { main: ReactNode; small?: ReactNode };

const SCENES: Record<FormScene, Scene> = {
  trader: {
    main: <IlloFeaturePhone />,
    small: <IlloFeaturePhone />,
  },
  register: {
    main: <IlloStall />,
    small: <IlloStall />,
  },
  code: {
    main: <IlloFeaturePhone code="000000" />,
  },
  officer: {
    main: <IlloScan />,
    small: <IlloBadge />,
  },
  admin: {
    main: <IlloGovernment />,
    small: <IlloGovernment />,
  },
  receipt: {
    main: <IlloReceipt />,
    small: <IlloReceipt />,
  },
};

/** The sun in the top corner of the panel. Decorative. */
function Sun() {
  return (
    <svg viewBox="0 0 120 120" className="absolute right-8 top-8 h-[104px] w-[104px]" aria-hidden="true">
      <g className="lp-rays" style={{ transformOrigin: "60px 60px" }}>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i * Math.PI) / 5;
          return <path key={i} d={`M${60 + Math.cos(a) * 42} ${60 + Math.sin(a) * 42} L${60 + Math.cos(a) * 54} ${60 + Math.sin(a) * 54}`} stroke="#ffc83d" strokeWidth={3.5} strokeLinecap="round" />;
        })}
      </g>
      <circle cx={60} cy={60} r={31} fill="#ffc83d" stroke="#0c1c15" strokeWidth={2.5} />
    </svg>
  );
}

export function FormShell({ scene, title, lead, back, children }: { scene: FormScene; title: string; lead?: ReactNode; back?: { href: string; label: string }; children: ReactNode }) {
  const s = SCENES[scene];
  const backLink = back ? (
    <Link href={back.href} className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-btn)] px-3 text-sm font-semibold text-ink-2 hover:bg-fill hover:text-ink">
      <Icon name="arrowLeft" size={16} stroke={2} />
      {back.label}
    </Link>
  ) : null;

  return (
    <div className="min-h-dvh bg-mist lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* left: the scene, large screens only */}
      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:p-4">
        <div className="relative h-full overflow-hidden rounded-[32px] bg-forest">
          <Sun />
          <Link href="/" aria-label="LevyPass home" className="absolute left-8 top-7 z-10">
            <Logo light size={30} />
          </Link>
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <div className="flex aspect-square w-[min(80%,72vh)] items-center justify-center rounded-full border-[3px] border-ink bg-cream">
              <div className="lp-float w-[86%] [animation-duration:7s] [&_svg]:h-auto [&_svg]:w-full">{s.main}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* right: the form */}
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-mist/85 backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:backdrop-blur-none">
          <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4 lg:h-20 lg:max-w-none lg:justify-end lg:px-10">
            <Link href="/" aria-label="LevyPass home" className="flex min-h-11 items-center lg:hidden">
              <Logo size={26} />
            </Link>
            {backLink}
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-12 pt-6 lg:max-w-[440px] lg:justify-center lg:pb-24 lg:pt-0">
          {s.small ? <div className="-mb-2 flex justify-start lg:hidden [&_svg]:h-[104px] [&_svg]:w-auto">{s.small}</div> : null}
          <div className="mb-1 lg:mb-3">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink lg:text-[40px]">{title}</h1>
            {lead ? <p className="mt-1.5 text-[15px] text-ink-2 lg:mt-2.5 lg:text-[16px]">{lead}</p> : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
