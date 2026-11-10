import "server-only";
import { createHash } from "node:crypto";
import { encodeIdBody, type IdPrefix } from "@/core/ids";
import { accounts } from "@/core/ledger";
import { nairaToKobo } from "@/core/money";
import { addDays, lagosDate, lagosMidnight, periodForDate } from "@/core/periods";
import { newReceiptNumber } from "@/core/receipts";
import { hashSecret } from "@/server/auth/password";
import type { Db } from "./client";
import * as s from "./schema";

// Synthetic data only. Names are invented combinations, phones use the +234 700 prefix (not a
// mobile range), and the authority and market are fictional. Nothing here is a real person.
//
// Repeatable: every row has a deterministic ID and is inserted with ON CONFLICT DO NOTHING, so a
// second run adds nothing. Run on a later day, it adds that day's obligations as due.

/** Deterministic ID in the normal format, so seeded IDs look and validate like real ones. */
export function seedId(prefix: IdPrefix, key: string): string {
  return `${prefix}_${encodeIdBody(createHash("sha256").update(`levypass-seed:${key}`).digest())}`;
}

const seedHash = (key: string) => createHash("sha256").update(`levypass-seed:${key}`).digest();
const seedHex = (key: string, length: number) => seedHash(key).toString("hex").slice(0, length);
const mondayOf = (date: string) => periodForDate("weekly", date).startDate;

const firstNames = ["Adaku", "Bolaji", "Chidinma", "Damilola", "Emeka", "Funmilayo", "Garba", "Halima", "Ifeoma", "Jide",
  "Kehinde", "Ladi", "Maryam", "Nnamdi", "Olamide", "Patience", "Rukayat", "Segun", "Taiwo", "Uche"];
const surnames = ["Adebayo", "Bello", "Chukwu", "Danladi", "Ekwueme", "Fashola", "Gambo", "Ibekwe", "Jimoh", "Kalu",
  "Lawal", "Mohammed", "Nwosu", "Okafor", "Popoola", "Salami", "Uzor", "Yusuf"];
const businesses = ["Fabrics", "Provisions", "Foodstuff", "Phone accessories", "Tailoring", "Footwear", "Cosmetics", "Grains"];

/** Payment history shapes, by trader index modulo 10. */
type Profile = "regular" | "due_today" | "arrears" | "part_today" | "paid_ahead";
const profileOf = (i: number): Profile =>
  (["regular", "regular", "regular", "regular", "regular", "due_today", "due_today", "arrears", "part_today", "paid_ahead"] as const)[i % 10]!;

export type SeedOptions = {
  now?: Date;
  traderCount?: number;
  /** Demo credentials. Required in production; local defaults otherwise. */
  adminPassword?: string;
  officerPin?: string;
  publicBaseUrl?: string;
};

export type SeedSummary = Record<string, number>;

