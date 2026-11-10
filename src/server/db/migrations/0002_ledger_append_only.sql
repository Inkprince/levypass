-- Money rule 2: ledger_entries is append-only. Corrections are new entries.
-- Row triggers stop UPDATE and DELETE; a statement trigger stops TRUNCATE, which skips row triggers.
-- A demo reset rebuilds the schema instead of editing the ledger.
CREATE FUNCTION ledger_entries_reject_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'restrict_violation',
          HINT = 'Post a correction entry instead.';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_no_update_delete
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_reject_change();
--> statement-breakpoint
CREATE TRIGGER ledger_entries_no_truncate
  BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION ledger_entries_reject_change();
