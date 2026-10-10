# Change: Verbleibende Waste-Fachkopplungen aus dem Studio-Host entfernen

## Why

Code-Baseline: `1cab0ade9` (08.10.2026), geprüft am 09.10.2026. Waste-HTTP-Handler und wesentliche Repositories liegen bereits in eigenen Paketen; die App implementiert aber weiterhin fachliche Hintergrundoperationen. Allgemeine Job-Endpunkte, Instanzverwaltung, Audit-Projektionen und die Host-Fassade kennen weiterhin konkrete Waste-Typen und Regeln. Die leere JSON-Allowlist verdeckt zusätzliche Ausnahmen im Architekturcheck selbst.

Dieser Folgechange ergänzt den abgeschlossenen `refactor-waste-plugin-ownership`, dessen Scope unter anderem Registry und allgemeine Loader ausklammerte. Er setzt dessen erledigte Aufgaben nicht zurück. Maßgeblich für die Bestandsaufnahme ist der aktuelle Code, nicht historische Architekturtexte.

## What Changes

- Fachliche Operations-Implementierungen aus `apps/sva-studio-react/src/lib/waste-*` in die vorhandene `@sva/waste-management-runtime` verschieben; technische Dienste am vorhandenen Composition-Punkt binden.
- Waste-Jobs über Manifest und bestehenden Snapshot laden; feste Waste-Registrierung und jobId-basierte Policies im allgemeinen Jobloader durch eng begrenzte, hostvalidierte Beiträge ersetzen.
- Fachliche Start- und Artefaktregeln aus allgemeinen Endpunkten herauslösen, ohne bestehende Berechtigungen, Actor-Bindung oder Lifecycle-Schutz zu schwächen.
- Waste-Einstellungen und Audit-Interpretation von generischen Instanz-/Governance-Verträgen trennen. Fachliche Persistenzadapter in der bestehenden Waste-Runtime halten; vorhandene Tabellen und Daten bleiben erhalten.
- Die bisherige direkte Auth-Kopplung des Plugin-Server-Entries durch die nötigen öffentlichen Host-Fähigkeiten ersetzen. Fachpaket-interne Abhängigkeiten auf Waste-Contracts/Runtime bleiben zulässig, begründen aber keinen Zugriff auf Host-Interna.
- Die eingebauten Waste-Host-Ausnahmen im bestehenden Architekturcheck entfernen und die Abnahme anhand von Importgraph, echten Testpfaden und finalen Artefakten führen.

## Nicht-Ziele und Anti-Overengineering

- Keine neuen Packages, Services, Datenbanken, Worker, Plugin-Registry, Policy-Engine, Deploymentprofile oder CI-Workflows.
- Keine neue allgemeine Plugin-Plattform, dynamische Installation oder Sandbox; bestehende Manifest-, Loader-, Snapshot-, Dispatcher- und Jobpfade werden erweitert.
- Keine Änderung von Touren-, Import-, PDF-, Kalender-, Reminder- oder Mainserver-Fachregeln; keine Datenlöschung und keine fachliche Schemaänderung.
- Keine pauschale Bereinigung aller Plugins oder globale Umstellung des warn-only Architekturchecks auf strict. Ein strikter Nachweis gilt gezielt für die Waste-Grenze.
- Keine automatische Migration aller historischen Datensätze und keine neuen Abstraktionen für hypothetische Verbraucher.
- Keine kosmetische UI-Überarbeitung. Aktive fachliche Ergebnisinterpretation in Monitoring wird mit ihrem Verbraucher umgestellt; reine Labels/Routenmetadaten sind kein Beweis für geladene Waste-Runtime.
- Ersetzte Ausführungspfade werden im selben Lieferabschnitt gelöscht; keine dauerhaften Weiterleitungs-Barrels, Fallback-Registrierungen oder Shadow-Runtimes.

## Impact

- Affected specs: `plugin-platform`, `plugin-operations-platform`. Bestehende Fachspezifikationen für `waste-management` und `public-waste-calendar` bleiben Verhaltenserwartung.
- Maximal betroffene Bereiche: vorhandene Waste-Pakete; `packages/{plugin-sdk,auth-runtime,data-repositories,instance-registry,iam-governance}`; Waste-Verbraucher und Plugin-/Job-Composition in `apps/sva-studio-react`; direkte Importanpassungen in `apps/public-waste-calendar-web`; bestehende Architektur-/Distributions-/Artefaktprüfungen unter `scripts/ci`; zugehörige Tests und Workspace-Abhängigkeiten.
- Core, Routing, Server-Runtime und Mainserver nur bei einer nachgewiesenen unmittelbaren öffentlichen Vertragskante; kein fachlicher Ausbau dieser Pakete.
- Betroffene arc42-Abschnitte bei Implementierung: `04-solution-strategy.md`, `05-building-block-view.md`, `06-runtime-view.md`, `08-cross-cutting-concepts.md`; Plugin-Leitfaden und Package-Zielarchitektur werden danach dem Code angepasst.
- Persistenz: Ownership und Imports ändern sich, vorhandene Tabellen, RLS, Daten, Jobstatus und Audit-Historie bleiben. Eine unvermeidbare Schemaänderung ist vor Umsetzung neu zu begründen und separat freizugeben, nicht in diesen Refactor einzuschleusen.
- Kompatibilität: Waste-HTTP-Pfade, Job-IDs und fachliche Antworten bleiben stabil. Die bisherige Waste-Erweiterung des generischen Instanzdetails wird mit allen belegten Verbrauchern auf einen vorhandenen Waste-Endpunkt umgestellt. Ein externer Verbraucher ohne koordinierten Cutover ist ein Blocker; kein stiller API-Bruch.

## Lieferzuschnitt und Abnahme

Die drei Abschnitte in `tasks.md` müssen jeweils build-, test- und reviewbar bleiben; sie erzwingen keinen PR-Stack. Vor jedem Abschnitt sind Ziel, Nicht-Ziele und unmittelbare Verbraucher festzuhalten. Änderungen an derselben Sicherheitsgrenze werden zusammen geprüft, statt neue Schichten für einzelne Reviewbefunde einzuführen.

Die Kriterien A1–A9 und Invarianten stehen in `design.md`. Der implementierende Agent führt die Nachweise selbst aus und liefert Commit-SHA, Befehle/CI-Links und Ergebnisse. Reguläre Abnahme benötigt keine manuelle Klickliste des Nutzers. Tests und automatisierter Browser-Smoke nutzen synthetische Daten; reale Mailzustellung, produktive Datenbankbereitstellung und Deployment sind keine Refactor-Abnahmeschritte.

Status: Vorschlag. Es wurden keine Implementierung und keine fachliche Abnahme durchgeführt.
