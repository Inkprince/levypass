CREATE TYPE "public"."cash_handover_status" AS ENUM('waiting', 'cancelled', 'expired', 'closed', 'recorded', 'confirmed', 'disputed');--> statement-breakpoint
ALTER TYPE "public"."fraud_flag_type" ADD VALUE 'cash_disputed';--> statement-breakpoint
CREATE TABLE "cash_handovers" (
	"id" text PRIMARY KEY NOT NULL,
	"trader_id" text NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"status" "cash_handover_status" NOT NULL,
	"requested_at" timestamp with time zone,
	"officer_id" text,
	"payment_id" text,
	"recorded_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_handovers_amount_positive" CHECK ("cash_handovers"."amount_kobo" > 0),
	CONSTRAINT "cash_handovers_recorded_has_payment" CHECK ("cash_handovers"."status" NOT IN ('recorded', 'confirmed', 'disputed') OR ("cash_handovers"."payment_id" IS NOT NULL AND "cash_handovers"."officer_id" IS NOT NULL AND "cash_handovers"."recorded_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_trader_id_traders_id_fk" FOREIGN KEY ("trader_id") REFERENCES "public"."traders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_handovers" ADD CONSTRAINT "cash_handovers_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_handovers_one_waiting" ON "cash_handovers" USING btree ("trader_id") WHERE "cash_handovers"."status" = 'waiting';--> statement-breakpoint
CREATE UNIQUE INDEX "cash_handovers_payment_id_index" ON "cash_handovers" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "cash_handovers_status_created_at_index" ON "cash_handovers" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "cash_handovers_trader_id_created_at_index" ON "cash_handovers" USING btree ("trader_id","created_at");