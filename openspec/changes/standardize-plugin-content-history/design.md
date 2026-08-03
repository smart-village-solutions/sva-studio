## Context

Die lokale IAM-Content-Persistenz schreibt bereits unveränderliche Historieneinträge mit Actor, Aktion, Änderungsfeldern, Statusübergang, Zusammenfassung und Snapshot. FAQ, Cockpit Cards, News und Surveys besitzen bereits unterschiedlich ausgeprägte Historienansichten; Events, POI und Generic Items enthalten derzeit Platzhalter. News, Events und POI werden im Mainserver gespeichert, dessen vollständige externe Änderungshistorie nicht Teil des Studio-Vertrags ist. Waste Management besitzt eine eigene fachliche und technische Historie.

Der Change betrifft mehrere Plugins, Host-Runtime, IAM, Plugin-SDK und UI und benötigt deshalb einen gemeinsamen Architekturvertrag statt weiterer pluginlokaler Sonderlösungen.

## Goals / Non-Goals

### Goals

- Jede über das Studio ausgeführte redaktionelle Mutation ist im zugehörigen Editor nachvollziehbar.
- Alle historienpflichtigen Plugins verwenden denselben host-owned Daten-, Rechte- und Darstellungsvertrag.
- Benutzer erkennen eindeutig, welchen Ursprung und welche Abdeckung eine Historie besitzt.
- Neue Plugins können den Historienvertrag nicht versehentlich umgehen.
- Plugin-eigene Fachhistorien dürfen bestehen, wenn sie denselben Plattforminvarianten folgen.

### Non-Goals

- Keine Rekonstruktion von Änderungen, die außerhalb des Studios direkt im Mainserver oder in einem Drittsystem erfolgen.
- Keine Versionierungs-, Vergleichs-, Diff- oder Wiederherstellungsfunktion.
- Keine Anzeige des persistierten `snapshot_json` in der öffentlichen History-API.
- Keine Historien-Tabs für Plugins ohne veränderbare redaktionelle Datensätze.
- Keine neue plugin-eigene Persistenz- oder Autorisierungsstrecke.

## Decisions

### Decision: Der Host besitzt den kanonischen Content-History-Vertrag

Der Host stellt einen typisierten History-Read-Client, die Berechtigungsprüfung, Tenant- und Ownership-Scoping, normalisierte Einträge und gemeinsame UI-Zustände bereit. Plugins liefern höchstens typspezifische Feldbezeichnungen und die Einbettung in ihre Detailseite. Sie schreiben keine Audit- oder History-Datensätze direkt.

Alternativen:

- Pluginlokale Clients und Tabellen fortführen: verworfen, weil sie Rechte-, Fehler- und UX-Drift begünstigen.
- Eine zweite generische History-Datenbank einführen: verworfen, weil `iam.content_history` und der host-owned Auditpfad bereits die passende Grundlage bilden.

### Decision: Mainserver-Historie bedeutet Studio-Mutationshistorie

Vor oder zusammen mit einer erfolgreichen Studio-Mutation eines Mainserver-Inhalts erzeugt der Host einen korrelierbaren History-/Audit-Eintrag. Ein Eintrag darf nur als erfolgreich erscheinen, wenn die fachliche Mutation erfolgreich abgeschlossen wurde; fehlgeschlagene oder abgelehnte Versuche gehören in die Auditspur, nicht als erfolgreiche Änderung in die sichtbare Inhaltshistorie.

Die UI kennzeichnet die Quelle als Studio-Historie und behauptet keine Vollständigkeit für Änderungen außerhalb des Studios. Eine direkte Mainserver-Änderung wird nicht nachträglich erfunden oder einem unbekannten Actor zugeordnet.

### Decision: Historienpflicht wird aus der Contribution abgeleitet und fail-closed validiert

Jede Plugin-Contribution deklariert, ob sie veränderbare redaktionelle Datensätze bereitstellt. Für solche Contributions ist die host-owned History-Capability verpflichtend. Eine Ausnahme benötigt einen stabilen Grundcode und darf nur für Beiträge ohne redaktionelle Mutation oder für explizit fachliche Historien gelten, welche die Plattforminvarianten erfüllen.

Die Build-time-Registry validiert dies vor der UI-Materialisierung. Ein historienpflichtiges Plugin ohne gültiges Binding wird mit einem deterministischen Diagnosecode abgelehnt.

### Decision: Ein gemeinsames barrierefreies Darstellungsmodell

Die Historienansicht besitzt mindestens Lade-, Leer-, Fehler- und Erfolgszustand. Ein Eintrag zeigt Zeitpunkt in der konfigurierten Editor-Zeitzone, lokalisierte Aktion, Actor-Anzeige, Zusammenfassung und lokalisierte geänderte Felder, sofern vorhanden. Tabellen oder Listen benötigen semantische Beschriftungen; Statusmeldungen sind für assistive Technologien wahrnehmbar.

