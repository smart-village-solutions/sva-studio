# IAM-Acceptance-Runbook für Paket 1 und 2

## Ziel

Dieses Runbook beschreibt den reproduzierbaren Abnahmenachweis für die IAM-Basis und die Organisationsverwaltung. Der Lauf prüft echte Laufzeitpfade gegen eine vereinbarte Testumgebung und ist bewusst **kein** regulärer PR-CI-Blocker.

## Ausführbarer Vertrag

- Lokal oder gegen eine laufende Testumgebung: `pnpm nx run sva-studio-react:test:acceptance`
- Root-Alias: `pnpm test:acceptance:iam`
- Separates Delivery-Gate in GitHub Actions: `.github/workflows/iam-acceptance.yml`

## Voraussetzungen

- Die Zielumgebung ist bereits erreichbar und liefert die Studio-App unter `IAM_ACCEPTANCE_BASE_URL` oder standardmäßig unter `http://127.0.0.1:3000`.
- `/health/ready` ist im Zielsystem verfügbar.
- Die IAM-Datenbank ist über `IAM_DATABASE_URL` oder `IAM_ACCEPTANCE_DATABASE_URL` erreichbar.
- Die Keycloak-Admin-Credentials für den bestehenden Service-Account sind gesetzt.
- Playwright Chromium ist installiert:

```bash
pnpm --filter sva-studio-react exec playwright install --with-deps chromium
```

## Pflicht-Umgebungsvariablen

| Variable | Bedeutung |
| --- | --- |
| `IAM_ACCEPTANCE_ADMIN_USERNAME` | Login des dedizierten Acceptance-Admins |
| `IAM_ACCEPTANCE_ADMIN_PASSWORD` | Passwort des dedizierten Acceptance-Admins |
| `IAM_ACCEPTANCE_MEMBER_USERNAME` | Login des dedizierten Acceptance-Members |
| `IAM_ACCEPTANCE_MEMBER_PASSWORD` | Passwort des dedizierten Acceptance-Members |
| `IAM_DATABASE_URL` oder `IAM_ACCEPTANCE_DATABASE_URL` | PostgreSQL-Verbindung zur IAM-Datenbank |
| `KEYCLOAK_ADMIN_BASE_URL` | Keycloak-Basis-URL für den Service-Account |
| `KEYCLOAK_ADMIN_REALM` | dedizierter Acceptance-Realm |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Keycloak-Service-Account-Client-ID |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Secret des Keycloak-Service-Accounts |

## Optionale Umgebungsvariablen

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `IAM_ACCEPTANCE_BASE_URL` | `http://127.0.0.1:3000` | Ziel-URL der laufenden Studio-App |
| `IAM_ACCEPTANCE_INSTANCE_ID` | `de-musterhausen` | Erwarteter Instanz-Claim und DB-Scope |
| `IAM_ACCEPTANCE_EXPECTED_ADMIN_ROLES` | `system_admin` | Kommagetrennte Rollenliste für den Admin-Claim-Nachweis |
| `IAM_ACCEPTANCE_ORGANIZATION_KEY_PREFIX` | `acceptance` | Stabiler Prefix für Acceptance-Organisationen |
| `IAM_ACCEPTANCE_REPORT_DIR` | `docs/reports` | Zielordner für JSON- und Markdown-Berichte |
| `IAM_ACCEPTANCE_REPORT_SLUG` | `iam-foundation-acceptance` | Dateinamen-Prefix für Berichte |

## Testdaten- und Realm-Kontrakt

- Der Realm enthält zwei dedizierte Testbenutzer:
  - `acceptance-admin`
  - `acceptance-member`
- Beide Benutzer tragen `instanceId = de-musterhausen`.
- `acceptance-admin` liefert im Laufzeitkontext mindestens die Rolle `system_admin`. Ein Alias über `realm_access.Admin -> system_admin` bleibt zulässig.
- Beide Benutzer sind vor dem Lauf **nicht** dauerhaft in `iam.accounts` vorgesehen. Der Runner räumt ihre IAM-Datensätze kontrolliert auf, damit JIT-Provisioning reproduzierbar geprüft wird.
- Die bestehenden Seeds bleiben maßgeblich:
  - Instanz: `de-musterhausen`
  - Root-Organisation: `seed-org-default`
  - Hierarchie: County -> Municipality -> District

## Was der Acceptance-Runner prüft

### Paket 1

- `GET /health/ready` mit `db=true`, `redis=true`, `keycloak=true`
- Realer OIDC-Login für `acceptance-admin`
- `/auth/me` mit `sub`, `instanceId` und erwarteten Rollen
- JIT-Provisioning für Erstlogin und stabile Wiederverwendung beim Zweitlogin

### Paket 2

- API-Smoke für Organisations-Anlage, Update und Deaktivierung
- Parent-/Child-Bezug, `hierarchy_path` und `depth` per DB-Assertion
- Membership-Zuweisung für `acceptance-member` inklusive Default-Kontext
- UI-Nachweis für Benutzerliste, Organisationsstruktur und Membership-Zuweisung

## Artefakte

Jeder Lauf schreibt zwei Dateien nach `docs/reports/`:

- `<slug>-<timestamp>.md`
- `<slug>-<timestamp>.json`

Der Bericht enthält mindestens:

- Zeitstempel und Zielumgebung
- Status aller Prüfschritte
- Fehlercodes für deterministische Abbrüche
- Login-Claims
- erzeugte oder wiederverwendete Account-IDs
- Organisations- und Membership-Nachweise

## Fehlercodes

| Fehlercode | Bedeutung |
| --- | --- |
| `acceptance_config_missing` | Pflicht-Umgebungsvariablen fehlen |
| `acceptance_keycloak_user_missing` | Dedizierter Testbenutzer fehlt in Keycloak |
| `acceptance_keycloak_user_not_unique` | Benutzername ist im Realm nicht eindeutig |
| `acceptance_dependency_not_ready` | `/health/ready` meldet nicht alle Dependencies als bereit |
| `acceptance_login_failed` | OIDC-Login oder Keycloak-Formular fehlgeschlagen |
| `acceptance_expected_claim_missing` | `sub` oder `instanceId` fehlt im User-Kontext |
| `acceptance_expected_role_missing` | Erwartete Rollen fehlen im User-Kontext |
| `acceptance_membership_missing` | `instance_memberships` oder `account_organizations` fehlen |
| `acceptance_organization_assertion_failed` | Hierarchie- oder Deaktivierungsnachweis stimmt nicht |
| `acceptance_database_query_failed` | DB-Assertion konnte nicht deterministisch ausgewertet werden |
| `acceptance_ui_assertion_failed` | Benutzerliste, Organisationsstruktur oder Membership ist in der UI nicht sichtbar |
| `acceptance_test_data_reset_failed` | Vorbereitender Reset der Acceptance-Testdaten ist fehlgeschlagen |
| `acceptance_runner_unexpected_error` | Unerwarteter Laufzeitfehler im Runner außerhalb gezielt klassifizierter Acceptance-Pfade |
| `acceptance_report_write_failed` | Bericht konnte nicht unter `docs/reports/` geschrieben werden |

## Abgrenzung zu generischen App-Smokes

Der bestehende App-E2E-Smoke (`pnpm nx run sva-studio-react:test:e2e`) bleibt unverändert und prüft nur generische Browser- und Transportpfade. Die IAM-Abnahme läuft separat, weil sie eine reale IAM-Testumgebung mit Keycloak, Redis und Datenbank benötigt.
