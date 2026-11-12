import type { Messages } from "./en";

// Hausa. Written by Claude (Opus 5.5) on 12 Nov 2026 from the English strings, in standard (Kano)
// Hausa boko spelling with the hooked letters and no tone marks. The trader is addressed with the
// polite plural "ku", which also avoids guessing gender. "Levy" is haraji, "officer" is jami'i.
// Not yet read by a Hausa speaker on the team; tasks/plan.md asks for that before the demo.
// ɓ, ɗ and ƙ are outside the GSM 7-bit alphabet, so a real SMS gateway would send these as
// UCS-2 (70 characters a part). Missing keys fall back to English.
export const ha: Partial<Messages> = {
  "sms.otp": "Lambar LevyPass: {code}. Za ta ƙare cikin minti 10. Kada ku ba kowa ita, har da jami'ai.",
  "sms.receipt": "Rasidin LevyPass {number}: an karɓi {amount} don {levy}, {period}. Duba shi a {url}",
  "sms.receipt_cash": "Rasidin LevyPass {number}: jami'i {staffId} ya karɓi {amount} tsabar kuɗi don {levy}, {period}. Duba shi a {url} Ba ka biya ba? Danna {ussd}, zaɓi 8.",
  "sms.report_resolved": "LevyPass: ofishin haraji ya magance rahotonka {ref}. Mun gode da ka sanar da mu.",
  "sms.report_dismissed": "LevyPass: ofishin haraji ya duba rahotonka {ref} bai sami matsala ba. Idan ya sake faruwa, danna {ussd} ka zaɓi 5.",
  "sms.cash_code": "Lambar kuɗi ta LevyPass: {code}. Faɗa wa jami'in da ke tsaye a gabanka kaɗai lokacin da ka ba shi {amount}. Kada ka aika wa kowa.",
  "sms.receipt_credit": "Rasidin LevyPass {number}: an karɓi {amount}. Mun ajiye ragowar {credit} don harajinku na gaba. Duba shi a {url}",
  "sms.welcome": "Barka da zuwa LevyPass, {name}. Lambar ɗan kasuwarku ita ce {id}. Nuna katin QR ɗinku ga kowane jami'i. Danna {ussd} don biya.",
  "sms.double_charge": "LevyPass: kun riga kun biya {levy} na {period}. Mun ajiye {amount} don lokaci na gaba. Rasidi {number}.",
  "sms.card_reissued": "LevyPass: an canza katin LevyPass ɗinku a ranar {date}. Tsohon katin da duk wani sitika a rumfarku ba za su ƙara aiki ba. Idan ba ku ne kuka nema ba, ku sanar da ofishin haraji.",
  "sms.period_from": "{period} daga {date}",
  "sms.period_more": "{period} + ƙarin {count}",
  "sms.period_weekly": "mako-mako",
  "sms.period_monthly": "wata-wata",
  "sms.period_yearly": "shekara-shekara",
  "sms.today": "yau",

  "ussd.menu": "LevyPass\n1. Biya haraji\n2. Bashin da ake bina\n3. Rasidi na ƙarshe\n4. Duba jami'i\n5. Kai ƙarar mai karɓar kuɗi\n6. Harshe\n7. Biya tsabar kuɗi ga jami'i\n8. Tabbatar da biyan kuɗi",
  "ussd.cash_asked": "Lambar kuɗinka ita ce {code}. Ba jami'in LevyPass da ke gabanka {amount}, sannan ka faɗa masa lambar. Fara duba ID ɗinsa (zaɓi 4). Idan babu rasidin SMS, ba ka biya ba.",
  "ussd.cash_confirm_ask": "Ka ba jami'i {staffId} tsabar kuɗi {amount} a ranar {date}?\n1. Eh, na biya\n2. A'a, ban biya ba",
  "ussd.cash_confirm_none": "Babu biyan tsabar kuɗi da ke jiran amsarka.",
  "ussd.cash_confirmed": "Na gode. An tabbatar da biyan kuɗinka.",
  "ussd.cash_disputed": "Na gode. Ofishin haraji zai duba wannan biyan kuɗi tare da jami'in.",
  "ussd.not_registered": "Ba a yi rajistar wannan lambar a LevyPass ba. Tambayi jami'i ko ku je {url} don yin rajista.",
  "ussd.owe": "Ana binku {amount}.\n{lines}",
  "ussd.owe_nothing": "Ba a binku komai yau. Na gode.",
  "ussd.pay_choose": "Biya {amount} don {what}?\n1. Ee, biya yanzu\n2. Soke",
  "ussd.pay_what_owed": "bashin da ake binku",
  "ussd.pay_what_ahead": "{levy} (biya kafin lokaci)",
  "ussd.pay_started": "An fara biyan {amount}. Rasidinku zai zo ta SMS.",
  "ussd.pay_failed": "Ba mu iya fara biyan ba. Don Allah ku sake gwadawa bayan minti ɗaya.",
  "ussd.cancelled": "An soke. Ba mu cire kuɗinku ba.",
  "ussd.last_receipt": "Rasidi na ƙarshe {number}: {amount} a ranar {date}.",
  "ussd.no_receipt": "Ba ku da rasidi tukuna.",
  "ussd.officer_ask": "Shigar da lambar ID ta jami'in (misali OTT-001 ko 001):",
  "ussd.officer_active": "{name} ({staffId}) jami'in LevyPass ne da ke BAKIN AIKI.",
  "ussd.officer_suspended": "GARGAƊI: An DAKATAR da {staffId} ({name}). Kada ku biya wannan mutumin. Zaɓi 5 daga menu don kai ƙara.",
  "ussd.officer_unknown": "GARGAƊI: {staffId} ba jami'in LevyPass ba ne. Kada ku biya. Ku sake danna lambar, ku zaɓi 5 don kai ƙara.",
  "ussd.report_ask": "Bayyana abin da ya faru (wane ne, a ina, nawa):",
  "ussd.report_done": "Na gode. An karɓi ƙara {id}. Ofishin haraji zai duba ta.",
  "ussd.language": "Zaɓi harshe\n1. Turanci\n2. Pidgin\n3. Yarbanci\n4. Igbo\n5. Hausa",
  "ussd.language_set": "An adana harshe.",
  "ussd.invalid": "Zaɓin bai dace ba. Don Allah ku sake dannawa.",
};
