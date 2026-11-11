/*
 * LevyPass illustrations. One ink line (2.5px, round joins) around flat fills,
 * with a darker face where an object needs depth. Everyday Lagos subjects:
 * market stalls, a danfo, an officer, a trader's phone. All decorative: aria-hidden.
 */

import { useId } from "react";

const INK = "#0c1c15";
const C = {
  ink: INK,
  forest: "#0f3d2e",
  forestDark: "#0a2c21",
  leaf: "#2f8f5b",
  leafDark: "#23744a",
  lime: "#a8e86b",
  cream: "#fbf8f1",
  sand: "#efe8d8",
  sandDark: "#e0d6c0",
  sun: "#ffc83d",
  tangerine: "#ff8a4c",
  coral: "#f0634f",
  tomato: "#e5533d",
  sky: "#cfe6ef",
  wood: "#c98a4b",
  woodDark: "#a86c35",
  skin: "#7a4a2e",
  skinDark: "#5e3720",
  danfo: "#f5b800",
  road: "#2e3833",
  paper: "#ffffff",
  go: "#0f7a4b",
};

const line = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** A thick limb drawn as an ink stroke with a coloured stroke on top. */
function Limb({ d, color, width = 9 }: { d: string; color: string; width?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={width + 5} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** Two eyes and a smile, centred on (cx, cy). */
function Face({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <g transform={s === 1 ? undefined : `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`}>
      <circle cx={cx - 5} cy={cy - 1} r={1.9} fill={INK} />
      <circle cx={cx + 5} cy={cy - 1} r={1.9} fill={INK} />
      <path d={`M${cx - 4} ${cy + 4} q4 3.6 8 0`} fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
    </g>
  );
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M8 40 a16 16 0 0 1 14-22 a24 24 0 0 1 44-8 a18 18 0 0 1 30 12 a13 13 0 0 1 4 26 h-86 a10 10 0 0 1 -6-8z"
      fill={C.paper}
      {...line}
    />
  );
}

/** A small QR-like grid, enough to read as "a code" at sticker size. */
function MiniQr({ x, y, size, color = C.forest }: { x: number; y: number; size: number; color?: string }) {
  const u = size / 7;
  const cells = ["1110111", "1010101", "1110111", "0001000", "1101011", "0110110", "1011101"];
  return (
    <g fill={color}>
      {cells.flatMap((row, r) => [...row].map((c, i) => (c === "1" ? <rect key={`${r}-${i}`} x={x + i * u} y={y + r * u} width={u} height={u} /> : null)))}
    </g>
  );
}

/** The LevyPass sticker every stall carries: lime header strip, QR below. */
function Sticker({ x, y, w = 34, h = 40 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={C.paper} {...line} />
      <path d={`M${x} ${y + 4} a4 4 0 0 1 4-4 h${w - 8} a4 4 0 0 1 4 4 v6 h-${w} z`} fill={C.lime} {...line} />
      <MiniQr x={x + (w - (h - 18)) / 2} y={y + 14} size={h - 18} />
    </g>
  );
}

function Awning({ x, y, n, colors }: { x: number; y: number; n: number; colors: [string, string] }) {
  const w = 28;
  const h = 34;
  const scallops = Array.from({ length: n }, () => `a14 14 0 0 1 -${w} 0`).join(" ");
  return (
    <g>
      <rect x={x - 6} y={y - 12} width={n * w + 12} height={13} rx={4} fill={C.forestDark} {...line} />
      {Array.from({ length: n }, (_, i) => (
        <g key={i} fill={colors[i % 2]}>
          <rect x={x + i * w} y={y} width={w} height={h} />
          <path d={`M${x + i * w} ${y + h} a14 14 0 0 0 ${w} 0 z`} />
        </g>
      ))}
      <path d={`M${x} ${y + h} V${y} H${x + n * w} V${y + h} ${scallops}`} fill="none" {...line} />
    </g>
  );
}

function Building({ x, y, w, h, cols, rows }: { x: number; y: number; w: number; h: number; cols: number; rows: number }) {
  const gx = (w - 16) / cols;
  const gy = Math.min(26, (h - 24) / rows);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={C.sand} {...line} />
      <rect x={x + w - 14} y={y} width={14} height={h} fill={C.sandDark} {...line} />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => <rect key={`${r}-${c}`} x={x + 8 + c * gx} y={y + 12 + r * gy} width={gx - 8} height={gy - 10} rx={1.5} fill={C.sandDark} />),
      )}
    </g>
  );
}

