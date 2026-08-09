## Context

Die Tourenliste unterstützt bereits eine Auswahl über mehrere Zeilen, nutzt sie bislang jedoch nur zum Löschen. Turnusbasierte Touren speichern ihr fachliches Gültigkeitsfenster in `firstDate` und `endDate`. Diese Werte begrenzen die Terminmaterialisierung, sind aber keine eigenständigen Abhol-, Ausweich- oder Standorttermine.

## Goals / Non-Goals

- Goals:
  - Gültigkeitsbeginn und Gültigkeitsende mehrerer ausgewählter Touren in einem Arbeitsschritt ändern.
  - Nicht angefasste Datumsgrenzen und alle übrigen Tourdaten unverändert lassen.
  - Teilergebnisse durch eine serverseitige Transaktion ausschließen.
  - Berechtigung, Mandantenbindung, Validierung und Auditierung am Server durchsetzen.
- Non-Goals:
  - Einzeltermine oder tourbezogene/globale Datumsverschiebungen ändern.
  - Gültigkeitszeiträume von Abholort–Tour-Zuordnungen ändern.
  - Turnus, Fraktionen, Aktivstatus oder Zuordnungen gesammelt bearbeiten.
  - Ein neues Persistenzmodell oder eine allgemeine Bulk-Edit-Plattform einführen.

## Decisions

### Dedizierter atomarer Bulk-Endpunkt

Die UI sendet eine Liste expliziter Tour-IDs und je Datumsgrenze eine Operation `unchanged`, `set` oder `clear`. Der Server lädt alle Touren im aktiven Instanzkontext, prüft Berechtigung und Anwendbarkeit, bildet pro Tour den resultierenden Zeitraum und persistiert alle Änderungen in einer Transaktion.

Ein Fan-out auf den vorhandenen Einzel-Update-Endpunkt wird verworfen, weil Fehler nach einzelnen erfolgreichen Requests inkonsistente Teilstände erzeugen würden. Der Tourenimport bleibt ein Werkzeug für Dateiimporte und wird nicht als interaktive Bulk-Bearbeitung zweckentfremdet.

### Explizite Patch-Semantik

Ein leeres Datumsfeld darf nicht zugleich `unverändert` und `entfernen` bedeuten. Der Dialog bildet deshalb je Grenze drei explizite Zustände ab:

- `unchanged`: vorhandenen Wert beibehalten,
- `set`: den angegebenen ISO-Kalendertag speichern,
- `clear`: vorhandenen Wert entfernen.

Mindestens eine Grenze muss `set` oder `clear` verwenden. Nach dem Zusammenführen muss `Gültig bis` bei jeder Tour am oder nach `Gültig ab` liegen, sofern beide Grenzen vorhanden sind.

### Begrenzung auf turnusbasierte Touren

Die Aktion gilt für feste Turnusse und benutzerdefinierte Abstandspresets, deren Terminmaterialisierung ein Gültigkeitsfenster verwendet. Individuelle und bedarfsabhängige Touren werden in der UI vor dem Speichern als nicht anwendbar benannt. Enthält der Request dennoch eine solche Tour, lehnt der Server den gesamten Request ohne Änderung ab.

### Bestehende Sicherheits- und Auditgrenzen

Der Endpunkt verwendet die bestehende Berechtigung `waste-management.tours.manage`, CSRF-Schutz und den aktiven Instanzkontext. Ein Bulk-Audit-Ereignis enthält Ergebnis, betroffene Anzahl und Batch-Ressource, aber keine vollständigen Tour-Payloads.

## Data Flow

1. Der Benutzer wählt Touren in der bestehenden Tabelle aus.
2. Der Bulk-Dialog sammelt die beiden expliziten Datumsoperationen und zeigt Anzahl sowie nicht anwendbare Touren.
3. Die API-Fassade sendet die expliziten IDs an den neuen Bulk-Endpunkt.
4. Die Auth-Runtime validiert Kontext, IDs, Operationsmodi und ISO-Daten.
5. Der transaktionale Loader sperrt/lädt die betroffenen Touren, validiert die zusammengeführten Zeiträume und aktualisiert ausschließlich `first_date` und `end_date`.
6. Nach Commit werden Audit und sichtbarer Waste-Status aktualisiert; die UI lädt die Übersicht neu und hebt die Auswahl auf.

## Errors and User Feedback

- Ungültige Eingaben oder nicht anwendbare Touren führen zu `400 invalid_request` mit einer verständlichen, lokalisierten UI-Rückmeldung.
- Fehlende Berechtigung führt über den bestehenden Pfad zu `403 forbidden`.
- Nicht vorhandene oder instanzfremde IDs führen ohne Teilergebnis zu `404 not_found` beziehungsweise der bestehenden instanzgebundenen Fehlersemantik.
- Datenbankfehler führen zu Rollback und `503 database_unavailable`.
- Während der Anfrage sind Dialogaktionen deaktiviert; Erfolg leert die Auswahl, Fehler erhält sie für eine Korrektur.

## Testing

- Framework-agnostische Tests für Patch-Zusammenführung, Datumsreihenfolge und Anwendbarkeit.
- Repository-/Loader-Tests für atomaren Erfolg, Rollback, fehlende IDs und unveränderte Fremdfelder.
- Auth-Runtime-Tests für Berechtigung, CSRF, Validierung, Instanzbindung und Auditierung.
- React-Tests für Auswahl, Dialogzustände, nicht anwendbare Touren, Lade- und Fehlerrückmeldung.
- Waste-E2E für eine erfolgreiche gemischte `set`-/`clear`-Änderung sowie einen abgelehnten Request ohne Teilergebnis.

## Risks / Trade-offs

- Eine große Auswahl verlängert die Transaktion. Die API begrenzt deshalb die Anzahl der Tour-IDs pro Request auf einen dokumentierten, getesteten Wert; die UI verhindert größere Requests.
- Parallel geänderte Touren könnten sonst überschrieben werden. Die Bulk-Persistenz ändert ausschließlich die beiden Datumsfelder und hält die betroffenen Zeilen während Validierung und Update gesperrt.

## Migration Plan

Es ist keine Datenmigration erforderlich. Die neue UI-Aktion wird gemeinsam mit dem neuen Endpunkt ausgeliefert; bestehende Einzelbearbeitung und Importpfade bleiben kompatibel.

## Open Questions

Keine für den freigegebenen Umfang.
