import type { Kobo } from "@/core/money";

// Domain view of the bank. Shapes follow docs/bank-api-notes.md; nothing here is invented.

export type CheckoutRequest = { reference: string; amountKobo: Kobo; customerName: string; callbackUrl?: string };

export type Checkout = {
  reference: string;
  status: string;
  paymentUrl: string;
  ussdCode: string;
  transferAccount: { accountNumber: string; accountName: string; bankName: string };
  expiresAt: Date;
};

export type BankPaymentStatus = "pending" | "successful" | "failed" | "reversed";

export type VerifiedPayment = {
  reference: string;
  status: BankPaymentStatus;
  amountKobo: Kobo; // what was asked for and what settles
  amountPaidKobo: Kobo; // what the payer sent (can exceed amountKobo)
  feeKobo: Kobo; // merchant_fee, read from the bank
  settlementKobo: Kobo;
  channel: string | null;
  paidAt: Date | null;
};

export type SettlementLine = { reference: string; channel: string; amountKobo: Kobo; feeKobo: Kobo };

export type Settlement = {
  settlementId: string | null;
  salesDate: string;
  status: string;
  scheduledFor: Date | null;
  settledAt: Date | null;
  settlementAccount: string;
  grossKobo: Kobo;
  feesKobo: Kobo;
  netKobo: Kobo;
  transactions: SettlementLine[];
};

export type ReconciliationRecord = { reference: string; amountKobo: Kobo };

/** "yours" in the bank's response is us; "ours" is the bank. Renamed so nobody has to remember that. */
export type Reconciliation = {
  matched: ReconciliationRecord[];
  amountMismatch: { reference: string; levypassKobo: Kobo; bankKobo: Kobo }[];
  onlyInLevypass: ReconciliationRecord[]; // bank: missing_in_ledger
  onlyAtBank: ReconciliationRecord[]; // bank: missing_in_yours
};

export interface BankPort {
  readonly provider: "xtradot" | "fake";
  createCheckout(req: CheckoutRequest, ctx?: { paymentId?: string }): Promise<Checkout>;
  /** Null when the bank has no payment with this reference. */
  verifyPayment(reference: string): Promise<VerifiedPayment | null>;
  simulateUssd(reference: string): Promise<void>;
  simulateTransfer(reference: string, amountKobo?: Kobo): Promise<void>;
  listSettlements(): Promise<Settlement[]>;
  runSettlements(): Promise<Settlement[]>;
  reconcile(date: string, records: ReconciliationRecord[]): Promise<Reconciliation>;
  registerWebhook(url: string): Promise<{ id: string; secret: string }>;
  deleteWebhook(id: string): Promise<void>;
  replayDelivery(eventId: string): Promise<void>;
}

export class BankError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "BankError";
  }
}

/** A 504, a timeout or a dropped connection: the outcome is unknown. Requery, never resend. */
export class BankUnknownOutcome extends Error {
  constructor(
    message: string,
    readonly reference?: string,
  ) {
    super(message);
    this.name = "BankUnknownOutcome";
  }
}
