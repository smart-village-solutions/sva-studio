# IAM-Acceptance-Runbook für die Paketabnahme

## Ziel

Dieses Runbook beschreibt den reproduzierbaren Abnahmenachweis für die IAM-Basis. Der Lauf prüft echte Laufzeitpfade gegen eine vereinbarte Testumgebung und ist bewusst **kein** regulärer PR-CI-Blocker.

## Ausführbarer Vertrag

- Lokal oder gegen eine laufende Testumgebung: `pnpm nx run sva-studio-react:test:acceptance`
- Root-Alias: `pnpm test:acceptance:iam`
- Zielumgebungs-Evidence für `WP-003`, `WP-005`, `WP-006`: `pnpm test:evidence:iam`
- Performance-Nachweis für `WP-004`: `pnpm test:acceptance:iam:performance`
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
| `IAM_ACCEPTANCE_ADMIN_USERNAME` oder `IAM_EVIDENCE_ROOT_USERNAME` | Login des dedizierten Acceptance-Admins oder des Evidence-Root-Actors |
| `IAM_ACCEPTANCE_ADMIN_PASSWORD` oder `IAM_EVIDENCE_ROOT_PASSWORD` | Passwort des dedizierten Acceptance-Admins oder des Evidence-Root-Actors |
| `IAM_ACCEPTANCE_MEMBER_USERNAME` oder `IAM_EVIDENCE_INSTANCE_USERNAME` | Login des dedizierten Acceptance-Members oder des Evidence-Instanz-Actors |
| `IAM_ACCEPTANCE_MEMBER_PASSWORD` oder `IAM_EVIDENCE_INSTANCE_PASSWORD` | Passwort des dedizierten Acceptance-Members oder des Evidence-Instanz-Actors |
| `IAM_DATABASE_URL` oder `IAM_ACCEPTANCE_DATABASE_URL` | PostgreSQL-Verbindung zur IAM-Datenbank |
| `KEYCLOAK_ADMIN_BASE_URL` | Keycloak-Basis-URL für den Service-Account |
| `KEYCLOAK_ADMIN_REALM` | technischer Realm des Service-Accounts für den Token-Bezug |
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
| `IAM_AUTHORIZE_BENCH_ACTION` | `content.read` | Action für den echten `POST /iam/authorize`-Lauf |
| `IAM_AUTHORIZE_BENCH_RESOURCE_TYPE` | `content` | Resource-Type für den Benchmark |
| `IAM_AUTHORIZE_BENCH_RESOURCE_ID` | leer | Optionale Resource-ID |
| `IAM_AUTHORIZE_BENCH_ORGANIZATION_ID` | leer | Optionaler Org-Kontext |
| `IAM_AUTHORIZE_BENCH_MEASURED_REQUESTS` | `100` | Mess-Requests je Szenario |
| `IAM_AUTHORIZE_BENCH_WARMUP_REQUESTS` | `10` | Warm-up-Requests je Szenario |
| `IAM_AUTHORIZE_BENCH_CONCURRENCY` | `100` | Parallelität für Cache-Hit und Cache-Miss |
| `IAM_AUTHORIZE_BENCH_RECOMPUTE_CONCURRENCY` | `1` | Parallelität für Recompute nach Invalidation |
| `IAM_AUTHORIZE_BENCH_INVALIDATION_DELAY_MS` | `100` | Wartezeit nach `pg_notify`, bevor der Recompute-Request gesendet wird |
| `IAM_AUTHORIZE_BENCH_REPORT_SLUG` | `iam-authorize-performance` | Dateinamen-Prefix für den Performance-Report |
| `IAM_EVIDENCE_PACKAGES` | `WP-003,WP-005,WP-006` | Kommagetrennte Auswahl der Evidence-Pakete |
| `IAM_EVIDENCE_REPORT_DIR` | `docs/reports` | Zielordner für Evidence-Reports |
| `IAM_EVIDENCE_REPORT_SLUG` | `iam-evidence` | Dateinamen-Prefix für Evidence-Berichte |
| `IAM_EVIDENCE_ARTIFACT_DIR` | `artifacts/iam-evidence` | Unterordner relativ zum Report-Ordner für Screenshots und Exportartefakte |
| `IAM_EVIDENCE_ROOT_USERNAME` | Acceptance-Admin | optionaler Root-/System-Admin-Login für Evidence-Läufe |
| `IAM_EVIDENCE_ROOT_PASSWORD` | Acceptance-Admin | Passwort des Root-/System-Admins |
| `IAM_EVIDENCE_INSTANCE_USERNAME` | Acceptance-Member | optionaler Instanz-Benutzer für `WP-006` |
| `IAM_EVIDENCE_INSTANCE_PASSWORD` | Acceptance-Member | Passwort des Instanz-Benutzers |
| `IAM_EVIDENCE_NEGATIVE_USERNAME` | leer | optionaler nicht privilegierter Benutzer für den `WP-006`-Negativnachweis |
| `IAM_EVIDENCE_NEGATIVE_PASSWORD` | leer | Passwort des nicht privilegierten Benutzers |
| `IAM_EVIDENCE_WP005_USER_ID` | leer | optionale Benutzer-ID für die `WP-005`-Detailansicht |

## Testdaten- und Realm-Kontrakt

