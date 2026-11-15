# IAM-Baseline-Seeding für Instanz-Module

## Zweck

Dieses Dokument beschreibt den Entwicklungs- und Testpfad für das modulbezogene IAM-Baseline-Seeding.

## Führende Datenquellen

- `iam.instances` enthält die Instanz
- `iam.instance_modules` enthält den kanonischen Modulsatz
- `@sva/core` liefert den kanonischen Katalog tenantweiter Core-Permissions
- `@sva/studio-module-iam` liefert die Modulbeiträge und die validierte Gesamtsicht

## Lokaler Ablauf

1. Migrationen ausführen:

```bash
pnpm nx run data:db:migrate:up
```

2. Seeds ausführen:

```bash
pnpm nx run data:db:seed
```

3. Instanzdetail oder Modulbereich im Root-Host öffnen.
4. Modul zuweisen oder `IAM-Basis neu aufbauen` ausführen.

## Seed-Szenarien

- Instanz ohne zugewiesene Module:
  - erwartet leere `assignedModules`
  - Plugin-Routen und Plugin-Navigation bleiben blockiert
- Instanz mit gültigem Modulsatz:
  - `assignedModules` enthält die zugewiesenen Modul-IDs
  - passende modulbezogene Permissions sind vorhanden
- Instanz mit absichtlich driftender IAM-Basis:
  - Modul ist zugewiesen, aber Permission- oder Rollenbasis fehlt teilweise
  - `seedIamBaseline` rekonstruiert die Basis idempotent

## Prüfregeln

- Modulverträge dürfen nur über `plugin.moduleIam` eingebracht werden.
- unbekannte Module werden serverseitig abgewiesen
- Entzug entfernt nur eindeutig als `module_sync` verwaltete Grants; Permission-Definitionen bleiben erhalten
- `seedIamBaseline` verändert keine Rollenmitgliedschaften des aufrufenden Benutzers
- Tenant- und aktive Modul-Permissions werden standardmäßig an `system_admin` vergeben; Ausnahmen sind explizit zu deklarieren
- Katalogentfernung oder Deprecation löst keine automatische Löschung aus

## Relevante Checks

```bash
openspec validate add-canonical-permission-catalog --strict
pnpm check:server-runtime
pnpm nx run-many --target=test:unit --projects=plugin-sdk,instance-registry,data-repositories,data,routing,sva-studio-react --parallel=4
```

## Redaktionsprofil

