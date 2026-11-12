CREATE TYPE "public"."float_status" AS ENUM('requested', 'approved', 'declined', 'loaded');--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_kind" ADD VALUE 'float_load';--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_kind" ADD VALUE 'cash_collection';--> statement-breakpoint
ALTER TYPE "public"."payment_channel" ADD VALUE 'cash';--> statement-breakpoint
CREATE TABLE "floats" (
	"id" text PRIMARY KEY NOT NULL,
	"officer_id" text NOT NULL,
	"seq" integer NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"status" "float_status" DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"decline_reason" text,
	"payment_id" text,
	"loaded_at" timestamp with time zone,
	CONSTRAINT "floats_amount_positive" CHECK ("floats"."amount_kobo" > 0),
	CONSTRAINT "floats_loaded_has_time" CHECK ("floats"."status" <> 'loaded' OR ("floats"."loaded_at" IS NOT NULL AND "floats"."payment_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "floats" ADD CONSTRAINT "floats_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floats" ADD CONSTRAINT "floats_decided_by_admins_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "floats" ADD CONSTRAINT "floats_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "floats_officer_id_seq_index" ON "floats" USING btree ("officer_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "floats_payment_id_index" ON "floats" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "floats_status_requested_at_index" ON "floats" USING btree ("status","requested_at");