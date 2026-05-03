# Change: Waste-Management-Plugin fuer SVA Studio integrieren

## Why

Das Studio hat heute kein Fachmodul fuer den vollstaendigen kommunalen Abfallkalender. Im bestehenden `Newcms` existiert bereits ein fachlich brauchbarer MVP fuer Stammdaten, Touren, Terminverschiebungen und Data-Tools, aber dessen Architektur passt nicht zu den Plugin-, Routing-, IAM- und Host-Grenzen des Studios.

Das Studio benoetigt deshalb einen eigenstaendigen Change, der das Waste-Management entlang der bestehenden Zielarchitektur neu aufsetzt: als freies Fachplugin mit hostgefuehrter Server-Fassade, instanzgebundenem Datenmodell, feingranularem Modul-IAM und auditierbaren Hochrisiko-Operationen. Ohne diesen Change wuerde ein direkter Port aus `Newcms` die Plugin-Boundary, die Studio-Serververantwortung und die Instanzisolation unterlaufen.

## What Changes

- Neues Fachplugin `@sva/plugin-waste-management` mit freier Route `/plugins/waste-management`
- Neue Capability `waste-management` fuer die vollstaendige Admin-Oberflaeche des Abfallkalenders
- Hostgefuehrte Server-Fassade unter `/api/v1/waste-management/*` fuer CRUD- und Spezialoperationen
- Genau eine instanzbezogene Waste-Fachdatenbank pro Studio-Instanz mit serverseitig aufgeloester Verbindung und im Studio-Postgres hinterlegter Datenquellenkonfiguration
- Direkter serverseitiger Zugriff auf die bestehende `waste_*`-Tabellenfamilie als Migrationsbasis innerhalb der jeweiligen Waste-Fachdatenbank, ohne Abhaengigkeit auf `Newcms`-Edge-Functions
- Detaillierte Portierungsregeln, die `Newcms` als UX- und Fachreferenz zulaessig machen, aber einen verdeckten Architekturport in Plugin, Runtime, IAM und Persistenz ausschliessen
- Gezielte Schema-Weiterentwicklung innerhalb der Waste-Fachdatenbank inklusive dokumentiertem Migrationspfad und pluginangebotenen Update-Migrationen
- Fokus auf Betrieb als fuehrendes Fachsystem; sekundaere Fremdsystem-Synchronisation bleibt nur architektonisch offen
- Erweiterte Terminlogik fuer manuelle Einzelverschiebungen und konsistente Folgeeffekte auf wiederkehrende Tourtermine
- Feiertags- und Abweichungslogik als ausdruecklicher Fachbestandteil des Terminmodells
- Adresshierarchie fuer Ort, Strasse und Hausnummer als fachlicher Kernvertrag fuer Zuordnung und spaetere Ausspielkanaele
- Mehrsprachige, farbcodierte Fachstammdaten fuer Abfallarten und Tourdarstellungen
- Feingranulares Modul-IAM fuer Lesen, Stammdaten, Touren/Zuordnungen, Scheduling, Import, Seed, Reset und Einstellungen
- Audit-Integration fuer alle Mutationen, insbesondere CSV-Import, Seed und Reset
- Klare Trennung zwischen zentralem Studio-Postgres fuer Rollen, Rechte, Audits und Modulkonfigurationen einerseits und instanzbezogenen Waste-Fachdaten andererseits
- Keine IAM-, Rollen-, Rechte- oder Audit-Primärdaten des Studios in der externen Waste-/Supabase-Datenbank
- Waste-spezifische Migrations-, Job- und sonstige plugininterne Hilfsdaten duerfen in der externen Waste-/Supabase-Datenbank liegen
- Das Studio-Postgres darf zusaetzlich zentrale Status-, Monitoring- und fortlaufende Historienmetadaten zur externen Waste-Datenquelle fuehren
- Die generische Studio-Job-Faehigkeit ist zentral persistent im Studio-Postgres und verwendet initial mindestens die Stati `queued`, `running`, `succeeded`, `failed`, `cancelled`
- Das Studio stellt zusaetzlich eine generische Import-Faehigkeit fuer CSV, Excel sowie schema-nahe JSON- und XML-Quellen bereit, die ueber pluginseitig definierte Importprofile genutzt wird
- Die generischen Studio-Faehigkeiten fuer Jobs und strukturierte Importe werden in diesem Change bereits als tragfaehige Plattformbasis fuer weitere Plugins aufgebaut und nicht nur als schmale Waste-Vorbereitung
- Der `plugin-sdk` wird dabei so erweitert, dass Plugins explizit Jobtypen und Importprofile registrieren koennen, waehrend das Studio Runtime, UI und Orchestrierung zentral bereitstellt
- Importprofile beschreiben je Plugin und Importtyp mindestens Zielfelder, Pflichtfelder, erlaubte Quellformate, Mapping-Regeln, Validierungen sowie eine kanonische Vorlage mit Beispieldatei oder Beispielspalten
- Die erste Studio-Import-Oberflaeche wird als mehrstufiger Wizard mit Quellwahl, Profilwahl, Mapping-Pruefung, Validierungsvorschau, Job-Start und Ergebnisansicht modelliert
- Das Studio darf fuer solche Importprofile automatische Mapping-Vorschlaege fuer Quellspalten erzeugen; Benutzer muessen diese Vorschlaege pruefen und manuell korrigieren koennen
- Das Studio darf einfache gespeicherte Mapping-Vorlagen pro Instanz und Importprofil vorhalten, damit wiederkehrende Importe nicht jedes Mal neu gemappt werden muessen
- Die automatische Mapping-Strecke wird so geschnitten, dass spaeter eine externe KI-basierte Vorschlagslogik als austauschbare Integrationsstelle ergaenzt werden kann, ohne den generischen Importvertrag neu zu zerlegen
- Automatische Retry-Logik ist nicht Teil der ersten generischen Studio-Job-Faehigkeit
- Fehlgeschlagene oder abgebrochene Jobs werden in der ersten Ausbaustufe nicht neu gestartet, sondern bei Bedarf als neue Jobs erneut angestossen
- `cancelled` ist in der ersten Ausbaustufe Teil des Statusmodells, ohne dass fuer alle Jobtypen bereits eine aktive Cancel-Mechanik verpflichtend sein muss
- Die generische Studio-Job-Faehigkeit soll in der ersten Ausbaustufe auch UI-seitig als pluginuebergreifendes Studio-Konzept sichtbar werden
- Die erste pluginuebergreifende Job-Sicht wird unter dem bestehenden Sidebar-Punkt `Monitoring` verankert; ein spaeteres Desktop-Widget ist nicht Teil dieses Changes
- Die erste `Monitoring`-Sicht bleibt eine technische und zunaechst temporaere Admin-Sicht fuer Jobs, Datenquellenstatus und technische Ereignishistorie; eine breitere Betriebsoberflaeche ist nicht Teil dieses Changes
- Wiederverwendbare Interaktionsmuster wie Import-Dialog-Flow, Job-/Monitoring-Darstellung, Bulk-Actions, Hochrisiko-Confirm und technische Statusanzeigen werden als allgemeine Studio-UI-Bausteine geschnitten
- Waste-spezifische Screens, Jahreskalender, Touren-, Ausweichtermin-, Abholort- und Fraktionsdialoge bleiben hingegen fachliche Bestandteile des Plugins und wandern nicht in die allgemeine Plugin-UI-Library
- Die erste Pflichtmenge dieser zentralen Historie umfasst mindestens Connection-Checks, Datenquellen-Rekonfigurationen sowie Start/Erfolg/Fehler von Migration, Import, Seed und Reset
- Diese erste zentrale Historie bleibt zunaechst auf technische Ereignisse beschraenkt
- Fehlgeschlagene Connection-Checks muessen zusaetzlich sofort einen sichtbaren aktuellen Status an der zentralen Instanz-/Plugin-Konfiguration setzen
- Erfolgreiche Connection-Checks heben diesen sichtbaren Stoerungsstatus sofort wieder auf; der Verlauf bleibt ueber die Historie nachvollziehbar
- Beim Laden der Settings-Seite darf automatisch ein expliziter Connection-Check laufen; ausserhalb davon duerfen echte erfolgreiche oder fehlgeschlagene DB-Zugriffe den sichtbaren Status implizit mitaktualisieren
- Periodische Hintergrund-Checks sind nicht Teil dieses Changes
- Fuer den aktuellen sichtbaren Status gilt die einfachste Regel: jeder technisch erfolgreiche echte DB-Zugriff darf den Status sofort auf `ok` setzen
- Asynchrone Data-Tools fuer CSV-Import, Seed, Reset und Waste-Schema-Migrationen auf Basis einer generischen Studio-Job-Faehigkeit mit nachvollziehbarem Statusmodell
- Waste nutzt fuer `geografie-abholorte`, `touren` und `ausweichtermine` die generische Studio-Import-Faehigkeit mit jeweils eigenem Importprofil und eigener Validierung
- Search-Param- und Routing-Vertrag fuer tab-lastige Fachnavigation, Filter und Deep-Links
- Rechtegesteuerte UI-Sichtbarkeit fuer schreibende und gefaehrliche Aktionen
- Architektur- und Arc42-Fortschreibung fuer Plugin-Boundary, Server-Fassade, Instanzisolierung und Auditverhalten

## Non-Goals

- Keine oeffentlichen Buerger-Read-APIs fuer Abfalltermine in diesem Change
- Keine Export- oder Feed-Schnittstellen wie iCal, JSON-Feeds oder PDF-Exporte in diesem Change
- Keine produktive Push-Benachrichtigungs-Ausspielung in diesem Change
- Keine konkrete Fremdsystem-Synchronisation oder Konfliktlogik fuer sekundaere Fuehrung in diesem Change
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
