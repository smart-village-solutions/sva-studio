# Change: Waste-Management-Plugin für SVA Studio integrieren

## Why

Das Studio hat heute kein Fachmodul für den vollständigen kommunalen Abfallkalender. Im bestehenden `Newcms` existiert bereits ein fachlich brauchbarer MVP für Stammdaten, Touren, Terminverschiebungen und Data-Tools, aber dessen Architektur passt nicht zu den Plugin-, Routing-, IAM- und Host-Grenzen des Studios.

Das Studio benötigt deshalb einen eigenständigen Change, der das Waste-Management entlang der bestehenden Zielarchitektur neu aufsetzt: als freies Fachplugin mit hostgeführter Server-Fassade, instanzgebundenem Datenmodell, feingranularem Modul-IAM und auditierbaren Hochrisiko-Operationen. Ohne diesen Change würde ein direkter Port aus `Newcms` die Plugin-Boundary, die Studio-Serververantwortung und die Instanzisolation unterlaufen.

## What Changes

- Neues Fachplugin `@sva/plugin-waste-management` mit freier Route `/plugins/waste-management`
- Neue Capability `waste-management` für die vollständige Admin-Oberfläche des Abfallkalenders
- Hostgeführte Server-Fassade unter `/api/v1/waste-management/*` für CRUD- und Spezialoperationen
- Genau eine instanzbezogene Waste-Fachdatenbank pro Studio-Instanz mit serverseitig aufgelöster Verbindung und im Studio-Postgres hinterlegter Datenquellenkonfiguration
- Direkter serverseitiger Zugriff auf die bestehende `waste_*`-Tabellenfamilie als Migrationsbasis innerhalb der jeweiligen Waste-Fachdatenbank, ohne Abhängigkeit auf `Newcms`-Edge-Functions
- Detaillierte Portierungsregeln, die `Newcms` als UX- und Fachreferenz zulässig machen, aber einen verdeckten Architekturport in Plugin, Runtime, IAM und Persistenz ausschließen
- Gezielte Schema-Weiterentwicklung innerhalb der Waste-Fachdatenbank inklusive dokumentiertem Migrationspfad und pluginangebotenen Update-Migrationen
- Fokus auf Betrieb als führendes Fachsystem; sekundäre Fremdsystem-Synchronisation bleibt nur architektonisch offen
- Erweiterte Terminlogik für manuelle Einzelverschiebungen und konsistente Folgeeffekte auf wiederkehrende Tourtermine
- Feiertags- und Abweichungslogik als ausdrücklicher Fachbestandteil des Terminmodells
- Adresshierarchie für Ort, Straße und Hausnummer als fachlicher Kernvertrag für Zuordnung und spätere Ausspielkanäle
- Mehrsprachige, farbcodierte Fachstammdaten für Abfallarten und Tourdarstellungen
- Feingranulares Modul-IAM für Lesen, Stammdaten, Touren/Zuordnungen, Scheduling, Import, Seed, Reset und Einstellungen
- Audit-Integration für alle Mutationen, insbesondere CSV-Import, Seed und Reset
- Klare Trennung zwischen zentralem Studio-Postgres für Rollen, Rechte, Audits und Modulkonfigurationen einerseits und instanzbezogenen Waste-Fachdaten andererseits
- Keine IAM-, Rollen-, Rechte- oder Audit-Primärdaten des Studios in der externen Waste-/Supabase-Datenbank
- Waste-spezifische Migrations-, Job- und sonstige plugininterne Hilfsdaten dürfen in der externen Waste-/Supabase-Datenbank liegen
- Das Studio-Postgres darf zusätzlich zentrale Status-, Monitoring- und fortlaufende Historienmetadaten zur externen Waste-Datenquelle führen
- Waste setzt den vorgelagerten Change `update-plugin-platform-for-generic-jobs-imports` voraus und nutzt dessen generische Studio-Job-Fähigkeit mit zentraler Persistenz im Studio-Postgres
- Waste setzt den vorgelagerten Change `update-plugin-platform-for-generic-jobs-imports` voraus und nutzt dessen generische Import-Fähigkeit über pluginseitig definierte Importprofile
- Der `plugin-sdk` wird für Jobtypen und Importprofile im Vorgängerchange erweitert; Waste konsumiert diese Verträge und definiert darauf seine fachlichen Beiträge
- Importprofile beschreiben je Plugin und Importtyp mindestens Zielfelder, Pflichtfelder, den im jeweiligen Fachchange wirklich gelieferten Quellformatumfang, Mapping-Regeln, Validierungen sowie eine kanonische Vorlage mit Beispieldatei oder Beispielspalten
- Die konkrete allgemeine Host-Oberfläche für Import-Wizard, Jobdarstellung oder Monitoring kann im Vorgängerchange vorbereitet werden; Waste darf diese anbinden, baut sie aber nicht mehr als plattformweite Voraussetzung selbst auf
- Waste-spezifische Screens, Jahreskalender, Touren-, Ausweichtermin-, Abholort- und Fraktionsdialoge bleiben hingegen fachliche Bestandteile des Plugins und wandern nicht in die allgemeine Plugin-UI-Library
- Die erste Pflichtmenge dieser zentralen Historie umfasst mindestens Connection-Checks, Datenquellen-Rekonfigurationen sowie Start/Erfolg/Fehler von Migration, Import, Seed und Reset
- Diese erste zentrale Historie bleibt zunächst auf technische Ereignisse beschränkt
- Fehlgeschlagene Connection-Checks müssen zusätzlich sofort einen sichtbaren aktuellen Status an der zentralen Instanz-/Plugin-Konfiguration setzen
- Erfolgreiche Connection-Checks heben diesen sichtbaren Störungsstatus sofort wieder auf; der Verlauf bleibt über die Historie nachvollziehbar
- Beim Laden der Settings-Seite darf automatisch ein expliziter Connection-Check laufen; außerhalb davon dürfen echte erfolgreiche oder fehlgeschlagene DB-Zugriffe den sichtbaren Status implizit mitaktualisieren
- Periodische Hintergrund-Checks sind nicht Teil dieses Changes
- Für den aktuellen sichtbaren Status gilt die einfachste Regel: jeder technisch erfolgreiche echte DB-Zugriff darf den Status sofort auf `ok` setzen
- Asynchrone Data-Tools für CSV-Import, Seed, Reset und Waste-Schema-Migrationen auf Basis einer generischen Studio-Job-Fähigkeit mit nachvollziehbarem Statusmodell
- Waste nutzt für `geografie-abholorte`, `touren` und `ausweichtermine` die generische Studio-Import-Fähigkeit mit jeweils eigenem Importprofil und eigener Validierung
- Für Waste sind in diesem Change CSV und echter Excel-Import (`.xlsx`) die verpflichtenden ersten produktiven Importumfänge; weitere Quellformate bleiben Aufgabe der generischen Plattform und werden hier nicht als bereits geliefert behauptet
- Search-Param- und Routing-Vertrag für tab-lastige Fachnavigation, Filter und Deep-Links
- Rechtegesteuerte UI-Sichtbarkeit für schreibende und gefährliche Aktionen
- Architektur- und Arc42-Fortschreibung für Plugin-Boundary, Server-Fassade, Instanzisolierung und Auditverhalten

