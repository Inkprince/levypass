// A trader on a feature phone types an officer's staff ID with a keypad. Letters need multi-tap and
// the dash is buried under a key, so we accept "OTT-001", "ott001", "OTT 001" or just "001".

export type StaffIdInput =
  | { kind: "full"; key: string; shown: string }
  | { kind: "number"; number: string; shown: string };

/** Upper-case letters and digits only: "ott-001" -> "OTT001". */
export function staffIdKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The digits of a staff ID without leading zeros: "OTT-001" -> "1". Null when there are none. */
export function staffNumberKey(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits === "") return null;
  return digits.replace(/^0+(?=\d)/, "");
}

export function parseStaffIdInput(typed: string): StaffIdInput | null {
  const shown = typed.trim().toUpperCase();
  const key = staffIdKey(shown);
  if (key === "") return null;
  if (/^\d+$/.test(key)) return { kind: "number", number: staffNumberKey(key) ?? key, shown };
  return { kind: "full", key, shown };
}
