# Change: Lösch- und Statusmutationen an Content-Plugins delegieren

## Warum

Die gemeinsame Inhaltsliste importiert konkrete Plugin-Clients und entscheidet anhand fester Content-Type-Ketten, wie Löschen und Statuswechsel ausgeführt werden. Damit benötigen neue oder optionale Inhaltstypen Änderungen im Host, obwohl die bestehenden Content-Beiträge bereits die passende Integrationsstelle bilden.

## Was sich ändert

- Bestehende Content-Beiträge erhalten die für die Inhaltsliste benötigten, typisierten Mutationsfähigkeiten und plugin-eigenen Handler.
- Der validierte Snapshot ordnet Fähigkeiten dem Content-Typ und dessen Plugin-Namespace zu und prüft die zugehörigen Action-Anforderungen.
- Die Inhaltsliste orchestriert Auswahl, Berechtigungsanzeige, Bulk-Ergebnis und Aktualisierung generisch; Fachregeln, Statusabbildung und Read-Merge-Write bleiben beim Plugin.
- Event-/POI-Statushandler prüfen vorhandene Detailabweichungen vor dem Update, damit degradierte Reads keine unbeteiligten Felder überschreiben; dies ist die gezielte Datenintegritätskorrektur innerhalb des Refactors.
- Nicht verfügbare oder ungültige Fähigkeiten bieten keine ausführbare Mutation an und schlagen kontrolliert fehl.

## Abgrenzung

Ziel dieses PRs ist, die festen Fachtyp-Dispatches für Löschen und Statuswechsel in der Studio-Inhaltsliste durch validierte Plugin-Beiträge zu ersetzen. Nicht-Ziele sind Änderungen an Upstream-APIs, dem Berechtigungsmodell, fachlichen Statusregeln, serverseitiger Autorisierung oder der gemeinsamen Listen- und Dialog-UX. Betroffen bleiben Plugin-SDK/Registry, die Studio-Inhaltsliste, die bereits registrierenden Content-Plugins samt Tests sowie die unmittelbar betroffene Inhaltsmanagement-Dokumentation.

## Auswirkungen

- Betroffene Spezifikation: `content-management`
- Betroffene Architekturabschnitte: 04 Lösungsstrategie, 05 Bausteinsicht, 06 Laufzeitsicht
- Betroffene Implementierung: `packages/plugin-sdk`, `apps/sva-studio-react/src/routes/content`, `apps/sva-studio-react/src/lib/content-status-mutation.ts` und bestehende Plugin-Pakete
- Keine Datenbankschemaänderung

## Sicherheits- und Datenintegritätsgrenze

Plugin-Handler sind nur der fachliche Ausführungsweg für bereits bestehende Content-Aktionen. Der Host behält die Prüfung der verfügbaren Actions, die serverseitigen Autorisierungsgrenzen und die Listen-Orchestrierung. Statushandler müssen den vorhandenen Datensatz lesen und alle nicht betroffenen Felder beim Schreiben erhalten. Bestehende Validierungs-, Audit- und Guardrail-Diagnostikverträge bleiben erhalten. Event-/POI-Handler verwenden vorhandene Detailclients und brechen vor dem Schreiben ab, wenn gemeldete Datenabweichungen die Erhaltung zurückzuschreibender Felder verhindern. Ein fehlender Beitrag darf nicht auf einen generischen oder fest codierten Plugin-Client zurückfallen.