Die Modulbaseline definiert weiterhin die bestehende `system_admin`-Basis. Das frühere begrenzte Redaktionsprofil `editor` wird ausschließlich auf ausdrücklichen Auftrag über das persönliche MCP und bestehende Rollen-APIs angelegt; wiederholtes Seeding erweitert es nicht automatisch. Actions, Scope-Ausnahmen, nicht unterstützte Inhaltstypen und Readback sind im [MCP-Betrieb](../operations/studio-instance-mcp-betrieb.md#redaktionsprofil-für-ausdrücklich-ausgewählte-tenants) beschrieben. `content.publish` ist recordbezogen und unterstützt die bestehenden Zuweisungsscopes; ein Organisationsgrant bleibt deshalb bei der Persistenz erhalten.

### Lokaler technischer Abnahmenachweis

Der synthetische Kompositionstest in `scripts/ci/iam-acceptance.test.ts` führt den tatsächlich von `ensureEditorRoles` erzeugten Rollen-POST des früheren begrenzten MCP-Profils `editor` für zwei Testtenants weiter: Payloadvalidierung mit dem bestehenden Rollen-API-Schema, tenantlokale Permission-ID-Zuordnung, unabhängiger Readback, Account-Rollenzuordnung im synthetischen Store und Übergabe der daraus abgeleiteten Grants an die produktiven Berechtigungsprüfungen. Der Permission-Katalog und die Scope-Metadaten stammen aus den bestehenden Produktionsmodulen; eine zweite Positivliste der Redaktionsrechte wird nicht nachgebaut.

Der normalisierte erzeugte Grant-Satz wird verbindlich mit `apps/sva-studio-react/src/test/fixtures/editor-role-baseline.json` verglichen. Die bestehende `Sidebar.test.tsx` verwendet denselben Vertrag und die produktive Sidebar-Zugriffslogik. Eine Änderung am erzeugten Profil kann dadurch nicht unbemerkt von den Navigationstests abweichen.

Der Nachweis umfasst:

- Rollenanlage und Readback in zwei getrennten Testtenants mit unterschiedlichen Permission-IDs sowie wiederholte Ausführung ohne zusätzliche Writes.
- Individuell entzogene Rechte bleiben im ersten Tenant entzogen, während derselbe Vorgang im zweiten Tenant weiterhin erlaubt bleibt.
- Die bestehenden Benutzer- und Rollen-Readhandler-Factories werden mit lokalen Callbacks zum produktiven Instanz-Permissionguard komponiert und verweigern Redaktionskonten den Zugriff vor dem Datenlesen; Administrationskonten erhalten Zugriff. Ein Account ohne Rollenzuordnung im anderen Tenant bleibt ausgeschlossen. Zusätzliche Admin-/Transfer-Actions werden über den produktiven Instanz-Guard geprüft.
- Der produktive exakte Mainserver-Ownership-Guard erlaubt News-/Veranstaltungs-/POI-Änderungen, Löschung und Veröffentlichung für den eigenen Organisationsprovider und verweigert andere Organisations- beziehungsweise Tenantprovider. Bestehende instanzweite Adminrechte bleiben erhalten; Medien und Kategorien verwenden die vereinbarte instanzweite Ausnahme.
- Die Sidebar zeigt Redakteuren Inhalte, Medien und Kategorien, aber keine Benutzer-/Rollenverwaltung; effektive Berechtigungen gelten auch dann, wenn ein Rollenname weiter vorhanden ist.

Gezielter lokaler Lauf ohne Dependency-Builds oder Datenbank-/Keycloak-Mutationen:

```bash
pnpm --config.verify-deps-before-run=false nx run tooling-testing:test:unit --excludeTaskDependencies --testFiles=../../scripts/ci/iam-acceptance.test.ts
```

Readhandler-Factories, Berechtigungsentscheidungen und Rollenproduzent stammen aus dem Produktivcode. Die verbindenden Read-Access-Callbacks sind lokale Testadapter: Die produktive Verdrahtung in `roles-handlers.ts` und `user-read-shared.ts` einschließlich Instanzweitergabe, Actor-Membership-Auflösung, Featurechecks und Fehlerabbildung wird hier nicht geprüft. Auch der vollständige produktive HTTP-/Auth-/Permissionstore-Adapter wird nicht ausgeführt. Tenant-API-Antworten, Speicherung, Identitätskontext, Datenlesen sowie Credential-/DataProvider-Bindings sind ausdrücklich synthetische I/O-Doubles. Dies ist ein technischer Vertrags- und Kompositionsnachweis, keine Live-Abnahme von HTTP-Transport, OIDC, Datenbank/RLS, tatsächlichen Mainserver-Credentials oder produktiven Rollen. Der bestehende Live-Runner `run-iam-acceptance.ts` wird dafür nicht ausgeführt. Die credential-visible Collection-Lesesicht und die nicht unterstützten Inhaltstypen bleiben unverändert.

## Standard Redakteur

Die tenantlokale Studio-Rolle `standard_editor` („Standard Redakteur“) wird atomar mit der erstmaligen Mandantenanlage erzeugt. Sie ist keine geschützte Systemrolle und wird niemandem automatisch zugewiesen. Ein wiederholter Create-Aufruf auf einen bestehenden Mandanten erzeugt sie nicht erneut. Die reguläre Core-/Modulsynchronisierung ergänzt ausschließlich Rechte einer noch vorhandenen Rolle; eine bewusste Löschung bleibt bestehen.

Der bestehende Permission-Katalog in `packages/core/src/iam/permission-catalog.ts` definiert die redaktionelle Auswahl. Unterstützt sind News, Veranstaltungen, POI, generische Inhalte, FAQ, Cockpit-Kacheln, Projekte, Umfragen, Baustellen, Stellenanzeigen und Gutscheine, jeweils bei verfügbarem Modul. Lesen, Bearbeiten, Löschen, Veröffentlichung, Statuswechsel, Archivierung, Wiederherstellung und Historie sowie `news.pushNotification` nutzen den Datensatzscope `organization`: Inhaber ist die aktive eigene Organisation **oder** der aktuelle Account. Ohne aktive Organisation bleiben persönliche Inhalte zugänglich. `creator_account_id` ersetzt kein Eigentum. Create-Actions sind Instanzrechte; der vorhandene Principal-Vertrag begrenzt den gewählten Eigentümer auf den berechtigten Organisations- oder persönlichen Principal.

Medien und Kategorien einschließlich Medienreferenzen werden mandantenweit verwaltet. Der bestehende Medien-Löschschutz für referenzierte Assets bleibt erhalten; Kategorien verwenden weiterhin den Mainserver-Vertrag. Es entstehen keine Benutzer-/Rollen-/Organisationsverwaltung, Schnittstellen-, Modulkonfigurations-, Ownership-Transfer- oder Revisionsverwaltungsrechte. Für bestehende Mainserver-Datensätze erzwingen redaktionelle Mutationen und Action-Projektionen die vorhandene exakte Eigentumsprüfung auch im Kompatibilitäts-/Shadow-Modus; der globale Resolvermodus bleibt unverändert. Push beim Bearbeiten einer Nachricht wird zusätzlich am konkreten Inhaltsobjekt geprüft.

Migration `0116_iam_standard_editor_role.sql` ergänzt fehlende Rollen einmalig für alle bestehenden Mandanten und materialisiert passende Permissions und Grants. Schlüssel-/Namenskollisionen sowie abweichende Bestandsprofile brechen die gesamte Migration ohne Überschreiben ab und benötigen eine ausdrückliche fachliche Klärung. Vorhandene passende Rollen und alle Mitgliedschaften bleiben unverändert. Der Down-Pfad löscht keine Rollen, Grants oder inzwischen entstandenen Zuweisungen; die Goose-Historie verhindert die Wiederholung eines erfolgreich ausgeführten Backfills. Eine bewusste manuelle Rücksetzung dieser Historie ist keine unterstützte Wiederherstellung gelöschter Standardrollen.

Der frühere, begrenzte MCP-Auftrag für `editor` bleibt separat und unverändert. Er richtet weder automatisch neue Mandanten ein noch ersetzt er den einmaligen Bestandsabgleich.

Generische Core-Inhaltsaktionen prüfen für jeden konkreten Inhaltstyp zusätzlich die bestehende Modulaktivierung; Core-Grants erlauben keinen Zugriff auf deaktivierte Module. Bei Berechtigungsauflösung ohne aktive Organisation werden explizite `own`-/`organization`-Datensatzgrants auf persönliches Eigentum reduziert, ohne Organisationsbedingungen aus bloßen Mitgliedschaften zu übernehmen. Legacy-Grants ohne expliziten Datensatzscope bleiben unverändert.

Modulvertragliche Ausnahmen: Gutscheine benötigen für Veröffentlichung und Zurückziehen zusätzlich `vouchers.publish` im Scope `organization`. Das Baustellenmodul unterstützt derzeit kein Löschen; `construction-sites.delete` wird daher weder bei Neuanlage noch in der Bestandsmigration gewährt. Es werden ausschließlich bereits vom jeweiligen Modul unterstützte redaktionelle Fähigkeiten vergeben.

Die Bestandsprüfung vergleicht neben Grants und Anzeigename auch die vollständige kanonische Rollenidentität: `role_name` und `external_role_name` gleich `standard_editor`, Rollenstufe 0, Studio-Ownership und Profilmarker `studio:standard-editor:v1`. Abweichungen bleiben unverändert und stoppen die Migration. Vier zusätzliche PostgreSQL-Fälle decken abweichende Namen, Rollenstufe und Beschreibung ab.

Der bereits registrierte Core-Inhaltstyp `GENERIC_CONTENT_TYPE` (`generic`) benötigt kein Plugin-Modul und bleibt von der Modulabfrage ausgenommen; seine normalen Core-Permissions und Ownership-Grenzen werden unverändert geprüft. Diese exakte Core-Ausnahme erlaubt keine beliebigen unbekannten Inhaltstypen.
