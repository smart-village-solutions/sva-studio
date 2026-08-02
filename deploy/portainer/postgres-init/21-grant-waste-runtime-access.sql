\set ON_ERROR_STOP on
\connect sva_waste

GRANT USAGE ON SCHEMA public TO sva_waste_app, sva_waste_public_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sva_waste_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO sva_waste_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sva_waste_app;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO sva_waste_public_app;
GRANT INSERT, UPDATE, DELETE ON TABLE
  public.waste_email_reminder_subscriptions,
  public.waste_email_reminder_subscription_items,
  public.waste_email_reminder_outbox
TO sva_waste_public_app;

ALTER DEFAULT PRIVILEGES FOR ROLE sva_waste_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sva_waste_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sva_waste_owner IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sva_waste_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sva_waste_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO sva_waste_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sva_waste_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO sva_waste_public_app;
