export const en = {
  "app.name": "LevyPass",
  "app.tagline": "Pay market and park levies digitally. Show one QR code to prove you paid.",
  "home.trader": "I am a trader",
  "home.officer": "I am an officer",
  "home.admin": "Revenue office",

  // SMS (NT-01, RC-01). Keep each under 160 characters where possible.
  "sms.otp": "LevyPass code: {code}. It expires in 10 minutes. Do not share it with anyone, including officers.",
  "sms.receipt": "LevyPass receipt {number}: {amount} received for {levy}, {period}. Check it at {url}",
  "sms.receipt_credit": "LevyPass receipt {number}: {amount} received. We keep {credit} as credit for your next levy. Check it at {url}",
  "sms.welcome": "Welcome to LevyPass, {name}. Your trader ID is {id}. Show your QR pass to any officer. Dial {ussd} to pay.",
  "sms.double_charge": "LevyPass: you already paid {levy} for {period}. We have credited {amount} to your next period. Receipt {number}.",
  // Pieces that fill {period} above: "weekly from 2026-11-09 + 2 more", "today".
  "sms.period_from": "{period} from {date}",
  "sms.period_more": "{period} + {count} more",
  "sms.period_weekly": "weekly",
  "sms.period_monthly": "monthly",
  "sms.period_yearly": "yearly",
  "sms.today": "today",

  // USSD (PY-03). CON keeps the session open, END closes it.
  "ussd.menu": "LevyPass\n1. Pay levy\n2. What I owe\n3. Last receipt\n4. Check an officer\n5. Report a collector\n6. Language",
  "ussd.not_registered": "This number is not registered with LevyPass. Ask an officer or visit {url} to register.",
  "ussd.owe": "You owe {amount}.\n{lines}",
  "ussd.owe_nothing": "You owe nothing today. Thank you.",
  "ussd.pay_choose": "Pay {amount} for {what}?\n1. Yes, pay now\n2. Cancel",
  // Pieces that fill {what} above.
  "ussd.pay_what_owed": "what you owe",
  "ussd.pay_what_ahead": "{levy} (pay ahead)",
  "ussd.pay_started": "Payment of {amount} started. Your receipt will come by SMS.",
  "ussd.pay_failed": "We could not start the payment. Please try again in a minute.",
  "ussd.cancelled": "Cancelled. We did not charge you.",
  "ussd.last_receipt": "Last receipt {number}: {amount} on {date}.",
  "ussd.no_receipt": "You have no receipts yet.",
  "ussd.officer_ask": "Enter the officer's staff ID (for example OTT-001):",
  "ussd.officer_active": "{name} ({staffId}) is an ACTIVE LevyPass officer.",
  "ussd.officer_suspended": "WARNING: {staffId} ({name}) is SUSPENDED. Do not pay this person. Reply 5 from the menu to report.",
  "ussd.officer_unknown": "WARNING: {staffId} is not a LevyPass officer. Do not pay. Dial again and choose 5 to report.",
  "ussd.report_ask": "Describe what happened (who, where, how much):",
  "ussd.report_done": "Thank you. Report {id} received. The revenue office will review it.",
  "ussd.language": "Choose language\n1. English\n2. Pidgin\n3. Yoruba",
  "ussd.language_set": "Language saved.",
  "ussd.invalid": "Invalid choice. Please dial again.",
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
