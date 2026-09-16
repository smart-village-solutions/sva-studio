# Change: Keycloak-Baseline für neue Tenant-Realms automatisieren

## Why

Die aktuelle Instanz-Provisionierung erstellt Realm, Clients, Secrets, Rollen und Tenant-Admin, überlässt aber weitere wiederkehrende Realm-Einstellungen dem manuellen Betrieb. Dadurch entstehen bei neuen Tenants vermeidbare Abweichungen bei Theme, Sprache, Events, Benutzerprofil, Mapper und E-Mail-Konfiguration. Diese Werte sind plattformweit gleich und sollen nicht bei jeder Instanzanlage erneut abgefragt werden.

## What Changes

- Eine versionierte, ausschließlich serverseitige Baseline definiert die nicht geheimen Standardwerte für neu angelegte Tenant-Realms.
- Neue Realms erhalten automatisch das Login-Theme `sva-kern2`, Dark Mode, ausschließlich deutsche Lokalisierung, die freigegebene Event-Konfiguration, Studio-eigene Benutzerprofilattribute und den `instanceId`-Mapper.
- Die nicht geheimen SMTP-Werte werden ebenfalls automatisch gesetzt. Das SMTP-Passwort bleibt eine einmalige manuelle Nacharbeit und wird weder in der Baseline noch als tatsächlicher Platzhalter in Keycloak gespeichert.
- Ein stabiler Befund `smtp_password_required` ersetzt den Passwort-Platzhalter. Das fehlende Passwort bleibt als erwartete manuelle Nacharbeit sichtbar, ohne den technischen Provisioning-Lauf scheitern zu lassen.
- Plan, Run-Protokoll und Detailstatus weisen automatische und manuelle Punkte über denselben bestehenden Provisionierungsvertrag aus.
- Der Erstellungsdialog für neue Realms erhält keine zusätzlichen Detailfragen. Technische Standardwerte werden serverseitig abgeleitet und in der UI nur zusammenfassend dargestellt.
- Bestehende Realms werden durch diesen Change nicht automatisch auf die neue Baseline umgestellt.

## Non-Goals

- keine Übernahme von Benutzern, Rollen, Gruppen, Sessions, Secrets oder tenant-spezifischen Integrationen aus einem Referenz-Realm
- keine Speicherung von SMTP-Passwörtern in Quellcode, Baseline, Registry, Status, Logs oder Browserantworten
- keine allgemeine Keycloak-Sicherheitshärtung für Passwort-Policy, MFA, Brute-Force-Schutz oder Session-Laufzeiten
- keine neue generische Konfigurationsplattform, kein neues Package und kein paralleler Provisionierungsservice
- keine automatische Migration bestehender Realms

## Impact

- Affected specs: `instance-provisioning`, `account-ui`
- Affected code:
  - `packages/core/src/iam/account-management-contract.ts`
  - `packages/instance-registry/src/provisioning-auth-*`
  - `packages/instance-registry/src/service-keycloak-*`
  - `packages/auth-runtime/src/keycloak-admin-client/core.ts`
  - `apps/sva-studio-react/src/routes/admin/instances/`
  - `apps/sva-studio-react/src/i18n/resources/{de,en}/admin/instances/`
  - `docs/architecture/{05-building-block-view,06-runtime-view}.md`
  - `docs/adr/ADR-064-serverseitige-keycloak-realm-baseline.md`
- Database: keine Schemaänderung vorgesehen; Baseline-Version und Nachweise verwenden die vorhandenen Snapshot- und Run-Details.