- Die aktive Acceptance-Instanz in `iam.instances` besitzt mindestens `authRealm` und `authClientId`; der Acceptance-Doctor blockiert den Rollout sonst vorab.
- Der Realm enthält zwei dedizierte Testbenutzer:
  - `acceptance-admin`
  - `acceptance-member`
- Der fachliche Ziel-Realm der Acceptance-Instanz wird aus `iam.instances.authRealm` aufgelöst, nicht aus `KEYCLOAK_ADMIN_REALM`.
- Beide Benutzer tragen `instanceId = de-musterhausen`.
- Das User-Attribut `instanceId` muss über einen Protocol Mapper auf dem Client `sva-studio` als OIDC-Claim `instanceId` in Token und Userinfo erscheinen; ein bloßes User-Attribut ohne Mapper reicht nicht aus.
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

### Vorbereitung für Paket 3 bis 5

- Die Zielumgebung muss denselben Authorization-Vertrag wie lokal bereitstellen: `POST /iam/authorize` und `GET /iam/me/permissions` liefern additive `snapshotVersion`- und `cacheStatus`-Felder.
- Für `WP-005` muss die Benutzerdetailansicht strukturierte Permission-Transparenz mit sichtbarer Laufzeitklassifikation (`instanzweit`, `datensatzbezogen`, `organisationskontextbezogen`) nachweisen; instanzweite Rechte dürfen dabei trotz aktivem Organisationskontext keine künstliche Organisationsbindung anzeigen.
- Geo-bezogene Acceptance-Fälle verwenden denselben Laufzeitkontext in beiden Endpunkten:
  - `POST /iam/authorize` über `context.attributes.geoUnitId` und `context.attributes.geoHierarchy`
  - `GET /iam/me/permissions` über `geoUnitId` und `geoHierarchy`
- Offene Pflicht-Rechtstexte bleiben serverseitig fail-closed und blockieren geschützte Pfade mit `403 legal_acceptance_required`, bis die Akzeptanz erfolgreich abgeschlossen wurde.
- Die morgigen Reports müssen Cache-/Invalidierungs- und Rechtstext-Nachweise getrennt ausweisen, auch wenn sie im selben Environment-Lauf erzeugt werden.

## Artefakte

Jeder Lauf schreibt zwei Dateien nach `docs/reports/`:

- `<slug>-<timestamp>.md`
- `<slug>-<timestamp>.json`

Für den `WP-004`-Performance-Nachweis erzeugt `pnpm test:acceptance:iam:performance` einen separaten Bericht mit:

- Cache-Hit-Szenario
- Cache-Miss-Szenario
- Recompute-Szenario nach `pg_notify`-Invalidierung
- `Samples`, `p50`, `p95`, `p99`
- JSON-Rohdaten zur revisionssicheren Ablage

Für den Evidence-Lauf `pnpm test:evidence:iam` entstehen zusätzlich:

- `<slug>-<timestamp>.md`
- `<slug>-<timestamp>.json`
- `artifacts/iam-evidence/<slug>-<timestamp>/...`

Die Artefakte enthalten je nach Paket:

- Screenshots der Organisations-, Benutzer- oder Privacy-Ansicht
- JSON-Snapshots für `WP-003`
- positiven und negativen Consent-Export für `WP-006`
- Marker für manuelle Review-Fälle, wenn ein Zielumgebungsfall nicht zuverlässig automatisch erzeugbar ist

## Typischer lokaler Lauf

```bash
export IAM_EVIDENCE_ROOT_USERNAME="<root-admin-benutzer>"
export IAM_EVIDENCE_ROOT_PASSWORD="<root-admin-passwort>"
export IAM_EVIDENCE_INSTANCE_USERNAME="<mandanten-admin-benutzer>"
export IAM_EVIDENCE_INSTANCE_PASSWORD="<mandanten-admin-passwort>"
export IAM_EVIDENCE_NEGATIVE_USERNAME="<nicht-privilegierter-benutzer>"
export IAM_EVIDENCE_NEGATIVE_PASSWORD="<nicht-privilegiertes-passwort>"
export IAM_EVIDENCE_WP005_USER_ID="<ziel-benutzer-id>"
pnpm test:evidence:iam
```

Hinweise:

- Zugangsdaten nicht ins Repository schreiben; nur lokal als Environment setzen.
- `WP-005` bleibt ohne `IAM_EVIDENCE_WP005_USER_ID` absichtlich auf `skipped`, weil der Runner sonst keinen konkreten Benutzerdetailfall öffnen kann.
- Für einen vollständigen `WP-005`-Nachweis sollte der gewählte Detailfall mindestens eine instanzweite und eine datensatzbezogene Permission im Trace enthalten.
- `WP-006` bewertet den Negativfall ohne `IAM_EVIDENCE_NEGATIVE_USERNAME` und `IAM_EVIDENCE_NEGATIVE_PASSWORD` bewusst nur als `manual_review`, damit ein privilegierter Testactor nicht fälschlich als Produktfehler erscheint.
- `WP-003` und Teile von `WP-005` können bewusst als `manual_review` enden. Das ist kein Fehler des Runners, sondern markiert echte Zielumgebungsfälle, die aus Stabilitätsgründen nicht blind automatisiert werden.

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