/** Full-width Lagos market scene: two stalls, a trader paying, an officer scanning, a danfo driving past in front. */
export function MarketScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 420" preserveAspectRatio="xMinYMax slice" className={className} aria-hidden="true">
      {/* sky */}
      <g className="lp-rays" style={{ transformOrigin: "1030px 92px" }}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <path key={i} d={`M${1030 + Math.cos(a) * 52} ${92 + Math.sin(a) * 52} L${1030 + Math.cos(a) * 62} ${92 + Math.sin(a) * 62}`} stroke={INK} strokeWidth={2.5} strokeLinecap="round" />;
        })}
      </g>
      <circle cx={1030} cy={92} r={42} fill={C.sun} {...line} />
      <g className="lp-cloud">
        <Cloud x={262} y={58} s={1.05} />
      </g>
      <g className="lp-cloud lp-cloud-slow">
        <Cloud x={690} y={30} s={0.85} />
      </g>
      <g className="lp-cloud lp-cloud-fast">
        <Cloud x={1080} y={150} s={0.7} />
      </g>

      {/* city behind */}
      <Building x={18} y={196} w={118} h={144} cols={3} rows={4} />
      <g>
        <path d="M186 118 V70" {...line} fill="none" />
        <circle cx={186} cy={66} r={5} fill={C.coral} {...line} />
        <Building x={150} y={118} w={72} h={222} cols={2} rows={7} />
      </g>
      <Building x={590} y={206} w={150} h={134} cols={4} rows={4} />
      <g>
        <path d="M800 226 a42 42 0 0 1 84 0 z" fill={C.sandDark} {...line} />
        <Building x={782} y={226} w={120} h={114} cols={3} rows={3} />
      </g>
      <Building x={1112} y={178} w={96} h={162} cols={2} rows={5} />

      {/* palm */}
      <g>
        <Limb d="M1160 342 C 1156 290 1168 240 1176 206" color={C.woodDark} width={10} />
        <g className="lp-sway lp-sway-slow" style={{ transformOrigin: "1176px 206px" }}>
        {["M1176 206 C 1150 190 1124 196 1108 214", "M1176 206 C 1160 176 1136 170 1118 176", "M1176 206 C 1186 178 1206 170 1226 176", "M1176 206 C 1204 194 1222 204 1234 222", "M1176 206 C 1178 184 1172 166 1162 154"].map((d) => (
          <path key={d} d={`${d} C ${d.split(" ").slice(-2).join(" ")} 1176 214 1176 206 z`} fill={C.leaf} {...line} />
        ))}
        </g>
      </g>

      {/* pavement and road */}
      <rect x={-10} y={336} width={1240} height={20} fill={C.sandDark} {...line} />
      <rect x={-10} y={356} width={1240} height={80} fill={C.road} />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={20 + i * 90} y={392} width={44} height={6} rx={3} fill={C.cream} opacity={0.75} />
      ))}

      {/* stall A: Mama Bisi, tomatoes and peppers */}
      <g>
        <rect x={64} y={150} width={9} height={188} fill={C.wood} {...line} />
        <rect x={318} y={150} width={9} height={188} fill={C.wood} {...line} />
        <Awning x={56} y={150} n={10} colors={[C.forest, C.cream]} />

        {/* trader */}
        <g className="lp-breathe">
        <circle cx={204} cy={218} r={18} fill={C.skin} {...line} />
        <path d="M170 204 C 168 176 226 168 238 194 C 250 186 262 196 252 206 C 232 214 190 214 170 204 Z" fill={C.tangerine} {...line} />
        <path d="M186 198 C 200 190 220 190 232 198" fill="none" {...line} strokeWidth={1.5} />
        <Face cx={208} cy={222} />
        <path d="M160 272 C 162 246 180 236 204 236 C 228 236 246 246 248 272 Z" fill={C.coral} {...line} />
        {([
          [182, 252],
          [204, 246],
          [226, 252],
          [194, 264],
          [216, 264],
        ] as const).map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={C.sun} />
        ))}
        <Limb d="M238 256 C 246 250 248 244 244 236" color={C.skin} width={8} />
        <rect x={236} y={214} width={17} height={27} rx={3} fill={C.ink} />
        <rect className="lp-pay" x={239} y={218} width={11} height={9} rx={1} fill={C.lime} />
        </g>

        {/* table and goods */}
        <rect x={70} y={270} width={252} height={12} rx={2} fill={C.wood} {...line} />
        <rect x={80} y={282} width={232} height={56} fill={C.woodDark} {...line} />
        <path d="M80 300 H312 M80 318 H312" stroke={INK} strokeWidth={1.5} opacity={0.5} />
        {([
          [98, 259],
          [120, 259],
          [109, 241],
        ] as const).map(([cx, cy]) => (
          <g key={`t${cx}${cy}`}>
            <circle cx={cx} cy={cy} r={11} fill={C.tomato} {...line} />
            <path d={`M${cx - 3} ${cy - 10} l3 3 l3 -3`} fill="none" stroke={C.leaf} strokeWidth={2.5} strokeLinecap="round" />
          </g>
        ))}
        {([
          [280, 259],
          [302, 259],
          [291, 241],
        ] as const).map(([cx, cy]) => (
          <ellipse key={`p${cx}${cy}`} cx={cx} cy={cy} rx={10} ry={11} fill={C.sun} {...line} />
        ))}
        <Sticker x={262} y={290} />
        <rect className="lp-glow" x={256} y={284} width={46} height={52} rx={8} fill="none" stroke={C.lime} strokeWidth={4} opacity={0} />
      </g>

      {/* receipt SMS arriving on the trader's phone */}
      <g className="lp-sms" opacity={0}>
        <path d="M232 160 h64 a10 10 0 0 1 10 10 v14 a10 10 0 0 1 -10 10 h-46 l-10 10 v-10 h-8 a10 10 0 0 1 -10 -10 v-14 a10 10 0 0 1 10 -10 z" fill={C.paper} {...line} />
        <rect x={232} y={168} width={18} height={14} rx={2} fill={C.lime} stroke={INK} strokeWidth={2} />
        <path d="M232 169 l9 7 l9 -7" fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <text x={256} y={181} fontSize={11} fontWeight={800} fill={INK}>
          Receipt
        </text>
      </g>

      {/* scan beam from officer's phone to the sticker */}
      <path className="lp-beam" d="M344 250 L262 292 L296 330 Z" fill={C.lime} opacity={0.45} />

      {/* officer */}
      <g className="lp-breathe lp-breathe-late">
        <rect x={396} y={284} width={13} height={52} rx={4} fill={C.ink} />
        <rect x={413} y={284} width={13} height={52} rx={4} fill={C.ink} />
        <path d="M388 340 h22 v-6 h-18 a4 4 0 0 0 -4 6z M410 340 h22 a4 4 0 0 0 -4-6 h-18z" fill={C.ink} />
        <rect x={386} y={214} width={52} height={76} rx={16} fill={C.forest} {...line} />
        <path d="M388 276 H436" stroke={INK} strokeWidth={2.5} />
        <rect x={419} y={230} width={10} height={13} rx={2} fill={C.lime} stroke={INK} strokeWidth={1.5} />
        <Limb d="M432 232 C 440 252 438 268 432 280" color={C.forest} width={10} />
        <Limb d="M392 230 C 380 238 368 246 356 250" color={C.forest} width={10} />
        <g className="lp-reach">
          <circle cx={352} cy={251} r={6} fill={C.skin} {...line} />
          <g transform="rotate(-14 346 248)">
            <rect x={334} y={228} width={20} height={34} rx={4} fill={C.ink} />
            <rect x={337} y={232} width={14} height={22} rx={2} fill={C.lime} />
          </g>
        </g>
        <rect x={403} y={198} width={14} height={18} fill={C.skin} {...line} />
        <circle cx={410} cy={192} r={18} fill={C.skin} {...line} />
        <path d="M391 188 C 391 166 431 164 431 186 Z" fill={C.forest} {...line} />
        <path d="M384 188 H416" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        <path d="M396 180 H428" stroke={C.lime} strokeWidth={3} />
        <Face cx={404} cy={199} />
      </g>

      {/* PAID bubble */}
      <g className="lp-paid" style={{ transformOrigin: "354px 214px" }}>
        <path d="M318 176 h74 a14 14 0 0 1 0 28 h-40 l-10 10 l-2 -10 h-22 a14 14 0 0 1 0 -28 z" fill={C.lime} {...line} />
        <path d="M318 190 l5 5 l9 -10" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <text x={340} y={195.5} fontSize={14} fontWeight={800} fill={INK} letterSpacing="-0.02em">
          PAID
        </text>
      </g>

      {/* stall B: fabrics */}
      <g>
        <rect x={478} y={164} width={9} height={174} fill={C.wood} {...line} />
        <rect x={732} y={164} width={9} height={174} fill={C.wood} {...line} />
        <Awning x={470} y={164} n={10} colors={[C.tangerine, C.cream]} />
        {[
          [500, C.forest, C.lime],
          [548, C.sun, C.coral],
          [596, C.coral, C.cream],
          [644, C.lime, C.forest],
          [692, C.forest, C.tangerine],
        ].map(([x, bg, dot]) => (
          <g key={x as number} className="lp-sway" style={{ transformOrigin: `${(x as number) + 17}px 198px`, animationDelay: `${-((x as number) % 7) * 0.6}s` }}>
            <path d={`M${x} 198 h34 v62 l-17 -8 l-17 8 z`} fill={bg as string} {...line} />
            <circle cx={(x as number) + 10} cy={214} r={3} fill={dot as string} />
            <circle cx={(x as number) + 24} cy={226} r={3} fill={dot as string} />
            <circle cx={(x as number) + 10} cy={238} r={3} fill={dot as string} />
          </g>
        ))}
        <rect x={484} y={278} width={252} height={12} rx={2} fill={C.wood} {...line} />
        <rect x={494} y={290} width={232} height={48} fill={C.woodDark} {...line} />
        {[
          [512, C.lime],
          [566, C.sun],
          [620, C.coral],
          [674, C.forest],
        ].map(([x, fill]) => (
          <rect key={x as number} x={x as number} y={262} width={46} height={16} rx={8} fill={fill as string} {...line} />
        ))}
        <Sticker x={680} y={296} w={30} h={34} />
      </g>

      {/* tree */}
      <g>
        <rect x={764} y={276} width={10} height={62} fill={C.woodDark} {...line} />
        <path className="lp-sway lp-sway-slow" style={{ transformOrigin: "769px 284px" }} d="M740 284 a22 22 0 0 1 2-40 a26 26 0 0 1 44-14 a22 22 0 0 1 22 34 a18 18 0 0 1 -14 22 z" fill={C.leaf} {...line} />
      </g>


      {/* danfo, in front of everything: drives in from the left, waits at the park, drives off right */}
      <g className="lp-drive">
        <g className="lp-idle">
          <rect x={846} y={238} width={170} height={10} rx={3} fill="none" {...line} />
          <rect x={858} y={220} width={40} height={18} rx={5} fill={C.coral} {...line} />
          <rect x={904} y={224} width={52} height={14} rx={5} fill={C.forest} {...line} />
          <rect x={962} y={218} width={34} height={20} rx={5} fill={C.lime} {...line} />
          <path d="M806 350 V282 C 806 262 818 250 838 250 H1078 C 1094 250 1104 258 1108 272 L1120 318 V350 Z" fill={C.danfo} {...line} />
          {[826, 878, 930, 982, 1034].map((x) => (
            <rect key={x} x={x} y={262} width={42} height={34} rx={4} fill={C.sky} stroke={INK} strokeWidth={2} />
          ))}
          <path d="M1086 262 H1096 L1108 298 H1086 Z" fill={C.sky} stroke={INK} strokeWidth={2} />
          <rect x={1089} y={266} width={11} height={13} rx={1.5} fill={C.lime} stroke={INK} strokeWidth={1.2} />
          <rect x={806} y={318} width={314} height={8} fill={C.ink} />
          <rect x={806} y={331} width={314} height={4} fill={C.ink} />
          <text x={826} y={312} fontSize={11} fontWeight={800} fill={INK} letterSpacing="0.08em">
            OSHODI - OBALENDE
          </text>
          <circle cx={1112} cy={338} r={5} fill={C.cream} stroke={INK} strokeWidth={2} />
          {[868, 1058].map((cx) => (
            <g key={cx} className="lp-roll">
              <circle cx={cx} cy={352} r={21} fill={C.ink} />
              <circle cx={cx} cy={352} r={8} fill="#9aa39e" />
              <path d={`M${cx} 340 V364 M${cx - 12} 352 H${cx + 12}`} stroke="#9aa39e" strokeWidth={2} />
            </g>
          ))}
        </g>
        {/* exhaust */}
        {[0, 0.8, 1.6].map((delay) => (
          <circle key={delay} className="lp-puff" style={{ animationDelay: `${delay}s` }} cx={798} cy={340} r={7} fill={C.paper} stroke={INK} strokeWidth={2} opacity={0} />
        ))}
      </g>
    </svg>
  );
}

