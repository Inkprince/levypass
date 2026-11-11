import Link from "next/link";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ brand */

/** The pass mark: a ticket with notched sides and a check. */
export function Mark({ size = 28, tone = "forest" }: { size?: number; tone?: "forest" | "lime" }) {
  const body = tone === "forest" ? "#0f3d2e" : "#a8e86b";
  const tick = tone === "forest" ? "#a8e86b" : "#0f3d2e";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <mask id={`lp-notch-${tone}`}>
        <rect width="32" height="32" fill="#fff" />
        <circle cx="0" cy="16" r="3.4" fill="#000" />
        <circle cx="32" cy="16" r="3.4" fill="#000" />
      </mask>
      <rect width="32" height="32" rx="9" fill={body} mask={`url(#lp-notch-${tone})`} />
      <path d="M10 16.4l4 4 8-8.6" stroke={tick} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ light = false, size = 28 }: { light?: boolean; size?: number }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[17px] font-bold tracking-[-0.03em] ${light ? "text-white" : "text-ink"}`}>
      <Mark size={size} tone={light ? "lime" : "forest"} />
      LevyPass
    </span>
  );
}

/** Payment channel as people say it: USSD, Card, Transfer. */
export function channelLabel(channel: string) {
  return ({ ussd: "USSD", card: "Card", transfer: "Transfer", virtual_account: "Virtual account", bank_transfer: "Transfer" } as Record<string, string>)[channel] ?? channel.replaceAll("_", " ");
}

/* ------------------------------------------------------------------ icons */

/** Hugeicons free set, stroke rounded (MIT, @hugeicons/core-free-icons 4.4.0). Shapes copied from the package. */
type IconShape = { readonly d: string } | { readonly cx: number; readonly cy: number; readonly r: number };
const shapes = {
  check: [{ d: "M5 14L8.5 17.5L19 6.5" }], // Tick02Icon
  x: [{ d: "M18.9991 19L5 5.00098" }, { d: "M19 5L5.00092 18.999" }], // Cancel01Icon
  alert: [{ d: "M13.9248 21H10.0752C5.44476 21 3.12955 21 2.27636 19.4939C1.42317 17.9879 2.60736 15.9914 4.97574 11.9985L6.90057 8.75333C9.17559 4.91778 10.3131 3 12 3C13.6869 3 14.8244 4.91777 17.0994 8.75332L19.0243 11.9985C21.3926 15.9914 22.5768 17.9879 21.7236 19.4939C20.8704 21 18.5552 21 13.9248 21Z" }, { d: "M12 9V13" }, { d: "M12.125 16.75H12M12.25 16.75C12.25 16.8881 12.1381 17 12 17C11.8619 17 11.75 16.8881 11.75 16.75C11.75 16.6119 11.8619 16.5 12 16.5C12.1381 16.5 12.25 16.6119 12.25 16.75Z" }], // Alert02Icon
  arrowRight: [{ d: "M18.5 12L4.99997 12" }, { d: "M13 18C13 18 19 13.5811 19 12C19 10.4188 13 6 13 6" }], // ArrowRight02Icon
  arrowLeft: [{ d: "M5.5 12.002H19" }, { d: "M10.9999 18.002C10.9999 18.002 4.99998 13.583 4.99997 12.0019C4.99996 10.4208 11 6.00195 11 6.00195" }], // ArrowLeft02Icon
  arrowUpRight: [{ d: "M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15M16.5 7.5L6.5 17.5" }], // ArrowUpRight01Icon
  search: [{ d: "M17 17L21 21" }, { d: "M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z" }], // Search01Icon
  chevronRight: [{ d: "M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" }], // ArrowRight01Icon
  phone: [{ d: "M13.5 2H10.5C8.14298 2 6.96447 2 6.23223 2.73223C5.5 3.46447 5.5 4.64298 5.5 7V17C5.5 19.357 5.5 20.5355 6.23223 21.2678C6.96447 22 8.14298 22 10.5 22H13.5C15.857 22 17.0355 22 17.7678 21.2678C18.5 20.5355 18.5 19.357 18.5 17V7C18.5 4.64298 18.5 3.46447 17.7678 2.73223C17.0355 2 15.857 2 13.5 2Z" }, { d: "M12.125 19H12M12.25 19C12.25 19.1381 12.1381 19.25 12 19.25C11.8619 19.25 11.75 19.1381 11.75 19C11.75 18.8619 11.8619 18.75 12 18.75C12.1381 18.75 12.25 18.8619 12.25 19Z" }], // SmartPhone01Icon
  scan: [{ d: "M2.5 8.18677C2.60406 6.08705 2.91537 4.77792 3.84664 3.84664C4.77792 2.91537 6.08705 2.60406 8.18677 2.5M21.5 8.18677C21.3959 6.08705 21.0846 4.77792 20.1534 3.84664C19.2221 2.91537 17.9129 2.60406 15.8132 2.5M15.8132 21.5C17.9129 21.3959 19.2221 21.0846 20.1534 20.1534C21.0846 19.2221 21.3959 17.9129 21.5 15.8132M8.18676 21.5C6.08705 21.3959 4.77792 21.0846 3.84664 20.1534C2.91537 19.2221 2.60406 17.9129 2.5 15.8132" }, { d: "M10 13C9.06812 13 8.60218 13 8.23463 12.8478C7.74458 12.6448 7.35523 12.2554 7.15224 11.7654C7 11.3978 7 10.9319 7 10C7 9.06812 7 8.60218 7.15224 8.23463C7.35523 7.74458 7.74458 7.35523 8.23463 7.15224C8.60218 7 9.06812 7 10 7C10.9319 7 11.3978 7 11.7654 7.15224C12.2554 7.35523 12.6448 7.74458 12.8478 8.23463C13 8.60218 13 9.06812 13 10C13 10.9319 13 11.3978 12.8478 11.7654C12.6448 12.2554 12.2554 12.6448 11.7654 12.8478C11.3978 13 10.9319 13 10 13Z" }, { d: "M17 7V7.01" }, { d: "M17 11V13C17 14.8856 17 15.8284 16.4142 16.4142C15.8284 17 14.8856 17 13 17" }, { d: "M9 17H7" }], // QrCodeScanIcon
  bank: [{ d: "M12.125 5.75H12M12.25 5.75C12.25 5.88807 12.1381 6 12 6C11.8619 6 11.75 5.88807 11.75 5.75C11.75 5.61193 11.8619 5.5 12 5.5C12.1381 5.5 12.25 5.61193 12.25 5.75Z" }, { d: "M9 9V19M5 19V9" }, { d: "M19 9V19M15 19V9" }, { d: "M2.64822 9H21.3518C21.7098 9 22 8.70651 22 8.34447C22 8.12259 21.889 7.91577 21.7051 7.79485L15.2699 3.56485C13.6829 2.52162 12.8893 2 12 2C11.1107 2 10.3171 2.52162 8.73007 3.56485L2.29495 7.79485C2.11099 7.91577 2 8.12259 2 8.34447C2 8.70651 2.29022 9 2.64822 9Z" }, { d: "M20.3519 19.5858L21.0397 20.2929C21.7464 21.0194 22.0998 21.3827 21.9754 21.6913C21.8511 22 21.3513 22 20.3519 22H3.64814C2.64867 22 2.14893 22 2.02456 21.6913C1.9002 21.3827 2.25356 21.0194 2.9603 20.2929L3.64814 19.5858C3.92929 19.2968 4.06987 19.1522 4.24863 19.0761C4.4274 19 4.62621 19 5.02382 19H18.9762C19.3738 19 19.5726 19 19.7514 19.0761C19.9301 19.1522 20.0707 19.2968 20.3519 19.5858Z" }], // BankIcon
  receipt: [{ d: "M4 18.6458V8.05426C4 5.20025 4 3.77325 4.87868 2.88663C5.75736 2 7.17157 2 10 2H14C16.8284 2 18.2426 2 19.1213 2.88663C20 3.77325 20 5.20025 20 8.05426V18.6458C20 20.1575 20 20.9133 19.538 21.2108C18.7831 21.6971 17.6161 20.6774 17.0291 20.3073C16.5441 20.0014 16.3017 19.8485 16.0325 19.8397C15.7417 19.8301 15.4949 19.9768 14.9709 20.3073L13.06 21.5124C12.5445 21.8374 12.2868 22 12 22C11.7132 22 11.4555 21.8374 10.94 21.5124L9.02913 20.3073C8.54415 20.0014 8.30166 19.8485 8.03253 19.8397C7.74172 19.8301 7.49493 19.9768 6.97087 20.3073C6.38395 20.6774 5.21687 21.6971 4.46195 21.2108C4 20.9133 4 20.1575 4 18.6458Z" }, { d: "M11 11H8" }, { d: "M14 7L8 7" }], // Invoice01Icon
  shield: [{ d: "M18.7088 3.49534C16.8165 2.55382 14.5009 2 12 2C9.4991 2 7.1835 2.55382 5.29116 3.49534C4.36318 3.95706 3.89919 4.18792 3.4496 4.91378C3 5.63965 3 6.34248 3 7.74814V11.2371C3 16.9205 7.54236 20.0804 10.173 21.4338C10.9067 21.8113 11.2735 22 12 22C12.7265 22 13.0933 21.8113 13.8269 21.4338C16.4576 20.0804 21 16.9205 21 11.2371L21 7.74814C21 6.34249 21 5.63966 20.5504 4.91378C20.1008 4.18791 19.6368 3.95706 18.7088 3.49534Z" }, { d: "M9 11.5C9 11.5 10.4079 11.7519 11 13.5C11 13.5 12.5 10.5 15 9.5" }], // SecurityCheckIcon
  ledger: [{ d: "M15.5 7H8.5M12.499 11H8.49902" }, { d: "M20 22H6C4.89543 22 4 21.1046 4 20M4 20C4 18.8954 4.89543 18 6 18H20V6C20 4.11438 20 3.17157 19.4142 2.58579C18.8284 2 17.8856 2 16 2H10C7.17157 2 5.75736 2 4.87868 2.87868C4 3.75736 4 5.17157 4 8V20Z" }, { d: "M19.5 18C19.5 18 18.5 18.7628 18.5 20C18.5 21.2372 19.5 22 19.5 22" }], // Book02Icon
  flag: [{ d: "M4 7L4 21" }, { d: "M11.7576 3.90865C8.45236 2.22497 5.85125 3.21144 4.55426 4.2192C4.32048 4.40085 4.20358 4.49167 4.10179 4.69967C4 4.90767 4 5.10138 4 5.4888V14.7319C4.9697 13.6342 7.87879 11.9328 11.7576 13.9086C15.224 15.6744 18.1741 14.9424 19.5697 14.1795C19.7633 14.0737 19.8601 14.0207 19.9301 13.9028C20 13.7849 20 13.6569 20 13.4009V5.87389C20 5.04538 20 4.63113 19.8027 4.48106C19.6053 4.33099 19.1436 4.459 18.2202 4.71504C16.64 5.15319 14.3423 5.22532 11.7576 3.90865Z" }], // Flag02Icon
  user: [{ d: "M20 21.0001C19.713 17.269 16.7289 14.3151 12.995 14.0662L12 13.9999C11.6446 14.0096 11.3134 14.0225 11.0008 14.0378C7.3 14.2192 4.28417 17.3057 4 21.0001" }, { cx: 12, cy: 6.99988, r: 4 }], // UserIcon
  users: [{ d: "M18.4995 20.5C18.2663 17.5685 15.8417 15.2477 12.808 15.0521L11.9995 15C11.7107 15.0076 11.4416 15.0178 11.1877 15.0298C8.18075 15.1723 5.7304 17.5974 5.49951 20.5" }, { d: "M15.2495 9.25C15.2495 11.0449 13.7944 12.5 11.9995 12.5C10.2046 12.5 8.74952 11.0449 8.74952 9.25C8.74952 7.45507 10.2046 6 11.9995 6C13.7944 6 15.2495 7.45507 15.2495 9.25Z" }, { d: "M5.50249 8.5C5.17908 7.99485 4.99158 7.39432 4.99158 6.75C4.99158 4.95507 6.44665 3.5 8.24157 3.5C8.68752 3.5 9.1125 3.58982 9.49939 3.75235" }, { d: "M18.4963 8.5C18.8197 7.99485 19.0072 7.39432 19.0072 6.75C19.0072 4.95507 17.5521 3.5 15.7572 3.5C15.3113 3.5 14.8863 3.58982 14.4994 3.75235" }, { d: "M22.0007 17.9996C21.8208 15.7374 19.9995 13.5 17.9995 13" }, { d: "M1.99927 17.9996C2.17923 15.7374 4.00049 13.5 6.00049 13" }], // UserGroupIcon
  grid: [{ d: "M13.6903 19.4567C13.5 18.9973 13.5 18.4149 13.5 17.25C13.5 16.0851 13.5 15.5027 13.6903 15.0433C13.944 14.4307 14.4307 13.944 15.0433 13.6903C15.5027 13.5 16.0851 13.5 17.25 13.5C18.4149 13.5 18.9973 13.5 19.4567 13.6903C20.0693 13.944 20.556 14.4307 20.8097 15.0433C21 15.5027 21 16.0851 21 17.25C21 18.4149 21 18.9973 20.8097 19.4567C20.556 20.0693 20.0693 20.556 19.4567 20.8097C18.9973 21 18.4149 21 17.25 21C16.0851 21 15.5027 21 15.0433 20.8097C14.4307 20.556 13.944 20.0693 13.6903 19.4567Z" }, { d: "M13.6903 8.95671C13.5 8.49728 13.5 7.91485 13.5 6.75C13.5 5.58515 13.5 5.00272 13.6903 4.54329C13.944 3.93072 14.4307 3.44404 15.0433 3.1903C15.5027 3 16.0851 3 17.25 3C18.4149 3 18.9973 3 19.4567 3.1903C20.0693 3.44404 20.556 3.93072 20.8097 4.54329C21 5.00272 21 5.58515 21 6.75C21 7.91485 21 8.49728 20.8097 8.95671C20.556 9.56928 20.0693 10.056 19.4567 10.3097C18.9973 10.5 18.4149 10.5 17.25 10.5C16.0851 10.5 15.5027 10.5 15.0433 10.3097C14.4307 10.056 13.944 9.56928 13.6903 8.95671Z" }, { d: "M3.1903 19.4567C3 18.9973 3 18.4149 3 17.25C3 16.0851 3 15.5027 3.1903 15.0433C3.44404 14.4307 3.93072 13.944 4.54329 13.6903C5.00272 13.5 5.58515 13.5 6.75 13.5C7.91485 13.5 8.49728 13.5 8.95671 13.6903C9.56928 13.944 10.056 14.4307 10.3097 15.0433C10.5 15.5027 10.5 16.0851 10.5 17.25C10.5 18.4149 10.5 18.9973 10.3097 19.4567C10.056 20.0693 9.56928 20.556 8.95671 20.8097C8.49728 21 7.91485 21 6.75 21C5.58515 21 5.00272 21 4.54329 20.8097C3.93072 20.556 3.44404 20.0693 3.1903 19.4567Z" }, { d: "M3.1903 8.95671C3 8.49728 3 7.91485 3 6.75C3 5.58515 3 5.00272 3.1903 4.54329C3.44404 3.93072 3.93072 3.44404 4.54329 3.1903C5.00272 3 5.58515 3 6.75 3C7.91485 3 8.49728 3 8.95671 3.1903C9.56928 3.44404 10.056 3.93072 10.3097 4.54329C10.5 5.00272 10.5 5.58515 10.5 6.75C10.5 7.91485 10.5 8.49728 10.3097 8.95671C10.056 9.56928 9.56928 10.056 8.95671 10.3097C8.49728 10.5 7.91485 10.5 6.75 10.5C5.58515 10.5 5.00272 10.5 4.54329 10.3097C3.93072 10.056 3.44404 9.56928 3.1903 8.95671Z" }], // DashboardSquare01Icon
  scale: [{ cx: 12, cy: 5, r: 2 }, { d: "M10 5H4M14 5H20" }, { d: "M17 21H7" }, { d: "M12 7V21" }, { d: "M16 14L18.5 8H19.5L22 14C22 15.6569 20.6569 17 19 17C17.3431 17 16 15.6569 16 14ZM22 14H16" }, { d: "M2 14L4.5 8H5.5L8 14C8 15.6569 6.65685 17 5 17C3.34315 17 2 15.6569 2 14ZM8 14H2" }], // BalanceScaleIcon
  bolt: [{ d: "M5.22576 11.3294L12.224 2.34651C12.7713 1.64397 13.7972 2.08124 13.7972 3.01707V9.96994C13.7972 10.5305 14.1995 10.985 14.6958 10.985H18.0996C18.8729 10.985 19.2851 12.0149 18.7742 12.6706L11.776 21.6535C11.2287 22.356 10.2028 21.9188 10.2028 20.9829V14.0301C10.2028 13.4695 9.80048 13.015 9.3042 13.015H5.90035C5.12711 13.015 4.71494 11.9851 5.22576 11.3294Z" }], // FlashIcon
  tag: [{ d: "M8 2H9.01472C10.241 2 10.8541 2 11.4054 2.22836C11.9567 2.45672 12.3903 2.89027 13.2574 3.75736L21.1262 11.6263C21.6841 12.1867 21.9982 12.9449 22 13.7357L22 13.75L22 13.7643C21.9982 14.5551 21.6841 15.3133 21.1262 15.8737L15.8737 21.1262C15.3133 21.6841 14.5551 21.9982 13.7643 22L13.75 22L13.7357 22C12.9449 21.9982 12.1867 21.6841 11.6263 21.1262L3.75736 13.2574C2.89027 12.3903 2.45672 11.9567 2.22836 11.4054C2 10.8541 2 10.241 2 9.01472V8C2 5.17157 2 3.75736 2.87868 2.87868C3.75736 2 5.17157 2 8 2Z" }, { d: "M7.5 7.25V7.5M8 7.5C8 7.77614 7.77614 8 7.5 8C7.22386 8 7 7.77614 7 7.5C7 7.22386 7.22386 7 7.5 7C7.77614 7 8 7.22386 8 7.5Z" }], // Tag01Icon
  qr: [{ d: "M3 6C3 4.58579 3 3.87868 3.43934 3.43934C3.87868 3 4.58579 3 6 3C7.41421 3 8.12132 3 8.56066 3.43934C9 3.87868 9 4.58579 9 6C9 7.41421 9 8.12132 8.56066 8.56066C8.12132 9 7.41421 9 6 9C4.58579 9 3.87868 9 3.43934 8.56066C3 8.12132 3 7.41421 3 6Z" }, { d: "M3 18C3 16.5858 3 15.8787 3.43934 15.4393C3.87868 15 4.58579 15 6 15C7.41421 15 8.12132 15 8.56066 15.4393C9 15.8787 9 16.5858 9 18C9 19.4142 9 20.1213 8.56066 20.5607C8.12132 21 7.41421 21 6 21C4.58579 21 3.87868 21 3.43934 20.5607C3 20.1213 3 19.4142 3 18Z" }, { d: "M3 12L9 12" }, { d: "M12 3V8" }, { d: "M15 6C15 4.58579 15 3.87868 15.4393 3.43934C15.8787 3 16.5858 3 18 3C19.4142 3 20.1213 3 20.5607 3.43934C21 3.87868 21 4.58579 21 6C21 7.41421 21 8.12132 20.5607 8.56066C20.1213 9 19.4142 9 18 9C16.5858 9 15.8787 9 15.4393 8.56066C15 8.12132 15 7.41421 15 6Z" }, { d: "M21 12H15C13.5858 12 12.8787 12 12.4393 12.4393C12 12.8787 12 13.5858 12 15M12 17.7692V20.5385M15 15V16.5C15 17.9464 15.7837 18 17 18C17.5523 18 18 18.4477 18 19M16 21H15M18 15C19.4142 15 20.1213 15 20.5607 15.44C21 15.8799 21 16.5881 21 18.0043C21 19.4206 21 20.1287 20.5607 20.5687C20.24 20.8898 19.7767 20.9766 19 21" }], // QrCodeIcon
  logout: [{ d: "M22 16.5V18C22 19.4142 22 20.1213 21.5607 20.5607C21.1213 21 20.4142 21 19 21H17.5M21 20L17 16" }, { d: "M17 12V8C17 5.17157 17 3.75736 16.1213 2.87868C15.2426 2 13.8284 2 11 2H10C7.17157 2 5.75736 2 4.87868 2.87868C4 3.75736 4 5.17157 4 8V14.9162C4 16.6626 4 17.5359 4.42445 18.2465C4.8489 18.9571 5.61774 19.3711 7.1554 20.1991L10.0568 21.7613C10.3477 21.918 10.673 22 11.0034 22C12.1061 22 13 21.1061 13 20.0034V10.7082C13 8.90398 13 8.00186 12.552 7.27691C12.1039 6.55195 11.297 6.14852 9.68328 5.34164L5 3" }], // Logout02Icon
  clock: [{ cx: 12, cy: 12, r: 10 }, { d: "M12 8V12L14 14" }], // Clock01Icon
  lock: [{ d: "M12 14.5V17.5M13 14.5C13 15.0523 12.5523 15.5 12 15.5C11.4477 15.5 11 15.0523 11 14.5C11 13.9477 11.4477 13.5 12 13.5C12.5523 13.5 13 13.9477 13 14.5Z" }, { d: "M16.5 9V6.5C16.5 4.01472 14.4853 2 12 2C9.51471 2 7.49999 4.01472 7.49999 6.5V9" }, { d: "M4.2678 18.8447C4.49268 20.515 5.87612 21.8235 7.55965 21.9009C8.97627 21.966 10.4153 22 12 22C13.5847 22 15.0237 21.966 16.4403 21.9009C18.1239 21.8235 19.5073 20.515 19.7322 18.8447C19.8789 17.7547 20 16.6376 20 15.5C20 14.3624 19.8789 13.2453 19.7322 12.1553C19.5073 10.485 18.1239 9.17649 16.4403 9.09909C15.0237 9.03397 13.5847 9 12 9C10.4153 9 8.97627 9.03397 7.55965 9.09909C5.87612 9.17649 4.49268 10.485 4.2678 12.1553C4.12104 13.2453 3.99999 14.3624 3.99999 15.5C3.99999 16.6376 4.12104 17.7547 4.2678 18.8447Z" }], // SquareLock02Icon
  message: [{ d: "M21.9598 12.9919C21.6856 17.2342 18.3536 20.6134 14.1706 20.8915C13.4574 20.9389 12.7285 21.001 12 21.001C10.4054 21.001 8.95127 20.8637 7.44544 20.2902C7.44544 20.2902 5.56108 21.7589 3.69962 21.4587C3.31009 21.3959 3.11532 21.3644 3.00091 21.1343C2.8865 20.9042 3.00788 20.6756 3.25063 20.2185C3.65964 19.4483 3.92248 18.6737 3.80076 17.8306C3.73703 17.3892 3.50433 16.9974 3.27644 16.6136L3.26529 16.5948C2.62637 15.5188 2.12462 14.2975 2.04024 12.9919C1.98659 12.1617 1.98659 11.3019 2.04024 10.4717C2.31441 6.22935 5.64639 2.85011 9.8294 2.57205C11.2536 2.47738 12.7435 2.47719 14.1706 2.57205C18.3536 2.85011 21.6856 6.22935 21.9598 10.4717C22.0134 11.3019 22.0134 12.1617 21.9598 12.9919Z" }, { d: "M8.75 14.501H15.25M8.75 9.50098H12.25" }], // Message01Icon
  refresh: [{ d: "M16.5 7.99976H18C19.4142 7.99976 20.1213 7.99976 20.5607 7.56042C21 7.12108 21 6.41397 21 4.99976V3.49976" }, { d: "M3 11.9998C3 7.02919 7.0293 2.99976 12 2.99976C15.571 2.99976 18.0948 4.73029 20 7.08347M21 11.9998C21 16.9703 16.9707 20.9998 12 20.9998C8.42904 20.9998 5.90524 19.2692 4 16.916" }, { d: "M7.5 15.9998H6C4.58579 15.9998 3.87868 15.9998 3.43934 16.4391C3 16.8784 3 17.5855 3 18.9998V20.4998" }], // ReloadIcon
  print: [{ d: "M17 17H18.6667C19.9128 17 20.5359 17 21 16.7321C21.304 16.5565 21.5565 16.304 21.732 16C22 15.5359 22 14.9128 22 13.6667C22 11.1744 22 9.9282 21.4641 9C21.113 8.39192 20.6081 7.88697 20 7.5359C19.0718 7 17.8256 7 15.3333 7H8.66667C6.17436 7 4.9282 7 4 7.5359C3.39192 7.88697 2.88697 8.39192 2.5359 9C2 9.9282 2 11.1744 2 13.6667C2 14.9128 2 15.5359 2.26795 16C2.44349 16.304 2.69596 16.5565 3 16.7321C3.4641 17 4.08718 17 5.33333 17H7" }, { d: "M17 7V5C17 3.58579 17 2.87868 16.5607 2.43934C16.1213 2 15.4142 2 14 2H10C8.58579 2 7.87868 2 7.43934 2.43934C7 2.87868 7 3.58579 7 5V7" }, { d: "M17 14V19C17 20.4142 17 21.1213 16.5607 21.5607C16.1213 22 15.4142 22 14 22H10C8.58579 22 7.87868 22 7.43934 21.5607C7 21.1213 7 20.4142 7 19V14H17Z" }, { d: "M18.8748 10.25H18.7498M18.9998 10.25C18.9998 10.3881 18.8879 10.5 18.7498 10.5C18.6117 10.5 18.4998 10.3881 18.4998 10.25C18.4998 10.1119 18.6117 10 18.7498 10C18.8879 10 18.9998 10.1119 18.9998 10.25Z" }], // PrinterIcon
  info: [{ cx: 12, cy: 12, r: 10 }, { d: "M12 16V12" }, { d: "M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z" }], // InformationCircleIcon
  card: [{ d: "M10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12C22 15.7712 22 17.6569 20.8284 18.8284C19.6569 20 17.7712 20 14 20H10C6.22876 20 4.34315 20 3.17157 18.8284C2 17.6569 2 15.7712 2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4Z" }, { d: "M2.5 9H21.5" }, { d: "M14 15L18 15" }], // CreditCardIcon
  transfer: [{ d: "M19 9H6.65856C5.65277 9 5.14987 9 5.02472 8.69134C4.89957 8.38268 5.25517 8.01942 5.96637 7.29289L8.21091 5" }, { d: "M5 15H17.3414C18.3472 15 18.8501 15 18.9753 15.3087C19.1004 15.6173 18.7448 15.9806 18.0336 16.7071L15.7891 19" }], // ArrowDataTransferHorizontalIcon
  hash: [{ d: "M14 21L18 3" }, { d: "M6 21L10 3" }, { d: "M5 8H21" }, { d: "M3 16H19" }], // HashtagIcon
  menu: [{ d: "M4 5L20 5" }, { d: "M4 12L20 12" }, { d: "M4 19L20 19" }], // Menu01Icon
} as const satisfies Record<string, readonly IconShape[]>;

export type IconName = keyof typeof shapes;

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {shapes[name].map((s: IconShape, i) => ("d" in s ? <path key={i} d={s.d} /> : <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />))}
    </svg>
  );
}

/* ---------------------------------------------------------------- actions */

type Variant = "primary" | "accent" | "secondary" | "outline" | "danger" | "ghost" | "inverse";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-forest text-white hover:bg-forest-2",
  accent: "bg-lime text-ink hover:bg-lime-2",
  secondary: "bg-fill text-ink hover:bg-fill-2",
  outline: "border border-line-2 bg-paper text-ink hover:border-ink-3",
  danger: "bg-stop text-white hover:bg-stop-fg",
  ghost: "text-forest hover:bg-fill",
  inverse: "bg-white/12 text-white hover:bg-white/20",
};
const sizeClass: Record<Size, string> = {
  sm: "min-h-9 px-3.5 text-[13px]",
  md: "min-h-11 px-5 text-[15px]",
  lg: "min-h-13 px-6 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className = "") {
  return `inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-btn)] font-semibold tracking-[-0.01em] transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 ${variantClass[variant]} ${sizeClass[size]} ${className}`;
}

export function Button({ children, variant = "primary", size = "md", className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button {...rest} className={buttonClass(variant, size, className)}>
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "primary", size = "md", className = "", target }: { href: string; children: ReactNode; variant?: Variant; size?: Size; className?: string; target?: string }) {
  return (
    <Link href={href} target={target} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

/** A text link with a trailing arrow, used for secondary navigation. */
export function ArrowLink({ href, children, className = "", target }: { href: string; children: ReactNode; className?: string; target?: string }) {
  return (
    <Link href={href} target={target} className={`group inline-flex min-h-11 items-center gap-1 font-semibold text-forest ${className}`}>
      {children}
      <Icon name="chevronRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ----------------------------------------------------------------- inputs */

export const inputClass =
  "min-h-12 w-full rounded-[var(--radius-input)] border border-line-2 bg-paper px-4 text-base text-ink outline-none transition placeholder:text-ink-3/70 focus:border-forest focus:ring-4 focus:ring-forest/10";

export function Field({ label, hint, className = "", ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <input {...rest} className={`${inputClass} ${className}`} />
      {hint ? <span className="text-[13px] text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function Select({ label, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="relative">
        <select {...rest} className={`${inputClass} appearance-none pr-10`}>
          {children}
        </select>
        <Icon name="chevronRight" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-ink-3" />
      </span>
    </label>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-[var(--radius-input)] bg-stop-bg px-4 py-3 text-sm font-medium text-stop-fg">
      <Icon name="alert" size={18} className="mt-px" />
      <span>{children}</span>
    </p>
  );
}

export function Note({ children, tone = "neutral", icon = "info" }: { children: ReactNode; tone?: "neutral" | "go" | "warn"; icon?: IconName }) {
  const style = { neutral: "bg-mist-2 text-ink-2", go: "bg-go-bg text-go-fg", warn: "bg-warn-bg text-warn-fg" }[tone];
  return (
    <p className={`flex items-start gap-2.5 rounded-[var(--radius-input)] px-4 py-3 text-sm font-medium ${style}`}>
      <Icon name={icon} size={18} className="mt-px" />
      <span>{children}</span>
    </p>
  );
}

/* ----------------------------------------------------------------- status */

export type Tone = "paid" | "unpaid" | "warn" | "neutral";
const toneStyle: Record<Tone, string> = {
  paid: "bg-go-bg text-go-fg",
  unpaid: "bg-stop-bg text-stop-fg",
  warn: "bg-warn-bg text-warn-fg",
  neutral: "bg-mist-2 text-ink-2",
};
const toneIcon: Record<Tone, IconName> = { paid: "check", unpaid: "x", warn: "alert", neutral: "info" };

/** Status always shows an icon and a word, never colour alone (PRD section 5). */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[var(--radius-chip)] py-0.5 pl-1.5 pr-2.5 text-[12px] font-semibold ${toneStyle[tone]}`}>
      <Icon name={toneIcon[tone]} size={14} />
      <span className="inline-block first-letter:uppercase">{children}</span>
    </span>
  );
}