## Findings zum heutigen Workspace

- Die statische Plugin-Registrierung läuft heute bereits über die Build-Time-Registry des Hosts; Waste muss sich dort einhängen statt eine zweite Registry-Logik anzunehmen.
- Modul-IAM ist inzwischen zentral über `studio-module-iam` und Host-Registries organisiert; der Change darf dafür keine neue dritte Führungsquelle schneiden.
- Host-API-Endpunkte gelten erst dann als produktiver Vertrag, wenn sie im typisierten Runtime-Route-Katalog verankert sind.
- `/monitoring` existiert aktuell nur als Platzhalter; eine vollwertige pluginübergreifende Job- oder Monitoring-Oberfläche kann daher nicht länger als implizit vorhandene Basis vorausgesetzt werden.

## Non-Goals

- Keine öffentlichen Bürger-Read-APIs für Abfalltermine in diesem Change
- Keine Export- oder Feed-Schnittstellen wie iCal, JSON-Feeds oder PDF-Exporte in diesem Change
- Keine produktive Push-Benachrichtigungs-Ausspielung in diesem Change
- Keine konkrete Fremdsystem-Synchronisation oder Konfliktlogik für sekundäre Führung in diesem Change
- Kein direkter Wiedergebrauch von `Newcms`-UI, `Newcms`-Hooks oder `Newcms`-Supabase-Functions als produktiver Studio-Vertrag
- Kein produktiver Import oder Laufzeitvertrag gegen `Newcms`-spezifische Hooks, API-Clients, Auth-Logik, Zustandscontainer oder Persistenzannahmen

## Impact

- Affected specs:
  - `waste-management`
  - `routing`
  - `iam-access-control`
  - `iam-auditing`
  - `architecture-documentation`
- Affected code:
  - `packages/plugin-waste-management`
  - `apps/sva-studio-react`
  - `packages/routing`
  - `packages/plugin-sdk`
  - `packages/auth-runtime`
  - `packages/instance-registry`
  - `packages/server-runtime`
  - `packages/data`
  - `packages/data-repositories`
  - `packages/iam-admin`
  - `packages/iam-governance`
  - `packages/studio-module-iam`
  - `packages/core`
  - `packages/studio-ui-react`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