/* ----------------------------------------------------------- spot drawings */

type Spot = { className?: string };

/** Government building with a green-white-green flag: money goes to the government's account. */
export function IlloGovernment({ className = "" }: Spot) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      <path d="M80 6 V30" {...line} fill="none" />
      <path d="M80 7 h12 v10 h-12" fill={C.paper} {...line} />
      <path d="M80 7 h4 v10 h-4z M88 7 h4 v10 h-4z" fill={C.leaf} />
      <path d="M80 7 h12 v10 h-12" fill="none" {...line} />
      <path d="M26 46 L80 26 L134 46 Z" fill={C.sun} {...line} />
      <rect x={30} y={46} width={100} height={10} fill={C.sand} {...line} />
      {[38, 60, 82, 104].map((x) => (
        <rect key={x} x={x} y={56} width={14} height={40} fill={C.cream} {...line} />
      ))}
      <rect x={24} y={96} width={112} height={8} fill={C.sand} {...line} />
      <rect x={16} y={104} width={128} height={9} fill={C.sandDark} {...line} />
      <circle cx={80} cy={39} r={4.5} fill={C.lime} stroke={INK} strokeWidth={2} />
    </svg>
  );
}

/** A receipt with a check stamp and a magnifier: anyone can check it. */
export function IlloReceipt({ className = "" }: Spot) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      <path d="M44 10 h64 v94 l-8 -6 l-8 6 l-8 -6 l-8 6 l-8 -6 l-8 6 l-8 -6 l-8 6 z" fill={C.paper} {...line} />
      <path d="M56 28 h40 M56 40 h40 M56 52 h24" stroke={INK} strokeWidth={2.5} strokeLinecap="round" opacity={0.35} />
      <circle cx={88} cy={74} r={15} fill={C.lime} {...line} />
      <path d="M81 74 l5 5 l9 -10" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={122} cy={44} r={16} fill={C.sky} {...line} />
      <Limb d="M133 56 L146 70" color={C.forest} width={7} />
    </svg>
  );
}

