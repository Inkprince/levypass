import type { Messages } from "./en";

// Nigerian Pidgin. Written by Huawei MaaS (deepseek-v4.1-flash) on 11 Nov 2026 from the English strings:
// one call to translate, one call with reasoning on to review against the English (it changed 4 lines).
// Not yet read by a Pidgin speaker on the team; tasks/plan.md still asks for that before the demo.
// Missing keys fall back to English.
export const pcm: Partial<Messages> = {
  "sms.otp": "LevyPass code: {code}. E go expire in 10 minutes. No share am with anybody, even officers.",
  "sms.receipt": "LevyPass receipt {number}: {amount} don enter for {levy}, {period}. Check am for {url}",
  "sms.receipt_credit": "LevyPass receipt {number}: {amount} don enter. We keep {credit} as credit for your next levy. Check am for {url}",
  "sms.welcome": "Welcome to LevyPass, {name}. Your trader ID na {id}. Show your QR pass to any officer. Dial {ussd} to pay.",
  "sms.double_charge": "LevyPass: you don already pay {levy} for {period}. We don put {amount} as credit for your next period. Receipt {number}.",
  "sms.period_from": "{period} from {date}",
  "sms.period_more": "{period} + {count} more",
  "sms.period_weekly": "every week",
  "sms.period_monthly": "every month",
  "sms.period_yearly": "every year",
  "sms.today": "today",

  "ussd.menu": "LevyPass\n1. Pay levy\n2. Wetin I owe\n3. Last receipt\n4. Check officer\n5. Report collector\n6. Language",
  "ussd.not_registered": "This number no register for LevyPass. Ask one officer or go {url} to register.",
  "ussd.owe": "You owe {amount}.\n{lines}",
  "ussd.owe_nothing": "You no owe anything today. Thank you.",
  "ussd.pay_choose": "Pay {amount} for {what}?\n1. Yes, pay now\n2. Cancel",
  "ussd.pay_what_owed": "wetin you owe",
  "ussd.pay_what_ahead": "{levy} (pay ahead)",
  "ussd.pay_started": "Payment of {amount} don start. Your receipt go come by SMS.",
  "ussd.pay_failed": "We no fit start the payment. Abeg try again in one minute.",
  "ussd.cancelled": "Cancelled. We no charge you.",
  "ussd.last_receipt": "Last receipt {number}: {amount} on {date}.",
  "ussd.no_receipt": "You never get any receipt.",
  "ussd.officer_ask": "Put the officer staff ID (like OTT-001):",
  "ussd.officer_active": "{name} ({staffId}) na ACTIVE LevyPass officer.",
  "ussd.officer_suspended": "WARNING: {staffId} ({name}) don get SUSPENDED. No pay this person. Reply 5 from the menu to report.",
  "ussd.officer_unknown": "WARNING: {staffId} no be LevyPass officer. No pay. Dial again and choose 5 to report.",
  "ussd.report_ask": "Talk wetin happen (who, where, how much):",
  "ussd.report_done": "Thank you. Report {id} don land. The revenue office go check am.",
  "ussd.language": "Choose language\n1. English\n2. Pidgin\n3. Yoruba",
  "ussd.language_set": "Language don save.",
  "ussd.invalid": "You no choose well. Abeg dial again.",
};
