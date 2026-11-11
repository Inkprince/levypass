import type { Messages } from "./en";

// Nigerian Pidgin. First draft written with Claude on 11 Nov 2026, not by a native speaker.
// tasks/plan.md asks for hand-written strings: someone on the team who speaks Pidgin must read and
// correct every line before it is shown to judges. Missing keys fall back to English.
export const pcm: Partial<Messages> = {
  "sms.otp": "LevyPass code: {code}. E go expire for 10 minutes. No show am to anybody, even officer.",
  "sms.receipt": "LevyPass receipt {number}: we don collect {amount} for {levy}, {period}. Check am for {url}",
  "sms.receipt_credit": "LevyPass receipt {number}: we don collect {amount}. We keep {credit} as credit for your next levy. Check am for {url}",
  "sms.welcome": "Welcome to LevyPass, {name}. Your trader ID na {id}. Show your QR pass to any officer. Dial {ussd} to pay.",
  "sms.double_charge": "LevyPass: you don pay {levy} for {period} before. We don put {amount} for your next period. Receipt {number}.",
  "sms.period_from": "{period} wey start {date}",
  "sms.period_more": "{period} plus {count} more",
  "sms.period_weekly": "one week",
  "sms.period_monthly": "one month",
  "sms.period_yearly": "one year",
  "sms.today": "today",

  "ussd.menu": "LevyPass\n1. Pay levy\n2. Wetin I dey owe\n3. Last receipt\n4. Check officer\n5. Report collector\n6. Language",
  "ussd.not_registered": "Dis number never register for LevyPass. Ask officer or go {url} to register.",
  "ussd.owe": "You dey owe {amount}.\n{lines}",
  "ussd.owe_nothing": "You no dey owe anything today. Thank you.",
  "ussd.pay_choose": "You wan pay {amount} for {what}?\n1. Yes, pay now\n2. Cancel",
  "ussd.pay_what_owed": "wetin you dey owe",
  "ussd.pay_what_ahead": "{levy} (pay ahead)",
  "ussd.pay_started": "Payment of {amount} don start. Your receipt go come by SMS.",
  "ussd.pay_failed": "We no fit start the payment. Abeg try again after one minute.",
  "ussd.cancelled": "E don cancel. We no charge you.",
  "ussd.last_receipt": "Last receipt {number}: {amount} for {date}.",
  "ussd.no_receipt": "You never get any receipt.",
  "ussd.officer_ask": "Enter the officer staff ID (example OTT-001):",
  "ussd.officer_active": "{name} ({staffId}) na correct LevyPass officer wey dey ACTIVE.",
  "ussd.officer_suspended": "WARNING: {staffId} ({name}) dey SUSPENDED. No pay dis person. Reply 5 for menu to report.",
  "ussd.officer_unknown": "WARNING: {staffId} no be LevyPass officer. No pay. Dial again, choose 5 to report.",
  "ussd.report_ask": "Tell us wetin happen (who, where, how much):",
  "ussd.report_done": "Thank you. We don receive report {id}. Revenue office go look am.",
  "ussd.language": "Choose your language\n1. English\n2. Pidgin\n3. Yoruba",
  "ussd.language_set": "We don save your language.",
  "ussd.invalid": "Dat choice no correct. Abeg dial again.",
};
