CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'market_admin', 'finance', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."authority_tier" AS ENUM('state', 'local_government');--> statement-breakpoint
CREATE TYPE "public"."bank_call_status" AS ENUM('pending', 'succeeded', 'failed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."fraud_flag_type" AS ENUM('double_charge', 'unknown_receipt', 'reused_receipt', 'suspended_officer_scan', 'unknown_officer_scan');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_kind" AS ENUM('inflow', 'fee', 'allocation', 'suspense', 'suspense_release', 'reversal', 'correction');--> statement-breakpoint
CREATE TYPE "public"."levy_period" AS ENUM('daily', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'pcm', 'yo');--> statement-breakpoint
CREATE TYPE "public"."market_type" AS ENUM('market', 'motor_park', 'street');--> statement-breakpoint
CREATE TYPE "public"."obligation_status" AS ENUM('due', 'part_paid', 'paid', 'waived');--> statement-breakpoint
CREATE TYPE "public"."officer_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('register', 'login');--> statement-breakpoint
CREATE TYPE "public"."outbox_kind" AS ENUM('sms', 'job');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_channel" AS ENUM('virtual_account', 'ussd', 'card', 'bank_transfer', 'qr');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('initiated', 'pending', 'unknown', 'successful', 'failed', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."scan_result" AS ENUM('paid', 'not_paid', 'unknown_trader', 'invalid_token');--> statement-breakpoint
CREATE TYPE "public"."scan_source" AS ENUM('online', 'offline_sync');--> statement-breakpoint
CREATE TYPE "public"."subject_type" AS ENUM('trader', 'officer', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."trader_status" AS ENUM('pending_verification', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."triage_source" AS ENUM('model', 'fallback');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "admin_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_type" "subject_type" NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authorities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" "authority_tier" NOT NULL,
	"collection_account_number" text,
	"collection_bank_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"operation" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"request_body" jsonb,
	"status" "bank_call_status" DEFAULT 'pending' NOT NULL,
	"http_status" integer,
	"request_id" text,
	"response_body" jsonb,
	"payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_trader_id" text,
	"officer_id" text,
	"collector_description" text,
	"description" text NOT NULL,
	"photo_url" text,
	"latitude" double precision,
	"longitude" double precision,
	"status" "case_status" DEFAULT 'open' NOT NULL,
	"triage_summary" text,
	"triage_category" text,
	"triage_severity" text,
	"triage_source" "triage_source",
	"triage_language" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE TABLE "fraud_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "fraud_flag_type" NOT NULL,
	"status" "case_status" DEFAULT 'open' NOT NULL,
	"trader_id" text,
	"officer_id" text,
	"payment_id" text,
	"scan_id" text,
	"receipt_number" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"journal_id" text NOT NULL,
	"kind" "ledger_entry_kind" NOT NULL,
	"debit_account" text NOT NULL,
	"credit_account" text NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"payment_id" text,
	"obligation_id" text,
	"reverses_entry_id" text,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_amount_positive" CHECK ("ledger_entries"."amount_kobo" > 0),
	CONSTRAINT "ledger_entries_distinct_accounts" CHECK ("ledger_entries"."debit_account" <> "ledger_entries"."credit_account"),
	CONSTRAINT "ledger_entries_allocation_has_obligation" CHECK ("ledger_entries"."kind" <> 'allocation' OR "ledger_entries"."obligation_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "levy_type_markets" (
	"levy_type_id" text NOT NULL,
	"market_id" text NOT NULL,
	CONSTRAINT "levy_type_markets_levy_type_id_market_id_pk" PRIMARY KEY("levy_type_id","market_id")
);
--> statement-breakpoint
CREATE TABLE "levy_types" (
	"id" text PRIMARY KEY NOT NULL,
	"authority_id" text NOT NULL,
	"name" text NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"period" "levy_period" NOT NULL,
	"legal_basis" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "levy_types_amount_whole_naira" CHECK ("levy_types"."amount_kobo" > 0 AND "levy_types"."amount_kobo" % 100 = 0)
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" text PRIMARY KEY NOT NULL,
	"authority_id" text NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"type" "market_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obligations" (
	"id" text PRIMARY KEY NOT NULL,
	"trader_id" text NOT NULL,
	"levy_type_id" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"amount_due_kobo" bigint NOT NULL,
	"amount_paid_kobo" bigint DEFAULT 0 NOT NULL,
	"status" "obligation_status" DEFAULT 'due' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "obligations_period_order" CHECK ("obligations"."period_end" > "obligations"."period_start"),
	CONSTRAINT "obligations_amount_due_positive" CHECK ("obligations"."amount_due_kobo" > 0),
	CONSTRAINT "obligations_amount_paid_range" CHECK ("obligations"."amount_paid_kobo" >= 0 AND "obligations"."amount_paid_kobo" <= "obligations"."amount_due_kobo"),
	CONSTRAINT "obligations_status_matches_amount" CHECK (("obligations"."status" = 'waived')
        OR ("obligations"."status" = 'due' AND "obligations"."amount_paid_kobo" = 0)
        OR ("obligations"."status" = 'part_paid' AND "obligations"."amount_paid_kobo" > 0 AND "obligations"."amount_paid_kobo" < "obligations"."amount_due_kobo")
        OR ("obligations"."status" = 'paid' AND "obligations"."amount_paid_kobo" = "obligations"."amount_due_kobo" AND "obligations"."paid_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "officer_markets" (
	"officer_id" text NOT NULL,
	"market_id" text NOT NULL,
	CONSTRAINT "officer_markets_officer_id_market_id_pk" PRIMARY KEY("officer_id","market_id")
);
--> statement-breakpoint
CREATE TABLE "officers" (
	"id" text PRIMARY KEY NOT NULL,
	"authority_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"name" text NOT NULL,
	"photo_url" text,
	"pin_hash" text NOT NULL,
	"device_id" text,
	"qr_token_id" text NOT NULL,
	"status" "officer_status" DEFAULT 'active' NOT NULL,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "outbox_kind" NOT NULL,
	"topic" text NOT NULL,
	"recipient" text,
	"payload" jsonb NOT NULL,
	"dedupe_key" text,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"trader_id" text,
	"provider" text NOT NULL,
	"provider_ref" text NOT NULL,
	"channel" "payment_channel" NOT NULL,
	"status" "payment_status" NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"fee_kobo" bigint,
	"virtual_account_number" text,
	"paid_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"provider_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_kobo" > 0),
	CONSTRAINT "payments_fee_range" CHECK ("payments"."fee_kobo" IS NULL OR ("payments"."fee_kobo" >= 0 AND "payments"."fee_kobo" <= "payments"."amount_kobo")),
	CONSTRAINT "payments_settled_needs_verified" CHECK ("payments"."settled_at" IS NULL OR "payments"."verified_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"payment_id" text NOT NULL,
	"trader_id" text NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verification_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" "case_status" DEFAULT 'open' NOT NULL,
	"payment_id" text,
	"provider" text NOT NULL,
	"provider_ref" text NOT NULL,
	"amount_kobo" bigint,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" text PRIMARY KEY NOT NULL,
	"officer_id" text,
	"trader_id" text,
	"result" "scan_result" NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"accuracy_metres" double precision,
	"scanned_at" timestamp with time zone NOT NULL,
	"source" "scan_source" DEFAULT 'online' NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_type" "subject_type" NOT NULL,
	"subject_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trader_levies" (
	"trader_id" text NOT NULL,
	"levy_type_id" text NOT NULL,
	"start_date" date NOT NULL,
	"exemption" text,
	CONSTRAINT "trader_levies_trader_id_levy_type_id_pk" PRIMARY KEY("trader_id","levy_type_id")
);
--> statement-breakpoint
CREATE TABLE "traders" (
	"id" text PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"market_id" text NOT NULL,
	"stall_or_vehicle" text NOT NULL,
	"business_type" text NOT NULL,
	"photo_url" text,
	"qr_token_id" text NOT NULL,
	"status" "trader_status" DEFAULT 'pending_verification' NOT NULL,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"trader_id" text NOT NULL,
	"provider" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"provider_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_calls" ADD CONSTRAINT "bank_calls_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_reporter_trader_id_traders_id_fk" FOREIGN KEY ("reporter_trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_flags" ADD CONSTRAINT "fraud_flags_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_flags" ADD CONSTRAINT "fraud_flags_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_flags" ADD CONSTRAINT "fraud_flags_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fraud_flags" ADD CONSTRAINT "fraud_flags_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_obligation_id_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."obligations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levy_type_markets" ADD CONSTRAINT "levy_type_markets_levy_type_id_levy_types_id_fk" FOREIGN KEY ("levy_type_id") REFERENCES "public"."levy_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levy_type_markets" ADD CONSTRAINT "levy_type_markets_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levy_types" ADD CONSTRAINT "levy_types_authority_id_authorities_id_fk" FOREIGN KEY ("authority_id") REFERENCES "public"."authorities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_authority_id_authorities_id_fk" FOREIGN KEY ("authority_id") REFERENCES "public"."authorities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_levy_type_id_levy_types_id_fk" FOREIGN KEY ("levy_type_id") REFERENCES "public"."levy_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officer_markets" ADD CONSTRAINT "officer_markets_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officer_markets" ADD CONSTRAINT "officer_markets_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officers" ADD CONSTRAINT "officers_authority_id_authorities_id_fk" FOREIGN KEY ("authority_id") REFERENCES "public"."authorities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trader_levies" ADD CONSTRAINT "trader_levies_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trader_levies" ADD CONSTRAINT "trader_levies_levy_type_id_levy_types_id_fk" FOREIGN KEY ("levy_type_id") REFERENCES "public"."levy_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traders" ADD CONSTRAINT "traders_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_accounts" ADD CONSTRAINT "virtual_accounts_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admins_email_index" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "audit_log_target_type_target_id_index" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_index" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_calls_idempotency_key_uq" ON "bank_calls" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "bank_calls_status_created_at_index" ON "bank_calls" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "complaints_status_created_at_index" ON "complaints" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "fraud_flags_status_created_at_index" ON "fraud_flags" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "fraud_flags_type_index" ON "fraud_flags" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ledger_entries_debit_account_index" ON "ledger_entries" USING btree ("debit_account");--> statement-breakpoint
CREATE INDEX "ledger_entries_credit_account_index" ON "ledger_entries" USING btree ("credit_account");--> statement-breakpoint
CREATE INDEX "ledger_entries_payment_id_index" ON "ledger_entries" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_obligation_id_index" ON "ledger_entries" USING btree ("obligation_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_created_at_index" ON "ledger_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "markets_authority_id_index" ON "markets" USING btree ("authority_id");--> statement-breakpoint
CREATE UNIQUE INDEX "obligations_trader_levy_period_uq" ON "obligations" USING btree ("trader_id","levy_type_id","period_start");--> statement-breakpoint
CREATE INDEX "obligations_trader_id_status_period_start_index" ON "obligations" USING btree ("trader_id","status","period_start");--> statement-breakpoint
CREATE INDEX "obligations_period_start_index" ON "obligations" USING btree ("period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "officers_staff_id_index" ON "officers" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "officers_qr_token_id_index" ON "officers" USING btree ("qr_token_id");--> statement-breakpoint
CREATE INDEX "otp_codes_phone_created_at_index" ON "otp_codes" USING btree ("phone","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_dedupe_key_index" ON "outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "outbox_status_available_at_index" ON "outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "outbox_recipient_created_at_index" ON "outbox" USING btree ("recipient","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_uq" ON "payments" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "payments_trader_id_created_at_index" ON "payments" USING btree ("trader_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_status_index" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_number_uq" ON "receipts" USING btree ("number");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_payment_id_index" ON "receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "receipts_trader_id_issued_at_index" ON "receipts" USING btree ("trader_id","issued_at");--> statement-breakpoint
CREATE INDEX "review_items_status_created_at_index" ON "review_items" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "review_items_provider_provider_ref_index" ON "review_items" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "scans_officer_id_scanned_at_index" ON "scans" USING btree ("officer_id","scanned_at");--> statement-breakpoint
CREATE INDEX "scans_trader_id_scanned_at_index" ON "scans" USING btree ("trader_id","scanned_at");--> statement-breakpoint
CREATE INDEX "sessions_subject_type_subject_id_index" ON "sessions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "traders_phone_index" ON "traders" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "traders_qr_token_id_index" ON "traders" USING btree ("qr_token_id");--> statement-breakpoint
CREATE INDEX "traders_market_id_index" ON "traders" USING btree ("market_id");--> statement-breakpoint
CREATE UNIQUE INDEX "virtual_accounts_trader_id_index" ON "virtual_accounts" USING btree ("trader_id");--> statement-breakpoint
CREATE UNIQUE INDEX "virtual_accounts_provider_account_number_index" ON "virtual_accounts" USING btree ("provider","account_number");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_event_id_uq" ON "webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_processed_at_index" ON "webhook_events" USING btree ("processed_at");