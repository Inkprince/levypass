import type { Messages } from "./en";

// Yoruba. Written by Huawei MaaS (deepseek-v4.1-flash) on 11 Nov 2026 from the English strings:
// one call to translate, then 12 lines sent back with a note on what was wrong (a missing negative, the
// verb for owing, "report", "dial", "trader ID", "levy") and rewritten by the model with reasoning on.
// Not yet read by a Yoruba speaker on the team; tasks/plan.md still asks for that before the demo.
// The marked letters are outside the GSM 7-bit alphabet, so a real SMS gateway would send these as
// UCS-2 (70 characters a part). Missing keys fall back to English.
export const yo: Partial<Messages> = {
  "sms.otp": "Kóòdù LevyPass: {code}. Ó máa parí ní ìṣẹ́jú mẹ́wàá. Má ṣe fi fún ẹnikẹ́ni, kódà àwọn òṣìṣẹ́.",
  "sms.receipt": "Rìsíìtì LevyPass {number}: a gba {amount} fún {levy}, {period}. Ẹ wo ó ní {url}",
  "sms.receipt_credit": "Rìsíìtì LevyPass {number}: a gba {amount}. A pa {credit} mọ́ gẹ́gẹ́ bí kírẹ́dítì fún owó orí rẹ tó ń bọ̀. Ẹ wò ó ní {url}",
  "sms.welcome": "Ẹ káàbọ̀ sí LevyPass, {name}. ID oníṣòwò rẹ ni {id}. Fi káàdì QR rẹ hàn fún òṣìṣẹ́ èyíkéyìí. Tẹ {ussd} láti sanwó.",
  "sms.double_charge": "LevyPass: o ti san {levy} fún {period} tẹ́lẹ̀. A ti fi {amount} pamọ́ fún àkókò tó ń bọ̀. Rìsíìtì {number}.",
  "sms.period_from": "{period} láti {date}",
  "sms.period_more": "{period} + {count} mìíràn",
  "sms.period_weekly": "ọ̀sẹ̀ọ̀sẹ̀",
  "sms.period_monthly": "oṣooṣù",
  "sms.period_yearly": "ọdọọdún",
  "sms.today": "lónìí",

  "ussd.menu": "LevyPass\n1. San owó orí\n2. Owó tí mo jẹ\n3. Rìsíìtì tó kẹ́yìn\n4. Ṣàyẹ̀wò òṣìṣẹ́\n5. Fi ẹjọ́ ẹni tó ń gba owó lọ́wọ́\n6. Èdè",
  "ussd.not_registered": "Nọ́mbà yìí kò forúkọ sílẹ̀ ní LevyPass. Béèrè lọ́wọ́ òṣìṣẹ́ tàbí lọ sí {url} láti forúkọ.",
  "ussd.owe": "O jẹ {amount}.\n{lines}",
  "ussd.owe_nothing": "O ò jẹ gbèsè kankan lónìí. Ẹ ṣé.",
  "ussd.pay_choose": "San {amount} fún {what}?\n1. Bẹ́ẹ̀ ni, san báyìí\n2. Fagilé",
  "ussd.pay_what_owed": "owó tí o jẹ",
  "ussd.pay_what_ahead": "{levy} (san ṣáájú)",
  "ussd.pay_started": "Sísan {amount} ti bẹ̀rẹ̀. Rìsíìtì rẹ máa wá ní SMS.",
  "ussd.pay_failed": "A kò lè bẹ̀rẹ̀ sísan náà. Jọ̀wọ́ gbìyànjú lẹ́ẹ̀kan sí i ní ìṣẹ́jú kan.",
  "ussd.cancelled": "A fagilé. A kò gba owó lọ́wọ́ rẹ.",
  "ussd.last_receipt": "Rìsíìtì tó kẹ́yìn {number}: {amount} ní {date}.",
  "ussd.no_receipt": "O kò tíì ní rìsíìtì kankan.",
  "ussd.officer_ask": "Tẹ ID òṣìṣẹ́ náà (bí àpẹẹrẹ OTT-001):",
  "ussd.officer_active": "{name} ({staffId}) jẹ́ òṣìṣẹ́ LevyPass tó ń ṢIṢẸ́.",
  "ussd.officer_suspended": "ÌKILỌ̀: {staffId} ({name}) ti DÁWỌ́ DÚRÓ. Má ṣe sanwó fún ẹni yìí. Tẹ 5 láti inú àkójọ láti fi ẹ̀sùn kàn án.",
  "ussd.officer_unknown": "ÌKILỌ̀: {staffId} kì í ṣe òṣìṣẹ́ LevyPass. Má ṣe sanwó. Tẹ kóòdù náà lẹ́ẹ̀kan sí i, kí o yan 5 láti fi ẹ̀sùn kàn án.",
  "ussd.report_ask": "Ṣàlàyé ohun tó ṣẹlẹ̀ (ta ni, níbo, iye owó):",
  "ussd.report_done": "Ẹ ṣé. A ti gba ìròyìn {id}. Ọ́fíìsì owó máa ṣàyẹ̀wò rẹ̀.",
  "ussd.language": "Yan èdè\n1. Gẹ̀ẹ́sì\n2. Pidgin\n3. Yorùbá",
  "ussd.language_set": "A ti fi èdè pamọ́.",
  "ussd.invalid": "Yíyàn kò tọ́. Jọ̀wọ́ tẹ kóòdù USSD náà lẹ́ẹ̀kan sí i.",
};