/** A feature phone with signal arcs, the LevyPass code on screen. */
export function IlloFeaturePhone({ className = "", code = "*347*13#" }: Spot & { code?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      <path d="M112 22 a18 18 0 0 1 14 14 M116 10 a30 30 0 0 1 22 22" fill="none" {...line} />
      <g transform="rotate(-8 80 64)">
        <rect x={50} y={6} width={58} height={110} rx={14} fill={C.forest} {...line} />
        <rect x={58} y={18} width={42} height={30} rx={4} fill={C.lime} {...line} />
        <text x={79} y={37} textAnchor="middle" fontSize={7} fontWeight={800} fill={INK} fontFamily="ui-monospace, monospace">
          {code}
        </text>
        {[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={60 + c * 13} y={58 + r * 12} width={10} height={7} rx={3} fill={C.cream} />))}
      </g>
    </svg>
  );
}

/** Stacked coins with a sprout: deposits that grow. */
export function IlloCoins({ className = "" }: Spot) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      {(
        [
          [52, 5],
          [96, 3],
        ] as const
      ).map(([x, n]) => (
        <g key={x}>
          {Array.from({ length: n }, (_, i) => (
            <g key={i}>
              <path d={`M${x - 22} ${104 - i * 12} v-8 a22 7 0 0 1 44 0 v8 a22 7 0 0 1 -44 0z`} fill={C.sun} {...line} />
            </g>
          ))}
          <ellipse cx={x} cy={104 - n * 12 + 4} rx={22} ry={7} fill={C.sun} {...line} />
        </g>
      ))}
      <text x={52} y={50} textAnchor="middle" fontSize={9} fontWeight={800} fill={INK}>
        ₦
      </text>
      <path d="M128 106 C 128 90 126 80 122 70" fill="none" {...line} />
      <path d="M122 70 C 108 66 102 54 104 44 C 118 46 124 58 122 70 Z" fill={C.leaf} {...line} />
      <path d="M124 82 C 136 76 146 78 150 86 C 140 94 130 90 124 82 Z" fill={C.lime} {...line} />
    </svg>
  );
}

