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
- Die generische Studio-Job-Fähigkeit ist zentral persistent im Studio-Postgres und verwendet initial mindestens die Stati `queued`, `running`, `succeeded`, `failed`, `cancelled`
- Das Studio stellt zusätzlich eine generische Import-Fähigkeit für CSV, Excel sowie schema-nahe JSON- und XML-Quellen bereit, die über pluginseitig definierte Importprofile genutzt wird
- Die generischen Studio-Fähigkeiten für Jobs und strukturierte Importe werden in diesem Change bereits als tragfähige Plattformbasis für weitere Plugins aufgebaut und nicht nur als schmale Waste-Vorbereitung
- Der `plugin-sdk` wird dabei so erweitert, dass Plugins explizit Jobtypen und Importprofile registrieren können, während das Studio Runtime, UI und Orchestrierung zentral bereitstellt
- Importprofile beschreiben je Plugin und Importtyp mindestens Zielfelder, Pflichtfelder, erlaubte Quellformate, Mapping-Regeln, Validierungen sowie eine kanonische Vorlage mit Beispieldatei oder Beispielspalten
- Die erste Studio-Import-Oberfläche wird als mehrstufiger Wizard mit Quellwahl, Profilwahl, Mapping-Prüfung, Validierungsvorschau, Job-Start und Ergebnisansicht modelliert
- Das Studio darf für solche Importprofile automatische Mapping-Vorschläge für Quellspalten erzeugen; Benutzer müssen diese Vorschläge prüfen und manuell korrigieren können
- Das Studio darf einfache gespeicherte Mapping-Vorlagen pro Instanz und Importprofil vorhalten, damit wiederkehrende Importe nicht jedes Mal neu gemappt werden müssen
- Die automatische Mapping-Strecke wird so geschnitten, dass später eine externe KI-basierte Vorschlagslogik als austauschbare Integrationsstelle ergänzt werden kann, ohne den generischen Importvertrag neu zu zerlegen
- Automatische Retry-Logik ist nicht Teil der ersten generischen Studio-Job-Fähigkeit
- Fehlgeschlagene oder abgebrochene Jobs werden in der ersten Ausbaustufe nicht neu gestartet, sondern bei Bedarf als neue Jobs erneut angestossen
- `cancelled` ist in der ersten Ausbaustufe Teil des Statusmodells, ohne dass für alle Jobtypen bereits eine aktive Cancel-Mechanik verpflichtend sein muss
- Die generische Studio-Job-Fähigkeit soll in der ersten Ausbaustufe auch UI-seitig als pluginübergreifendes Studio-Konzept sichtbar werden
- Die erste pluginübergreifende Job-Sicht wird unter dem bestehenden Sidebar-Punkt `Monitoring` verankert; ein späteres Desktop-Widget ist nicht Teil dieses Changes
- Die erste `Monitoring`-Sicht bleibt eine technische und zunächst temporäre Admin-Sicht für Jobs, Datenquellenstatus und technische Ereignishistorie; eine breitere Betriebsoberfläche ist nicht Teil dieses Changes
- Wiederverwendbare Interaktionsmuster wie Import-Dialog-Flow, Job-/Monitoring-Darstellung, Bulk-Actions, Hochrisiko-Confirm und technische Statusanzeigen werden als allgemeine Studio-UI-Bausteine geschnitten
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
- Search-Param- und Routing-Vertrag für tab-lastige Fachnavigation, Filter und Deep-Links
- Rechtegesteuerte UI-Sichtbarkeit für schreibende und gefährliche Aktionen
- Architektur- und Arc42-Fortschreibung für Plugin-Boundary, Server-Fassade, Instanzisolierung und Auditverhalten

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
  - `packages/core`
  - `packages/studio-ui-react`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