const tagDot: Record<Tone, string> = { paid: "bg-go", unpaid: "bg-stop", warn: "bg-warn", neutral: "bg-ink-3" };

/** Kalimo-style tag: a white chip with a coloured dot and a word. */
export function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-paper px-2.5 py-1 text-[12px] font-medium text-ink">
      <span className={`h-1.5 w-1.5 rounded-full ${tagDot[tone]}`} aria-hidden="true" />
      <span className="inline-block first-letter:uppercase">{children}</span>
    </span>
  );
}

const panelStyle: Record<Tone, { bg: string; dot: string; icon: IconName }> = {
  paid: { bg: "bg-go text-white", dot: "bg-white text-go", icon: "check" },
  unpaid: { bg: "bg-stop text-white", dot: "bg-white text-stop", icon: "x" },
  warn: { bg: "bg-night text-white", dot: "bg-warn text-night", icon: "alert" },
  neutral: { bg: "bg-forest text-white", dot: "bg-lime text-forest", icon: "info" },
};

/** The one big answer on a verification screen: icon, word, then context. */
export function StatusPanel({ tone, word, sub, children, className = "" }: { tone: Tone; word: string; sub?: ReactNode; children?: ReactNode; className?: string }) {
  const s = panelStyle[tone];
  return (
    <section className={`animate-fadein flex flex-col items-center gap-3 rounded-[var(--radius-card)] px-6 py-9 text-center ${s.bg} ${className}`} role="status">
      <span className={`animate-pop flex h-[72px] w-[72px] items-center justify-center rounded-full ${s.dot}`}>
        <Icon name={s.icon} size={tone === "warn" ? 36 : 40} />
      </span>
      <p className="display text-[40px] uppercase leading-none sm:text-5xl">{word}</p>
      {sub ? <div className="max-w-sm text-[15px] text-white/85">{sub}</div> : null}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- containers */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[var(--radius-card)] border border-[var(--card-border)] bg-[var(--card-bg)] p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[18px] font-medium tracking-[-0.03em] text-ink">{children}</h2>
      {aside}
    </div>
  );
}