function HandBack({ skin, sleeve }: { skin: string; sleeve: string }) {
  return (
    <g>
      <path d="M-8 36 H58 L64 84 H-8 Z" fill={sleeve} {...line} />
      <rect x={54} y={42} width={60} height={40} rx={17} fill={skin} {...line} />
      <rect x={92} y={56} width={58} height={11} rx={5.5} fill={skin} {...line} />
      <rect x={92} y={65} width={52} height={11} rx={5.5} fill={skin} {...line} />
      <rect x={90} y={74} width={42} height={10} rx={5} fill={skin} {...line} />
    </g>
  );
}

function HandThumb({ skin }: { skin: string }) {
  return <rect x={98} y={36} width={52} height={12} rx={6} transform="rotate(-10 98 42)" fill={skin} {...line} />;
}

/**
 * Two hands passing a receipt: the moment a levy is proven. Played once inside PlayInView: the
 * trader's hand brings the slip in and the check stamps on it. Still frame: both hands holding
 * the stamped slip.
 */
export function IlloHands({ className = "" }: Spot) {
  const mirror = "translate(320 0) scale(-1 1)";
  return (
    <svg viewBox="0 0 320 110" className={className} aria-hidden="true" overflow="visible">
      <g className="lp-hand-l">
        <HandBack skin={C.skin} sleeve={C.forest} />
      </g>
      <g className="lp-hand-r">
        <g transform={mirror}>
          <HandBack skin={C.skinDark} sleeve={C.tangerine} />
        </g>
      </g>
      <g className="lp-slip">
        <g transform="rotate(-6 160 56)">
          <rect x={136} y={20} width={48} height={62} rx={4} fill={C.paper} {...line} />
          <path d="M136 24 a4 4 0 0 1 4-4 h40 a4 4 0 0 1 4 4 v7 h-48z" fill={C.lime} {...line} />
          <path d="M146 44 h28 M146 54 h20" stroke={INK} strokeWidth={2.5} strokeLinecap="round" opacity={0.35} />
          <g className="lp-stamp">
            <circle cx={170} cy={68} r={8} fill={C.lime} stroke={INK} strokeWidth={2} />
            <path d="M166.2 68.2 l2.6 2.6 l5 -5.4" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </g>
      <g className="lp-hand-l">
        <HandThumb skin={C.skin} />
      </g>
      <g className="lp-hand-r">
        <g transform={mirror}>
          <HandThumb skin={C.skinDark} />
        </g>
      </g>
    </svg>
  );
}