Die History ist schreibgeschützt. Speichern-Aktionen des Editors erscheinen nicht innerhalb des History-Panels.

## Data Flow

1. Ein Benutzer löst eine Content-Mutation über eine hostvalidierte Plugin-Aktion aus.
2. Der Host authentifiziert, löst Instanz und Ownership-Scope auf und autorisiert die fachliche Mutation.
3. Der Host führt die lokale oder Mainserver-basierte Mutation aus.
4. Nach fachlichem Erfolg persistiert beziehungsweise finalisiert der Host den korrelierbaren History- und Audit-Eintrag mit redigierten Metadaten.
5. Der Editor lädt die History über den gemeinsamen Host-Client unter Prüfung von `content.readHistory`.
6. Das Plugin rendert das gemeinsame Darstellungsmodell und ergänzt nur lokalisierte Fachbezeichnungen.

## Existing Plugin Migration

- `plugin-news`, `plugin-events` und `plugin-poi`: Studio-Mutationen gegen den Mainserver korrelierbar erfassen; Herkunft und begrenzte Abdeckung anzeigen.
- `plugin-generic-items`, `plugin-faq` und `plugin-cockpit-cards`: auf den gemeinsamen IAM-History-Client und dieselben Zustände vereinheitlichen.
- `plugin-surveys`: bestehende History-Anbindung gegen den gemeinsamen Vertrag prüfen und vereinheitlichen.
- `plugin-waste-management`: fachliche und technische History gegen Rechte-, Scope-, Herkunfts- und UX-Invarianten prüfen; keine erzwungene Umstellung auf `iam.content_history`, wenn der fachliche Vertrag dies nicht trägt.
- `plugin-categories`, `plugin-sdk` und weitere Beiträge ohne eigene redaktionelle Mutation: explizit als nicht historienpflichtig klassifizieren.

Die Implementierung muss vor Änderungen die tatsächlichen aktiven Contributions aus dem kanonischen Plugin-Snapshot ermitteln; die Paketliste allein ist nicht die führende Wahrheit.

## Security and Privacy

- History-Lesen bleibt durch `content.readHistory` und denselben Instance-/Ownership-Scope wie der Inhalt geschützt.
- Actor-Anzeigen und gespeicherte Metadaten dürfen keine zusätzlichen Klartext-PII, Tokens, Secrets oder rohe Provider-Antworten einführen.
- Fehlgeschlagene und verweigerte Mutationen bleiben auditierbar, werden aber nicht als erfolgreiche Inhaltsänderung dargestellt.
- Nicht auflösbare oder gelöschte Accounts verwenden den bestehenden referenzwahrenden Actor-Fallback.

## Risks / Trade-offs

- Eine Studio-only-Historie kann mit einer vollständigen Mainserver-Historie verwechselt werden. Mitigation: Herkunft und Abdeckungsgrenze werden in UI, API-Metadaten und Dokumentation explizit benannt.
- History-Persistenz und Mainserver-Mutation können nicht zwingend in derselben Datenbanktransaktion laufen. Mitigation: korrelierbare Zustände, idempotente Finalisierung und Tests für Erfolg, Fehler und Wiederholung; keine falschen Erfolgseinträge.
- Plugin-spezifische Feldnamen können inkonsistent erscheinen. Mitigation: stabile Feld-IDs im Host-Vertrag und ausschließlich lokalisierte Anzeige-Mappings im Plugin.
- Eine harte Registry-Validierung kann bestehende Plugins blockieren. Mitigation: vollständige Bestandsmigration im selben Change und explizite, begründete Klassifikation nicht betroffener Plugins.

## Migration Plan

1. Aktive Plugin-Contributions und ihre Mutations-/History-Pfade inventarisieren.
2. Gemeinsamen Contract, Client, Normalisierung und Registry-Validierung ergänzen.
3. Lokale IAM-Plugins auf den gemeinsamen Pfad migrieren.
4. Mainserver-Plugins an die Studio-Mutationshistorie anbinden.
5. Waste und nicht historienpflichtige Plugins explizit klassifizieren.
6. Plugin-Scaffolding, Dokumentation und blockierende Contract-Tests aktualisieren.
7. Bestehende Daten bleiben unverändert; neue Mainserver-Historie beginnt mit den nach Deployment über das Studio ausgeführten Mutationen.

Rollback entfernt UI-Bindings und Registry-Pflicht nur gemeinsam. Bereits erzeugte Audit- und History-Einträge werden nicht gelöscht.

## Open Questions

- Keine. Die Historie Mainserver-basierter Inhalte umfasst verbindlich nur Studio-seitige Änderungen.