export async function seed(db: Db, options: SeedOptions = {}): Promise<SeedSummary> {
  const now = options.now ?? new Date();
  const traderCount = options.traderCount ?? 40;
  const baseUrl = options.publicBaseUrl ?? "http://localhost:3000";
  const adminPassword = options.adminPassword ?? "levypass-admin";
  const officerPin = options.officerPin ?? "1357";

  const today = lagosDate(now);
  const windowStart = mondayOf(addDays(today, -13)); // two to three weeks of history

  const authorityId = seedId("aut", "authority");
  const marketId = seedId("mkt", "market");
  const dailyId = seedId("lvt", "levy:daily");
  const weeklyId = seedId("lvt", "levy:weekly");
  const collection = accounts.collection(authorityId);
  const revenue = accounts.levyRevenue(authorityId);
  // The sandbox's published flat merchant fee for transfer and USSD (docs/forge-platform.md).
  // Seeded history only: live payments read the fee from the bank response (money rule 9).
  const seededFeeKobo = nairaToKobo(50);

  const levies = [
    { id: dailyId, name: "Daily market levy", amountKobo: nairaToKobo(500), period: "daily" as const },
    { id: weeklyId, name: "Weekly sanitation levy", amountKobo: nairaToKobo(2_000), period: "weekly" as const },
  ];

  const [adminHash, pinHash] = await Promise.all([hashSecret(adminPassword), hashSecret(officerPin)]);

  const traders: (typeof s.traders.$inferInsert)[] = [];
  const traderLevies: (typeof s.traderLevies.$inferInsert)[] = [];
  const obligations: (typeof s.obligations.$inferInsert)[] = [];
  const payments: (typeof s.payments.$inferInsert)[] = [];
  const ledger: (typeof s.ledgerEntries.$inferInsert)[] = [];
  const receipts: (typeof s.receipts.$inferInsert)[] = [];

  const paidTime = (periodStart: Date, minutes: number): Date => {
    const t = new Date(Math.min(periodStart.getTime() + minutes * 60_000, now.getTime() - 60_000));
    return t.getTime() > periodStart.getTime() ? t : new Date(periodStart.getTime() + 1_000);
  };

  for (let i = 0; i < traderCount; i++) {
    const n = i + 1;
    const traderId = seedId("trd", `trader:${n}`);
    const profile = profileOf(i);
    traders.push({
      id: traderId,
      phone: `+234700000${String(100 + n).padStart(4, "0")}`,
      name: `${firstNames[i % firstNames.length]} ${surnames[(i * 7) % surnames.length]}`,
      marketId,
      stallOrVehicle: `${"ABCD"[i % 4]}-${String(n).padStart(2, "0")}`,
      businessType: businesses[i % businesses.length]!,
      qrTokenId: seedHex(`qr:trader:${n}`, 24),
      status: "active",
      locale: (["en", "en", "pcm", "yo"] as const)[i % 4],
      phoneVerifiedAt: lagosMidnight(windowStart),
    });
    for (const levy of levies) traderLevies.push({ traderId, levyTypeId: levy.id, startDate: windowStart });

    type Period = { key: string; levy: (typeof levies)[number]; start: Date; end: Date; date: string };
    const periods: Period[] = [];
    for (let d = windowStart; d <= today; d = addDays(d, 1)) {
      periods.push({ key: `${n}:daily:${d}`, levy: levies[0]!, start: lagosMidnight(d), end: lagosMidnight(addDays(d, 1)), date: d });
    }
    for (let w = windowStart; w <= today; w = addDays(w, 7)) {
      periods.push({ key: `${n}:weekly:${w}`, levy: levies[1]!, start: lagosMidnight(w), end: lagosMidnight(addDays(w, 7)), date: w });
    }

    const isCurrent = (p: Period) => (p.levy.period === "daily" ? p.date === today : p.date === mondayOf(today));
    // How much of each period this profile has paid.
    const paidShare = (p: Period): number => {
      switch (profile) {
        case "regular":
        case "paid_ahead":
          return p.levy.amountKobo;
        case "due_today":
          return isCurrent(p) ? 0 : p.levy.amountKobo;
        case "arrears":
          return p.date < addDays(today, -5) && !isCurrent(p) ? p.levy.amountKobo : 0;
        case "part_today":
          return isCurrent(p) && p.levy.period === "daily" ? nairaToKobo(200) : p.levy.amountKobo;
      }
    };

    // Pay-ahead traders also paid tomorrow's daily levy in the same payment as today's.
    const tomorrow = addDays(today, 1);
    const ahead: Period | undefined =
      profile === "paid_ahead"
        ? { key: `${n}:daily:${tomorrow}`, levy: levies[0]!, start: lagosMidnight(tomorrow), end: lagosMidnight(addDays(tomorrow, 1)), date: tomorrow }
        : undefined;

    for (const p of [...periods, ...(ahead ? [ahead] : [])]) {
      const paid = p === ahead ? p.levy.amountKobo : paidShare(p);
      const paidAt = paid > 0 ? paidTime(p === ahead ? lagosMidnight(today) : p.start, (p.levy.period === "daily" ? 8 * 60 : 33 * 60) + i * 7) : null;
      obligations.push({
        id: seedId("obl", p.key),
        traderId,
        levyTypeId: p.levy.id,
        periodStart: p.start,
        periodEnd: p.end,
        amountDueKobo: p.levy.amountKobo,
        amountPaidKobo: paid,
        status: paid === 0 ? "due" : paid < p.levy.amountKobo ? "part_paid" : "paid",
        paidAt: paid === p.levy.amountKobo ? paidAt : null,
        createdAt: p.start < now ? p.start : now,
        updatedAt: paidAt ?? (p.start < now ? p.start : now),
      });
      if (paid === 0 || p === ahead) continue;

      // One payment per paid period; today's pay-ahead payment also covers tomorrow.
      const covers = isCurrent(p) && ahead && p.levy.period === "daily" ? [p, ahead] : [p];
      const amount = covers.reduce((sum, c) => sum + (c === ahead ? c.levy.amountKobo : paid), 0);
      const paymentId = seedId("pay", p.key);
      const journalId = seedId("jnl", p.key);
      const channel = i % 3 === 0 ? ("ussd" as const) : ("virtual_account" as const);
      const at = paidAt!;
      payments.push({
        id: paymentId,
        traderId,
        provider: "seed",
        providerRef: `SEED-${seedHex(p.key, 12).toUpperCase()}`,
        channel,
        status: "successful",
        amountKobo: amount,
        feeKobo: seededFeeKobo,
        paidAt: at,
        verifiedAt: at,
        settledAt: at,
        createdAt: at,
        updatedAt: at,
      });
      const entry = (k: string, e: Omit<typeof s.ledgerEntries.$inferInsert, "id" | "journalId" | "paymentId" | "createdAt">) =>
        ledger.push({ id: seedId("led", `${p.key}:${k}`), journalId, paymentId, createdAt: at, ...e });
      entry("inflow", { kind: "inflow", debitAccount: collection, creditAccount: accounts.trader(traderId), amountKobo: amount });
      entry("fee", { kind: "fee", debitAccount: accounts.bankFees, creditAccount: collection, amountKobo: seededFeeKobo });
      for (const c of covers) {
        entry(`alloc:${c.key}`, {
          kind: "allocation",
          debitAccount: accounts.trader(traderId),
          creditAccount: revenue,
          amountKobo: c === ahead ? c.levy.amountKobo : paid,
          obligationId: seedId("obl", c.key),
        });
      }
      const number = newReceiptNumber(() => seedHash(`receipt:${p.key}`));
      receipts.push({
        id: seedId("rcp", p.key),
        number,
        paymentId,
        traderId,
        amountKobo: amount,
        issuedAt: at,
        verificationUrl: `${baseUrl}/r/${number}`,
      });
    }
  }

  const officers = [
    { n: 1, name: "Musa Danjuma" },
    { n: 2, name: "Ngozi Achebe" },
    { n: 3, name: "Tunde Ayoola" },
  ].map(({ n, name }) => ({
    id: seedId("off", `officer:${n}`),
    authorityId,
    staffId: `OTT-${String(n).padStart(3, "0")}`,
    name,
    pinHash,
    qrTokenId: seedHex(`qr:officer:${n}`, 24),
    status: "active" as const,
  }));

  const counts: SeedSummary = {};
  await db.transaction(async (tx) => {
    const insert = async <T extends Parameters<typeof tx.insert>[0]>(name: string, table: T, rows: T["$inferInsert"][]) => {
      let inserted = 0;
      for (let k = 0; k < rows.length; k += 500) {
        const result = await tx.insert(table).values(rows.slice(k, k + 500)).onConflictDoNothing();
        inserted += result.rowCount ?? 0;
      }
      counts[name] = inserted;
    };

    await insert("authorities", s.authorities, [{ id: authorityId, name: "Ilu Tuntun Local Government", tier: "local_government" }]);
    await insert("markets", s.markets, [{ id: marketId, authorityId, name: "Oja Tuntun Market", location: "Ilu Tuntun (fictional)", type: "market" }]);
    await insert(
      "levy_types",
      s.levyTypes,
      levies.map((l) => ({
        ...l,
        authorityId,
        legalBasis: "Ilu Tuntun Markets and Trading Bye-law 2025, section 4 (fictional, for the demo)",
      })),
    );
    await insert("levy_type_markets", s.levyTypeMarkets, levies.map((l) => ({ levyTypeId: l.id, marketId })));
    await insert("traders", s.traders, traders);
    await insert("trader_levies", s.traderLevies, traderLevies);
    await insert("obligations", s.obligations, obligations);
    await insert("payments", s.payments, payments);
    await insert("ledger_entries", s.ledgerEntries, ledger);
    await insert("receipts", s.receipts, receipts);
    await insert("officers", s.officers, officers);
    await insert("officer_markets", s.officerMarkets, officers.map((o) => ({ officerId: o.id, marketId })));
    await insert("admins", s.admins, [
      { id: seedId("adm", "admin:1"), email: "revenue@levypass.test", name: "Revenue Administrator", passwordHash: adminHash, role: "super_admin" },
    ]);
  });
  return counts;
}
