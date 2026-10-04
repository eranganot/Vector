-- ADR-004: audit_event is insert-only for every role, including the owner.
CREATE OR REPLACE FUNCTION vector_audit_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only (% rejected)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_event_no_update BEFORE UPDATE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION vector_audit_immutable();
--> statement-breakpoint
CREATE TRIGGER audit_event_no_delete BEFORE DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION vector_audit_immutable();
--> statement-breakpoint
CREATE TRIGGER audit_event_no_truncate BEFORE TRUNCATE ON "audit_event"
  FOR EACH STATEMENT EXECUTE FUNCTION vector_audit_immutable();
--> statement-breakpoint
-- Group role the application's login role is a member of (see scripts/db-roles.ts).
-- Full DML on domain tables; INSERT + SELECT only on audit_event.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vector_app_rw') THEN
    CREATE ROLE vector_app_rw NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO vector_app_rw;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vector_app_rw;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_event" FROM vector_app_rw;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO vector_app_rw;
--> statement-breakpoint
GRANT USAGE ON SCHEMA drizzle TO vector_app_rw;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO vector_app_rw;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vector_app_rw;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO vector_app_rw;
