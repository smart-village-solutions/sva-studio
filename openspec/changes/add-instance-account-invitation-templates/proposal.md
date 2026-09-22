# Change: Instanzbezogene Account-Einladungen konfigurieren

## Why

Das Studio kann beim Anlegen eines Accounts bereits eine Keycloak-E-Mail zum
Festlegen des Passworts auslösen, verwendet dafür aber den allgemeinen
Keycloak-Text. Da jede Studio-Instanz einem eigenen Realm zugeordnet ist, sollen
Plattformadministratoren Betreff und Nachricht pro Instanz pflegen können,
ohne den sicheren Keycloak-Aktionslink oder den Versand aus Keycloak
herauszulösen.

Die belegte Lücke ist eine instanzbezogene, validierte Verwaltung der drei
Keycloak-Nachrichten `executeActionsSubject`, `executeActionsBody` und
`executeActionsBodyHtml`. Unmittelbare Verbraucher sind die bestehende
Instanzdetailseite und der bestehende Account-Einladungspfad; beide werden
erweitert, statt einen neuen Maildienst oder einen parallelen
Provisionierungsweg einzuführen.

## What Changes

- Das bestehende Keycloak-Theme `sva-kern2` erhält einen versionierten
  E-Mail-Typ mit einem deutschen SVA-Standardtext für Account-Einladungen.
- Die Instanz-Registry speichert optional eine eigene Einladungsvorlage mit
  Betreff, Nachrichtentext und Linkbeschriftungen sowie einer Revision.
- Plattformadministratoren bearbeiten die Vorlage auf der bestehenden
  Instanzdetailseite, sehen eine Vorschau und können sie auf den
  SVA-Standardtext zurücksetzen.
- Die Vorlage unterstützt ausschließlich die kontrollierten Platzhalter
  `{{tenantName}}`, `{{passwordSetupLink}}`, `{{tenantHomepageLink}}` und
  `{{linkExpiresIn}}`; unbekannte Platzhalter, rohes HTML und frei eingegebene
  URLs werden abgewiesen.
- Der Server leitet Tenantname und Startseiten-URL aus der Instanz-Registry ab,
  kompiliert Plaintext und HTML und projiziert ausschließlich die drei
  freigegebenen Realm-Lokalisierungsschlüssel in den eindeutig zugeordneten
  Keycloak-Realm.
- Speichern und Zurücksetzen verwenden die bestehende Autorisierung für die
  Instanzverwaltung und einen revisionsgebundenen, optimistischen
  Schreibvertrag.
- Der vorhandene Einladungsversand bleibt Keycloak-owned. Bei einer
  konfigurierten Individualvorlage darf er nur senden, wenn der aktuelle
  Realm-Readback der gespeicherten Revision entspricht; andernfalls bleibt die
  Accountanlage erfolgreich und der Einladungsteil schlägt wie bisher separat
  fehl.
- Neue Realms erhalten das `sva-kern2`-E-Mail-Theme über die vorhandene
  serverseitige Realm-Baseline. Bestehende Realms werden nur durch eine
  ausdrückliche instanzbezogene Speicherung oder Rücksetzung verändert.

## Non-Goals

- kein Mailversand durch das Studio und kein neuer SMTP-Pfad
- keine Erzeugung, Rückgabe oder Signierung von Keycloak-Aktionstokens im Studio
- kein freier HTML-, CSS-, Freemarker- oder JavaScript-Editor
- keine frei eingegebenen Ziel- oder Homepage-URLs
- keine allgemeine Plattform für beliebige Keycloak- oder Fachmodul-E-Mails
- keine automatische Fleet-Migration aller bestehenden Realms
- keine Delegation der Vorlagenpflege an Tenant-Administratoren im ersten
  Lieferabschnitt; die bestehende Plattform-Instanzverwaltung bleibt zuständig
- keine mehrsprachige Individualvorlage im ersten Lieferabschnitt; die aktuell
  für neue Realms verbindliche deutsche Locale bleibt maßgeblich

## Impact

- Affected specs: `account-ui`, `iam-core`, `instance-provisioning`
- Affected code:
  - `deploy/keycloak/themes/sva-kern2/`
  - `packages/core/src/iam/account-management-contract.ts`
  - `packages/data/migrations/` und `packages/data-repositories/`
  - `packages/instance-registry/src/`
  - `packages/auth-runtime/src/keycloak-admin-client/`
  - `packages/auth-runtime/src/iam-account-management/`
  - `apps/sva-studio-react/src/routes/admin/instances/`
  - `apps/sva-studio-react/src/i18n/resources/{de,en}/admin/instances/`
  - `docs/development/studio-db-schema-final.sql`
  - `docs/development/studio-db-schema.md`
  - `docs/architecture/{05-building-block-view,06-runtime-view,08-cross-cutting-concepts}.md`
- Database: additive, nullable und rückwärtskompatible Instanzkonfiguration mit
  Revisionsvertrag; bestehende Instanzen behalten ohne explizite Anpassung ihr
  bisheriges Versandverhalten.

## Dependencies and coordination

- Der Change erweitert die noch aktive Änderung
  `automate-keycloak-realm-baseline`; deren E-Mail-/Locale-Baseline und
  Keycloak-Readback müssen vor der Implementierung auf dem tatsächlichen
  Ziel-HEAD erneut abgeglichen werden.
- `refactor-tenant-creation-readiness` verändert parallel die
  Instanzdetail-Projektion. Die neue Vorlagenkarte darf deren Readiness- und
  Aktionsmodell nicht duplizieren oder als Aktivierungsvoraussetzung umdeuten.
