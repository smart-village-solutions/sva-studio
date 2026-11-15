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

## Standard Redakteur

Die tenantlokale Studio-Rolle `standard_editor` („Standard Redakteur“) wird atomar mit der erstmaligen Mandantenanlage erzeugt. Sie ist keine geschützte Systemrolle und wird niemandem automatisch zugewiesen. Ein wiederholter Create-Aufruf auf einen bestehenden Mandanten erzeugt sie nicht erneut. Die reguläre Core-/Modulsynchronisierung ergänzt ausschließlich Rechte einer noch vorhandenen Rolle; eine bewusste Löschung bleibt bestehen.

Der bestehende Permission-Katalog in `packages/core/src/iam/permission-catalog.ts` definiert die redaktionelle Auswahl. Unterstützt sind News, Veranstaltungen, POI, generische Inhalte, FAQ, Cockpit-Kacheln, Projekte, Umfragen, Baustellen, Stellenanzeigen und Gutscheine, jeweils bei verfügbarem Modul. Lesen, Bearbeiten, Löschen, Veröffentlichung, Statuswechsel, Archivierung, Wiederherstellung und Historie sowie `news.pushNotification` nutzen den Datensatzscope `organization`: Inhaber ist die aktive eigene Organisation **oder** der aktuelle Account. Ohne aktive Organisation bleiben persönliche Inhalte zugänglich. `creator_account_id` ersetzt kein Eigentum. Create-Actions sind Instanzrechte; der vorhandene Principal-Vertrag begrenzt den gewählten Eigentümer auf den berechtigten Organisations- oder persönlichen Principal.

Medien und Kategorien einschließlich Medienreferenzen werden mandantenweit verwaltet. Der bestehende Medien-Löschschutz für referenzierte Assets bleibt erhalten; Kategorien verwenden weiterhin den Mainserver-Vertrag. Es entstehen keine Benutzer-/Rollen-/Organisationsverwaltung, Schnittstellen-, Modulkonfigurations-, Ownership-Transfer- oder Revisionsverwaltungsrechte. Für bestehende Mainserver-Datensätze erzwingen redaktionelle Mutationen und Action-Projektionen die vorhandene exakte Eigentumsprüfung auch im Kompatibilitäts-/Shadow-Modus; der globale Resolvermodus bleibt unverändert. Push beim Bearbeiten einer Nachricht wird zusätzlich am konkreten Inhaltsobjekt geprüft.

Migration `0116_iam_standard_editor_role.sql` ergänzt fehlende Rollen einmalig für alle bestehenden Mandanten und materialisiert passende Permissions und Grants. Schlüssel-/Namenskollisionen sowie abweichende Bestandsprofile brechen die gesamte Migration ohne Überschreiben ab und benötigen eine ausdrückliche fachliche Klärung. Vorhandene passende Rollen und alle Mitgliedschaften bleiben unverändert. Der Down-Pfad löscht keine Rollen, Grants oder inzwischen entstandenen Zuweisungen; die Goose-Historie verhindert die Wiederholung eines erfolgreich ausgeführten Backfills. Eine bewusste manuelle Rücksetzung dieser Historie ist keine unterstützte Wiederherstellung gelöschter Standardrollen.

Der frühere, begrenzte MCP-Auftrag für `editor` bleibt separat und unverändert. Er richtet weder automatisch neue Mandanten ein noch ersetzt er den einmaligen Bestandsabgleich.

Generische Core-Inhaltsaktionen prüfen für jeden konkreten Inhaltstyp zusätzlich die bestehende Modulaktivierung; Core-Grants erlauben keinen Zugriff auf deaktivierte Module. Bei Berechtigungsauflösung ohne aktive Organisation werden explizite `own`-/`organization`-Datensatzgrants auf persönliches Eigentum reduziert, ohne Organisationsbedingungen aus bloßen Mitgliedschaften zu übernehmen. Legacy-Grants ohne expliziten Datensatzscope bleiben unverändert.

Modulvertragliche Ausnahmen: Gutscheine benötigen für Veröffentlichung und Zurückziehen zusätzlich `vouchers.publish` im Scope `organization`. Das Baustellenmodul unterstützt derzeit kein Löschen; `construction-sites.delete` wird daher weder bei Neuanlage noch in der Bestandsmigration gewährt. Es werden ausschließlich bereits vom jeweiligen Modul unterstützte redaktionelle Fähigkeiten vergeben.

Die Bestandsprüfung vergleicht neben Grants und Anzeigename auch die vollständige kanonische Rollenidentität: `role_name` und `external_role_name` gleich `standard_editor`, Rollenstufe 0, Studio-Ownership und Profilmarker `studio:standard-editor:v1`. Abweichungen bleiben unverändert und stoppen die Migration. Vier zusätzliche PostgreSQL-Fälle decken abweichende Namen, Rollenstufe und Beschreibung ab.