/** A small stall with a striped awning and its LevyPass sticker. */
export function IlloStall({ className = "" }: Spot) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      <rect x={24} y={22} width={6} height={90} fill={C.wood} {...line} />
      <rect x={130} y={22} width={6} height={90} fill={C.wood} {...line} />
      <g transform="translate(-28 -116) scale(1)">
        <Awning x={46} y={146} n={4} colors={[C.forest, C.cream]} />
      </g>
      {([
        [56, 74],
        [74, 74],
        [65, 59],
      ] as const).map(([cx, cy]) => (
        <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={9} fill={C.tomato} {...line} />
      ))}
      <ellipse cx={104} cy={72} rx={14} ry={10} fill={C.sun} {...line} />
      <rect x={26} y={84} width={108} height={9} rx={2} fill={C.wood} {...line} />
      <rect x={34} y={93} width={92} height={20} fill={C.woodDark} {...line} />
      <Sticker x={98} y={96} w={18} h={22} />
    </svg>
  );
}

/** An officer's ID card on a lanyard. */
export function IlloBadge({ className = "" }: Spot) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      <path d="M58 2 L76 30 M102 2 L84 30" fill="none" stroke={C.forest} strokeWidth={6} strokeLinecap="round" />
      <rect x={74} y={26} width={12} height={10} rx={2} fill={C.sandDark} {...line} />
      <rect x={42} y={34} width={76} height={80} rx={10} fill={C.paper} {...line} />
      <path d="M42 44 a10 10 0 0 1 10-10 h56 a10 10 0 0 1 10 10 v8 h-76z" fill={C.forest} {...line} />
      <circle cx={62} cy={74} r={11} fill={C.skin} {...line} />
      <path d="M52 70 C 52 60 72 60 72 70 Z" fill={C.forest} />
      <Face cx={62} cy={77} s={0.55} />
      <path d="M80 68 h26 M80 78 h18" stroke={INK} strokeWidth={2.5} strokeLinecap="round" opacity={0.35} />
      <MiniQr x={80} y={88} size={18} />
      <circle cx={60} cy={102} r={6} fill={C.lime} stroke={INK} strokeWidth={2} />
    </svg>
  );
}

