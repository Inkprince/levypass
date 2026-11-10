// Nigerian phone numbers to E.164 (+234...). Logs use mask().
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, "");
  let m = /^\+?234(\d{10})$/.exec(digits);
  if (m) return `+234${m[1]}`;
  m = /^0(\d{10})$/.exec(digits);
  if (m) return `+234${m[1]}`;
  return null;
}

export function maskPhone(phone: string): string {
  return phone.length > 7 ? `${phone.slice(0, 6)}****${phone.slice(-3)}` : "****";
}
