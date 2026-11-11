import type { Messages } from "./en";

// Yoruba. First draft written with Claude on 11 Nov 2026, not by a native speaker.
// tasks/plan.md asks for hand-written strings: someone on the team who speaks Yoruba must read and
// correct every line, tone marks included, before it is shown to judges.
// The marked letters are outside the GSM 7-bit alphabet, so a real SMS gateway would send these as
// UCS-2 (70 characters a part). Missing keys fall back to English.
export const yo: Partial<Messages> = {
  "sms.otp": "Kóòdù LevyPass: {code}. Yóò parí ní ìṣẹ́jú 10. Má fi han ẹnikẹ́ni, títí kan àwọn òṣìṣẹ́.",
  "sms.receipt": "Rìsíìtì LevyPass {number}: a ti gba {amount} fún {levy}, {period}. Ṣàyẹ̀wò rẹ̀ ní {url}",
  "sms.receipt_credit": "Rìsíìtì LevyPass {number}: a ti gba {amount}. A fi {credit} pamọ́ fún owó orí rẹ tó ń bọ̀. Ṣàyẹ̀wò rẹ̀ ní {url}",
  "sms.welcome": "Káàbọ̀ sí LevyPass, {name}. Nọ́mbà oníṣòwò rẹ ni {id}. Fi QR rẹ han òṣìṣẹ́ èyíkéyìí. Tẹ {ussd} láti sanwó.",
  "sms.double_charge": "LevyPass: o ti san {levy} fún {period} tẹ́lẹ̀. A ti fi {amount} sí àkókò rẹ tó ń bọ̀. Rìsíìtì {number}.",
  "sms.period_from": "{period} láti {date}",
  "sms.period_more": "{period} àti {count} míràn",
  "sms.period_weekly": "ọ̀sẹ̀ kan",
  "sms.period_monthly": "oṣù kan",
  "sms.period_yearly": "ọdún kan",
  "sms.today": "òní",

  "ussd.menu": "LevyPass\n1. San owó orí\n2. Iye tí mo jẹ\n3. Rìsíìtì ìkẹyìn\n4. Ṣàyẹ̀wò òṣìṣẹ́\n5. Fi ẹjọ́ agbowó sùn\n6. Èdè",
  "ussd.not_registered": "Nọ́mbà yìí kò tíì forúkọ sílẹ̀ ní LevyPass. Béèrè lọ́wọ́ òṣìṣẹ́ tàbí lọ sí {url} láti forúkọ sílẹ̀.",
  "ussd.owe": "O jẹ {amount}.\n{lines}",
  "ussd.owe_nothing": "O kò jẹ ohunkóhun lónìí. A dúpẹ́.",
  "ussd.pay_choose": "Ṣé kí o san {amount} fún {what}?\n1. Bẹ́ẹ̀ ni, san báyìí\n2. Fagilé",
  "ussd.pay_what_owed": "gbèsè rẹ",
  "ussd.pay_what_ahead": "{levy} (ìsanwó ṣáájú)",
  "ussd.pay_started": "Ìsanwó {amount} ti bẹ̀rẹ̀. Rìsíìtì rẹ yóò dé nípasẹ̀ SMS.",
  "ussd.pay_failed": "A kò lè bẹ̀rẹ̀ ìsanwó náà. Jọ̀wọ́ gbìyànjú lẹ́yìn ìṣẹ́jú kan.",
  "ussd.cancelled": "A ti fagilé e. A kò gba owó lọ́wọ́ rẹ.",
  "ussd.last_receipt": "Rìsíìtì ìkẹyìn {number}: {amount} ní {date}.",
  "ussd.no_receipt": "O kò tíì ní rìsíìtì kankan.",
  "ussd.officer_ask": "Tẹ nọ́mbà ìdánimọ̀ òṣìṣẹ́ náà (àpẹẹrẹ OTT-001):",
  "ussd.officer_active": "{name} ({staffId}) jẹ́ òṣìṣẹ́ LevyPass tòótọ́ tó wà lẹ́nu iṣẹ́.",
  "ussd.officer_suspended": "ÌKÌLỌ̀: A ti DÁ {staffId} ({name}) DÚRÓ. Má sanwó fún ẹni yìí. Tẹ 5 nínú àtòjọ láti fi ẹjọ́ sùn.",
  "ussd.officer_unknown": "ÌKÌLỌ̀: {staffId} kì í ṣe òṣìṣẹ́ LevyPass. Má sanwó. Tún tẹ̀ ẹ́, kí o yan 5 láti fi ẹjọ́ sùn.",
  "ussd.report_ask": "Sọ ohun tó ṣẹlẹ̀ (ta ni, níbo, èló):",
  "ussd.report_done": "A dúpẹ́. A ti gba ẹjọ́ {id}. Ọ́fíìsì owó orí yóò wò ó.",
  "ussd.language": "Yan èdè\n1. English\n2. Pidgin\n3. Yorùbá",
  "ussd.language_set": "A ti fi èdè rẹ pamọ́.",
  "ussd.invalid": "Àṣàyàn yìí kò tọ́. Jọ̀wọ́ tún tẹ̀ ẹ́.",
};
