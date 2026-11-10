// Deterministic complaint triage (T20 fallback). No feature may fail because a model call failed.
// Keyword rules cover English, Nigerian Pidgin and Yoruba markers.

export type Triage = { summary: string; category: string; severity: "low" | "medium" | "high"; language: "en" | "pcm" | "yo" };

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export function detectLanguage(text: string): Triage["language"] {
  const t = ` ${text.toLowerCase()} `;
  if (/[ẹọṣ]/.test(t) || has(t, [" mo ", " owo ", " ti ", " kò ", " ko fun mi", " ẹni ", " gba "])) return "yo";
  if (has(t, [" wey ", " dey ", " no get ", " abeg ", " una ", " e no ", " im ", " oga ", " don "])) return "pcm";
  return "en";
}

export function fallbackTriage(text: string): Triage {
  const t = ` ${text.toLowerCase()} `;
  const amount = /(?:₦|n|naira\s*)?\s?(\d{3,6})\s*(?:naira|₦)?/i.exec(text)?.[1];
  const money = amount ? ` and took ₦${Number(amount).toLocaleString("en-NG")}` : "";
  const violent = has(t, ["beat", "slap", "threat", "knife", "gun", "seize", "seized", "carry my", "push", "lu mi", "na me", "fight"]);
  const fake = has(t, ["no id", "no get id", "no card", "fake", "impostor", "no uniform", "not an officer", "no be officer", "ko ni id"]);
  const noReceipt = has(t, ["receipt", "no give me", "risiti"]);
  const overcharge = has(t, ["extra", "too much", "double", "more than", "collect", "owo", "money"]);

  let category = "other";
  let summary = "Trader reports a problem with a levy collector.";
  if (fake) {
    category = "fake_collector";
    summary = `Trader reports a collector with no valid officer ID${money}.`;
  } else if (violent) {
    category = "harassment";
    summary = `Trader reports harassment or seizure of goods by a collector${money}.`;
  } else if (noReceipt) {
    category = "no_receipt";
    summary = `Trader reports payment collected without a receipt${money}.`;
  } else if (overcharge) {
    category = "overcharge";
    summary = `Trader reports being charged more than the levy${money}.`;
  }
  const severity: Triage["severity"] = violent ? "high" : fake || amount ? "medium" : "low";
  return { summary, category, severity, language: detectLanguage(text) };
}
