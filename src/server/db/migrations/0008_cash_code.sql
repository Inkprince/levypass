ALTER TABLE "cash_handovers" ADD COLUMN "code_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_handovers" ADD COLUMN "expires_at" timestamp with time zone;