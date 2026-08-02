\set ON_ERROR_STOP on

-- Die Passwörter werden ausschließlich aus der Prozessumgebung gelesen.
\getenv waste_migrator_password WASTE_MIGRATOR_PASSWORD
\getenv waste_app_password WASTE_APP_PASSWORD
\getenv waste_public_app_password WASTE_PUBLIC_APP_PASSWORD

SELECT 'CREATE ROLE sva_waste_owner NOLOGIN NOINHERIT'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sva_waste_owner')
\gexec

SELECT format('CREATE ROLE sva_waste_migrator LOGIN NOINHERIT PASSWORD %L', :'waste_migrator_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sva_waste_migrator')
\gexec
ALTER ROLE sva_waste_migrator LOGIN NOINHERIT PASSWORD :'waste_migrator_password';

SELECT format('CREATE ROLE sva_waste_app LOGIN NOINHERIT PASSWORD %L', :'waste_app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sva_waste_app')
\gexec
ALTER ROLE sva_waste_app LOGIN NOINHERIT PASSWORD :'waste_app_password';

SELECT format('CREATE ROLE sva_waste_public_app LOGIN NOINHERIT PASSWORD %L', :'waste_public_app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sva_waste_public_app')
\gexec
ALTER ROLE sva_waste_public_app LOGIN NOINHERIT PASSWORD :'waste_public_app_password';

GRANT sva_waste_owner TO sva_waste_migrator;

SELECT 'CREATE DATABASE sva_waste OWNER sva_waste_owner'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sva_waste')
\gexec

SELECT 'CREATE DATABASE sva_waste_restore_drill OWNER sva_waste_owner'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'sva_waste_restore_drill')
\gexec

REVOKE ALL ON DATABASE sva_waste FROM PUBLIC;
GRANT CONNECT ON DATABASE sva_waste TO sva_waste_migrator, sva_waste_app, sva_waste_public_app;
REVOKE ALL ON DATABASE sva_waste_restore_drill FROM PUBLIC;
GRANT CONNECT ON DATABASE sva_waste_restore_drill TO sva_waste_migrator, sva_waste_app, sva_waste_public_app;

\connect sva_waste
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO sva_waste_owner;
GRANT USAGE ON SCHEMA public TO sva_waste_app, sva_waste_public_app;

ALTER DEFAULT PRIVILEGES FOR ROLE sva_waste_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sva_waste_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sva_waste_owner IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sva_waste_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sva_waste_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO sva_waste_app;

ALTER DEFAULT PRIVILEGES FOR ROLE sva_waste_owner IN SCHEMA public
  GRANT SELECT ON TABLES TO sva_waste_public_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sva_waste_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sva_waste_public_app;