/** Label and value rows divided by hairlines. */
export function Rows({ rows, className = "" }: { rows: [ReactNode, ReactNode, boolean?][]; className?: string }) {
  return (
    <dl className={`divide-y divide-line text-[15px] ${className}`}>
      {rows.map(([k, v, strong], i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className={strong ? "font-semibold text-ink" : "text-ink-2"}>{k}</dt>
          <dd className={`text-right tnum ${strong ? "font-bold text-ink" : "font-medium text-ink"}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[13px] font-medium text-ink-2">{label}</p>
      <p className="money text-[28px] leading-none text-ink">{value}</p>
      {sub ? <p className="text-[13px] text-ink-3">{sub}</p> : null}
    </div>
  );
}

/** Page header for app screens: title, an optional muted lead, and actions. */
export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[34px] font-medium leading-[1.02] tracking-[-0.05em] text-ink sm:text-[44px]">{title}</h1>
        {lead ? <p className="mt-3 max-w-2xl text-[15px] text-ink-2">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Shell for the phone-first screens: traders, officers and public checks. */
export function PageShell({ children, title, lead, back, art, wide = false }: { children?: ReactNode; title?: string; lead?: ReactNode; back?: { href: string; label: string }; art?: ReactNode; wide?: boolean }) {
  const width = wide ? "max-w-none gutter" : "max-w-md px-4";
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className={`mx-auto flex h-14 items-center justify-between ${width}`}>
          <Link href="/" aria-label="LevyPass home" className="flex min-h-11 items-center">
            <Logo size={26} />
          </Link>
          {back ? (
            <Link href={back.href} className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-btn)] px-3 text-sm font-semibold text-ink-2 hover:bg-fill hover:text-ink">
              <Icon name="arrowLeft" size={16} />
              {back.label}
            </Link>
          ) : null}
        </div>
      </header>
      <main className={`mx-auto flex flex-col gap-4 pb-12 pt-6 ${width}`}>
        {art ? <div className="-mb-2 flex justify-start [&_svg]:h-[104px] [&_svg]:w-auto">{art}</div> : null}
        {title ? (
          <div className="mb-1">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-ink">{title}</h1>
            {lead ? <p className="mt-1.5 text-[15px] text-ink-2">{lead}</p> : null}
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
