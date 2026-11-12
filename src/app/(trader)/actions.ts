"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBank } from "@/server/bank";
import { issueOtp, verifyOtp } from "@/server/auth/otp";
import { createSession, endSession, requireSubject } from "@/server/auth/session";
import { normalisePhone } from "@/server/phone";
import { startPayment } from "@/server/payments/start";
import { answerHandover, askToPayCash, cancelCashAsk } from "@/server/cash/handovers";
import { reissueCard } from "@/server/traders/reissue";
import { createTrader, openRegistration, phoneTaken, registrationInput, stallTaken, sealRegistration, traderByPhone } from "@/server/traders/register";
import { isLocale } from "@/messages";

export type FormState = { error?: string };

export async function registerStart(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registrationInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  if (await phoneTaken(parsed.data.phone)) return { error: "This phone number is already registered. Log in instead." };
  if (await stallTaken(parsed.data.marketId, parsed.data.stallOrVehicle)) return { error: "This stall or vehicle number is already registered in this market. Check the number, or ask the revenue office." };
  (await cookies()).set("lp_reg", sealRegistration(parsed.data), { httpOnly: true, sameSite: "lax", maxAge: 900, path: "/" });
  await issueOtp(parsed.data.phone, "register", isLocale(parsed.data.locale) ? parsed.data.locale : "en");
  redirect("/register/verify");
}

export async function registerVerify(_: FormState, form: FormData): Promise<FormState> {
  const reg = openRegistration((await cookies()).get("lp_reg")?.value);
  if (!reg) return { error: "Your registration expired. Please start again." };
  if (!(await verifyOtp(reg.phone, "register", String(form.get("code") ?? "")))) return { error: "That code is wrong or has expired." };
  if (await phoneTaken(reg.phone)) return { error: "This phone number is already registered. Log in instead." };
  if (await stallTaken(reg.marketId, reg.stallOrVehicle)) return { error: "This stall or vehicle number is already registered in this market. Check the number, or ask the revenue office." };
  const traderId = await createTrader(reg);
  (await cookies()).delete("lp_reg");
  await createSession("trader", traderId);
  redirect("/pass?welcome=1");
}

export async function loginStart(_: FormState, form: FormData): Promise<FormState> {
  const phone = normalisePhone(String(form.get("phone") ?? ""));
  if (!phone) return { error: "Enter a Nigerian phone number, for example 0803 000 0000." };
  const trader = await traderByPhone(phone);
  if (!trader) return { error: "This number is not registered yet." };
  await issueOtp(phone, "login", isLocale(trader.locale) ? trader.locale : "en");
  (await cookies()).set("lp_login", phone, { httpOnly: true, sameSite: "lax", maxAge: 900, path: "/" });
  redirect("/login/verify");
}

export async function loginVerify(_: FormState, form: FormData): Promise<FormState> {
  const phone = (await cookies()).get("lp_login")?.value;
  if (!phone) return { error: "Your login expired. Please start again." };
  if (!(await verifyOtp(phone, "login", String(form.get("code") ?? "")))) return { error: "That code is wrong or has expired." };
  const trader = await traderByPhone(phone);
  if (!trader) return { error: "This number is not registered yet." };
  await createSession("trader", trader.id);
  redirect("/pass");
}

export async function payNow(form: FormData): Promise<void> {
  const traderId = await requireSubject("trader");
  const amount = Number(form.get("amountKobo") ?? 0);
  const purpose = form.get("purpose") === "ahead" ? "ahead" : "owed";
  const p = await startPayment({ traderId, channel: "ussd", amountKobo: amount > 0 ? amount : undefined, purpose });
  redirect(`/pay/${p.paymentId}`);
}

/** Sandbox stand-in for the trader finishing the bank's USSD session on their phone. */
export async function completeUssd(form: FormData): Promise<void> {
  await requireSubject("trader");
  const id = String(form.get("paymentId"));
  await getBank().simulateUssd(id);
  redirect(`/pay/${id}`);
}

export async function traderLogout(): Promise<void> {
  await endSession("trader");
  redirect("/");
}

/** TR-08: the trader cancels a lost or damaged card and gets a new one. Asked twice, never by accident. */
export async function reissueMyCard(form: FormData): Promise<void> {
  const traderId = await requireSubject("trader");
  if (form.get("confirm") !== "yes") redirect("/pass/card");
  await reissueCard(traderId, { type: "trader", id: traderId });
  redirect("/pass/card?new=1");
}

/** The trader will pay cash to an officer: officers of their market now see them waiting. */
export async function askCash(): Promise<void> {
  const traderId = await requireSubject("trader");
  const r = await askToPayCash(traderId);
  redirect(r.ok ? "/pass" : `/pass?cash=${encodeURIComponent(r.error)}`);
}

export async function cancelCash(): Promise<void> {
  const traderId = await requireSubject("trader");
  await cancelCashAsk(traderId);
  redirect("/pass");
}

/** "Did you hand this cash to this officer?" A "no" goes to the revenue office as a fraud flag. */
export async function answerCash(form: FormData): Promise<void> {
  const traderId = await requireSubject("trader");
  const answer = form.get("answer") === "no" ? "no" : "yes";
  await answerHandover(traderId, String(form.get("handoverId") ?? ""), answer);
  redirect(answer === "no" ? "/pass?disputed=1" : "/pass");
}
