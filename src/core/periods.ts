// Money rule 11: periods are computed in Africa/Lagos time and stored as UTC instants.
// "Today" is the Lagos calendar day, so it turns over at 00:00 Lagos (23:00 UTC), not at 01:00.

export type LevyPeriod = "daily" | "weekly" | "monthly" | "yearly";

/** A levy period: [start, end) as UTC instants, plus the Lagos calendar date it starts on. */
export type Period = { start: Date; end: Date; startDate: string };

export const timeZone = "Africa/Lagos";

const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const offsetFormat = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });

/** The Lagos calendar date of an instant, as YYYY-MM-DD. */
export function lagosDate(instant: Date): string {
  return dateParts.format(instant); // en-CA formats as YYYY-MM-DD
}

/** Lagos offset from UTC in milliseconds at an instant (read from the time zone database). */
function lagosOffsetMs(instant: Date): number {
  const name = offsetFormat.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return (m[1] === "-" ? -1 : 1) * minutes * 60_000;
}

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(date: string): { y: number; m: number; d: number } {
  const match = datePattern.exec(date);
  if (!match) throw new RangeError(`not a YYYY-MM-DD date: ${date}`);
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new RangeError(`no such date: ${date}`);
  }
  return { y, m, d };
}

const formatUtcDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** 00:00 in Lagos on a Lagos calendar date, as a UTC instant. */
export function lagosMidnight(date: string): Date {
  const { y, m, d } = parseDate(date);
  const wallClock = Date.UTC(y, m - 1, d);
  // Correct for the offset at that moment; a second pass covers an offset change on the day.
  let instant = wallClock - lagosOffsetMs(new Date(wallClock));
  instant = wallClock - lagosOffsetMs(new Date(instant));
  return new Date(instant);
}

/** Calendar arithmetic on YYYY-MM-DD dates (no time zone involved). */
export function addDays(date: string, days: number): string {
  const { y, m, d } = parseDate(date);
  return formatUtcDate(Date.UTC(y, m - 1, d + days));
}

function addMonths(date: string, months: number): string {
  const { y, m } = parseDate(date);
  return formatUtcDate(Date.UTC(y, m - 1 + months, 1));
}

/** The Lagos date on which the period containing `date` starts. Weeks run Monday to Sunday. */
function periodStartDate(period: LevyPeriod, date: string): string {
  const { y, m, d } = parseDate(date);
  switch (period) {
    case "daily":
      return date;
    case "weekly": {
      const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
      return addDays(date, -weekday);
    }
    case "monthly":
      return formatUtcDate(Date.UTC(y, m - 1, 1));
    case "yearly":
      return formatUtcDate(Date.UTC(y, 0, 1));
  }
}

function followingStartDate(period: LevyPeriod, startDate: string): string {
  switch (period) {
    case "daily":
      return addDays(startDate, 1);
    case "weekly":
      return addDays(startDate, 7);
    case "monthly":
      return addMonths(startDate, 1);
    case "yearly":
      return addMonths(startDate, 12);
  }
}

function periodStarting(period: LevyPeriod, startDate: string): Period {
  return { start: lagosMidnight(startDate), end: lagosMidnight(followingStartDate(period, startDate)), startDate };
}

/** The period that contains an instant. */
export function periodFor(period: LevyPeriod, instant: Date): Period {
  return periodStarting(period, periodStartDate(period, lagosDate(instant)));
}

/** The period that contains a Lagos calendar date. */
export function periodForDate(period: LevyPeriod, date: string): Period {
  return periodStarting(period, periodStartDate(period, date));
}

export function nextPeriod(period: LevyPeriod, current: Period): Period {
  return periodStarting(period, followingStartDate(period, current.startDate));
}

/** Every period from the one containing `startDate` up to and including the one containing `asOf`. */
export function periodsFrom(period: LevyPeriod, startDate: string, asOf: Date): Period[] {
  const out: Period[] = [];
  for (let p = periodForDate(period, startDate); p.start <= asOf; p = nextPeriod(period, p)) out.push(p);
  return out;
}