/** A phone scanning a QR sticker, the answer in a lime pill. */
export function IlloScan({ className = "" }: Spot) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true">
      <Sticker x={18} y={44} w={44} h={52} />
      <path d="M96 40 L58 52 L58 92 L96 88 Z" fill={C.lime} opacity={0.5} />
      <g transform="rotate(10 118 64)">
        <rect x={94} y={20} width={44} height={84} rx={9} fill={C.ink} {...line} />
        <rect x={99} y={28} width={34} height={64} rx={4} fill={C.go} />
        <path d="M108 60 l6 6 l11 -12" fill="none" stroke={C.paper} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ stamp */

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`;
};

/** A small four-point star, the stamp's side ornament. */
function Spark({ at }: { at: string }) {
  return <path transform={`translate(${at})`} d="M0 -4.2 Q0.7 -0.7 4.2 0 Q0.7 0.7 0 4.2 Q-0.7 0.7 -4.2 0 Q-0.7 -0.7 0 -4.2 Z" fill={INK} />;
}

/**
 * The Access Bank mark: three nested diamonds, the outer two open at the top left with their
 * right arm running on past the peak. Traced from the bank's published logo, drawn around 0,0
 * (x -73.8..73.8, y -83.3..73.8). It is the bank's mark, so it keeps its own orange and takes no
 * ink outline.
 */
const ACCESS_ORANGE = "#fe6309";
const ACCESS_MARK =
  "M-43 -30.8L-73.8 0L0 73.8L73.8 0L-9.5 -83.3V-70.3L60.8 0L0 60.8L-60.8 0L-30 -30.8Z" +
  "M-21.2 -30.8L-52 0L0 52L52 0L-9.5 -61.5V-48.5L39 0L0 39L-39 0L-8.2 -30.8Z" +
  "M0 -30.8L30.8 0L0 30.8L-30.8 0ZM0 -17.8L17.8 0L0 17.8L-17.8 0Z";

/**
 * Round rubber stamp for a settled payment: "Processed by Access Bank" over the top of the ring,
 * "Payment verified" under it, the Access Bank mark in the middle.
 */
export function BankStamp({ className = "" }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ring = { fontSize: 8, fontWeight: 800, letterSpacing: "0.07em", fill: INK } as const;
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Processed by Access Bank. Payment verified.">
      <defs>
        {/* top: clockwise from lower left over the top; bottom: anticlockwise under the centre */}
        <path id={`${id}-top`} d={`M${polar(43.5, 160)} A43.5 43.5 0 1 1 ${polar(43.5, 20)}`} />
        <path id={`${id}-bottom`} d={`M${polar(51, 148)} A51 51 0 0 0 ${polar(51, 32)}`} />
      </defs>
      <circle cx={60} cy={60} r={57} fill={C.lime} stroke={INK} strokeWidth={2.5} />
      <circle cx={60} cy={60} r={37} fill={C.cream} stroke={INK} strokeWidth={2.5} />
      <text {...ring}>
        <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
          PROCESSED BY ACCESS BANK
        </textPath>
      </text>
      <text {...ring} fontSize={7.5}>
        <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">
          PAYMENT VERIFIED
        </textPath>
      </text>
      <Spark at={polar(47.5, 155)} />
      <Spark at={polar(47.5, 25)} />

      {/* Access Bank mark, sat 2 units low so its tall right arm leaves the box centred */}
      <path transform="translate(60 62) scale(0.335)" d={ACCESS_MARK} fill={ACCESS_ORANGE} fillRule="evenodd" />
    </svg>
  );
}
