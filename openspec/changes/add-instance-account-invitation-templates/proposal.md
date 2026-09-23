# Change: Server- und instanzbezogene Account-Einladungen konfigurieren

## Why

Das Studio kann beim Anlegen eines Accounts bereits eine Keycloak-E-Mail zum
Festlegen des Passworts auslösen, verwendet dafür aber den allgemeinen
Keycloak-Text. Da jede Studio-Instanz einem eigenen Realm zugeordnet ist, sollen
Plattformadministratoren Betreff und Nachricht als serverweiten Standard und
bei Bedarf abweichend pro Instanz pflegen können,
ohne den sicheren Keycloak-Aktionslink oder den Versand aus Keycloak
herauszulösen.

Die belegte Lücke ist eine server- und instanzbezogene, validierte Verwaltung der drei
Keycloak-Nachrichten `executeActionsSubject`, `executeActionsBody` und
`executeActionsBodyHtml`. Unmittelbare Verbraucher sind die neue kleine
Templates-Seite, die bestehende Instanzdetailseite und der bestehende
Account-Einladungspfad; sie werden ohne neuen Maildienst oder parallelen
Provisionierungsweg erweitert.

## What Changes

- Das bestehende Keycloak-Theme `sva-kern2` erhält einen versionierten
  E-Mail-Typ mit einem deutschen SVA-Standardtext für Account-Einladungen.
- Die Instanz-Registry speichert optional eine eigene Einladungsvorlage mit
  Betreff, Nachrichtentext und Linkbeschriftungen sowie einer Revision.
- Unter `System -> Templates` pflegen Plattformadministratoren die
  serverweite Standardvorlage. Fehlt sie, gilt der eingebaute SVA-Standard.
- Die wirksame Reihenfolge lautet Instanzvorlage, Servervorlage,
  SVA-Standard. Eine Instanz ohne eigenen Text erbt den Servertext, ohne dass
  dieser in alle Instanzdatensätze kopiert wird.
- Plattformadministratoren bearbeiten die Vorlage auf der bestehenden
  Instanzdetailseite, sehen eine Vorschau und können sie auf den
  geerbten Servertext zurücksetzen.
- Die Vorlage unterstützt ausschließlich die kontrollierten Platzhalter
  `{{tenantName}}`, `{{passwordSetupLink}}`, `{{tenantHomepageLink}}` und
  `{{linkExpiresIn}}`; unbekannte Platzhalter, rohes HTML und frei eingegebene
  URLs werden abgewiesen.
- Der Server leitet Tenantname und Startseiten-URL aus der Instanz-Registry ab
  und kompiliert Plaintext und HTML. Unmittelbar vor einem konkreten Versand
  stellt er die wirksame Vorlage ausschließlich über die drei freigegebenen
  Realm-Lokalisierungsschlüssel im eindeutig zugeordneten Keycloak-Realm sicher.
- Speichern und Zurücksetzen verwenden die bestehende Autorisierung für die
  Instanzverwaltung und einen revisionsgebundenen, optimistischen
  Schreibvertrag.
- Der vorhandene Einladungsversand bleibt Keycloak-owned. Bei Abweichung wird
  die wirksame Vorlage für genau diesen Versand idempotent geschrieben und
  zurückgelesen. Scheitert dies, bleibt die Accountanlage erfolgreich und nur
  der Einladungsteil schlägt wie bisher separat fehl.
- Neue Realms erhalten das `sva-kern2`-E-Mail-Theme über die vorhandene
  serverseitige Realm-Baseline. Bestehende Realms werden erst bei einem
  konkreten Einladungsversand bedarfsgesteuert ausgerichtet.

## Non-Goals

- kein Mailversand durch das Studio und kein neuer SMTP-Pfad
- keine Erzeugung, Rückgabe oder Signierung von Keycloak-Aktionstokens im Studio
- kein freier HTML-, CSS-, Freemarker- oder JavaScript-Editor
- keine frei eingegebenen Ziel- oder Homepage-URLs
- keine freie oder typunabhängige Template-Engine; der erste Lieferabschnitt
  unterstützt ausschließlich die Account-Einladung
- keine sofortige Fleet-Migration, kein Hintergrundjob und kein globaler
  Projektions- oder Teilfehlerstatus
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
  - `apps/sva-studio-react/src/routes/admin/templates/`
  - `apps/sva-studio-react/src/components/Sidebar.tsx`
  - `apps/sva-studio-react/src/i18n/resources/{de,en}/admin/instances/`
  - `docs/development/studio-db-schema-final.sql`
  - `docs/development/studio-db-schema.md`
  - `docs/architecture/{05-building-block-view,06-runtime-view,08-cross-cutting-concepts}.md`
- Database: additive, nullable und rückwärtskompatible Server- und
  Instanzkonfiguration mit Revisionsvertrag; bestehende Instanzen ohne
  Individualvorlage erben den wirksamen Serverstandard.

## Dependencies and coordination

- Der Change erweitert die noch aktive Änderung
  `automate-keycloak-realm-baseline`; deren E-Mail-/Locale-Baseline und
  Keycloak-Readback müssen vor der Implementierung auf dem tatsächlichen
  Ziel-HEAD erneut abgeglichen werden.
- `refactor-tenant-creation-readiness` verändert parallel die
  Instanzdetail-Projektion. Die neue Vorlagenkarte darf deren Readiness- und
  Aktionsmodell nicht duplizieren oder als Aktivierungsvoraussetzung umdeuten.
