import type { Messages } from "./en";

// Igbo. Written by Claude (Opus 5.5) on 12 Nov 2026 from the English strings, in standard written
// Igbo with dotted vowels and no tone marks. "Levy" is ụtụ, "trader" is onye ahịa, "officer" is
// onye ọrụ. Not yet read by an Igbo speaker on the team; tasks/plan.md asks for that before the demo.
// ị, ọ, ụ and ṅ are outside the GSM 7-bit alphabet, so a real SMS gateway would send these as
// UCS-2 (70 characters a part). Missing keys fall back to English.
export const ig: Partial<Messages> = {
  "sms.otp": "Koodu LevyPass: {code}. Ọ ga-agwụ n'ime nkeji 10. Egosila onye ọ bụla ya, gụnyere ndị ọrụ.",
  "sms.receipt": "Risiti LevyPass {number}: anatala {amount} maka {levy}, {period}. Lee ya na {url}",
  "sms.receipt_cash": "Risiti LevyPass {number}: onye ọrụ {staffId} natara {amount} ego aka maka {levy}, {period}. Lee ya na {url} Ị kwụghị ya? Kpọọ {ussd}, họrọ 8.",
  "sms.report_resolved": "LevyPass: ụlọ ọrụ ụtụ edozila mkpesa gị {ref}. Daalụ maka ịgwa anyị.",
  "sms.report_dismissed": "LevyPass: ụlọ ọrụ ụtụ lere mkpesa gị {ref} anya ma ha ahụghị nsogbu. Ọ bụrụ na ọ mekwaa, kpọọ {ussd} họrọ 5.",
  "sms.cash_code": "Koodu ego LevyPass: {code}. Gwa ya naanị onye ọrụ guzo n'ihu gị mgbe ị na-enye ya {amount}. Ezitela ya onye ọ bụla.",
  "sms.receipt_credit": "Risiti LevyPass {number}: anatala {amount}. Anyị edebela {credit} maka ụtụ gị na-esote. Lee ya na {url}",
  "sms.welcome": "Nnọọ na LevyPass, {name}. ID onye ahịa gị bụ {id}. Gosi onye ọrụ ọ bụla QR gị. Pịa {ussd} ka ị kwụọ ụgwọ.",
  "sms.double_charge": "LevyPass: ị kwụọla {levy} maka {period}. Anyị edebela {amount} maka oge na-esote. Risiti {number}.",
  "sms.card_reissued": "LevyPass: agbanweela kaadị LevyPass gị na {date}. Kaadị ochie na sticker ọ bụla dị n'ụlọ ahịa gị anaghịzi arụ ọrụ. Ọ bụrụ na ọ bụghị gị rịọrọ ya, gwa ụlọ ọrụ ụtụ.",
  "sms.period_from": "{period} site na {date}",
  "sms.period_more": "{period} + {count} ọzọ",
  "sms.period_weekly": "kwa izu",
  "sms.period_monthly": "kwa ọnwa",
  "sms.period_yearly": "kwa afọ",
  "sms.today": "taa",

  "ussd.menu": "LevyPass\n1. Kwụọ ụtụ\n2. Ụgwọ m ji\n3. Risiti ikpeazụ\n4. Lelee onye ọrụ\n5. Kpesa maka onye na-ana ụtụ\n6. Asụsụ\n7. Kwụọ ego n'aka onye ọrụ\n8. Kwado ego m kwụrụ",
  "ussd.cash_asked": "Koodu ego gị bụ {code}. Nye onye ọrụ LevyPass nọ n'ihu gị {amount}, mgbe ahụ gwa ya koodu ahụ. Buru ụzọ lelee ID ya (nhọrọ 4). Ọ bụrụ na enweghị risiti SMS, ị kwụbeghị ụgwọ.",
  "ussd.cash_confirm_ask": "Ị nyere onye ọrụ {staffId} {amount} ego n'aka na {date}?\n1. Ee, akwụrụ m\n2. Mba, akwụghị m",
  "ussd.cash_confirm_none": "Enweghị ịkwụ ụgwọ ego n'aka na-eche azịza gị.",
  "ussd.cash_confirmed": "Daalụ. Akwadola ịkwụ ụgwọ ego gị.",
  "ussd.cash_disputed": "Daalụ. Ụlọ ọrụ ụtụ ga-enyocha ịkwụ ụgwọ a na onye ọrụ ahụ.",
  "ussd.not_registered": "Edebanyeghị nọmba a na LevyPass. Jụọ onye ọrụ ma ọ bụ gaa {url} ka ị debanye aha.",
  "ussd.owe": "Ị ji {amount}.\n{lines}",
  "ussd.owe_nothing": "Ị jighị ụgwọ ọ bụla taa. Daalụ.",
  "ussd.pay_choose": "Kwụọ {amount} maka {what}?\n1. Ee, kwụọ ugbu a\n2. Kagbuo",
  "ussd.pay_what_owed": "ụgwọ ị ji",
  "ussd.pay_what_ahead": "{levy} (kwụọ tupu oge eruo)",
  "ussd.pay_started": "Ịkwụ {amount} amalitela. Risiti gị ga-abịa site na SMS.",
  "ussd.pay_failed": "Anyị enweghị ike ịmalite ịkwụ ụgwọ ahụ. Biko nwaa ọzọ n'ime otu nkeji.",
  "ussd.cancelled": "Akagbuola ya. Anyị ewereghị ego gị.",
  "ussd.last_receipt": "Risiti ikpeazụ {number}: {amount} na {date}.",
  "ussd.no_receipt": "Ị nwebeghị risiti ọ bụla.",
  "ussd.officer_ask": "Tinye ID onye ọrụ ahụ (dịka OTT-001 ma ọ bụ 001):",
  "ussd.officer_active": "{name} ({staffId}) bụ onye ọrụ LevyPass NA-ARỤ ỌRỤ.",
  "ussd.officer_suspended": "ỊDỌ AKA NA NTỊ: {staffId} ({name}) ka AKWỤSỊTỤRỤ. Akwụla onye a ego. Họrọ 5 na menu ka ị kpesa.",
  "ussd.officer_unknown": "ỊDỌ AKA NA NTỊ: {staffId} abụghị onye ọrụ LevyPass. Akwụla ego. Pịa ọzọ ma họrọ 5 ka ị kpesa.",
  "ussd.report_ask": "Kọwaa ihe mere (onye, ebee, ego ole):",
  "ussd.report_done": "Daalụ. Anatala mkpesa {id}. Ụlọ ọrụ ụtụ ga-enyocha ya.",
  "ussd.language": "Họrọ asụsụ\n1. Bekee\n2. Pidgin\n3. Yoruba\n4. Igbo\n5. Hausa",
  "ussd.language_set": "Echekwala asụsụ.",
  "ussd.invalid": "Nhọrọ ezighi ezi. Biko pịa ọzọ.",
};
