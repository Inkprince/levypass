import "server-only";
import QRCode from "qrcode";
import { signToken } from "@/core/tokens";
import { env } from "./env";
import { qrSigningKeys } from "./keys";

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
}

/** Public URL a trader's QR encodes: any phone camera opens it (TR-03). */
export async function traderPassUrl(traderId: string, tokenId: string): Promise<string> {
  const token = await signToken((await qrSigningKeys()).privateKey, { subjectId: traderId, tokenId });
  return `${env().PUBLIC_BASE_URL}/v/t/${token}`;
}

export async function officerIdUrl(officerId: string, tokenId: string): Promise<string> {
  const token = await signToken((await qrSigningKeys()).privateKey, { subjectId: officerId, tokenId });
  return `${env().PUBLIC_BASE_URL}/v/o/${token}`;
}
