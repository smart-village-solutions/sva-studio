## ADDED Requirements

### Requirement: Waste-Management ändert Gültigkeitszeiträume ausgewählter Touren atomar

Das System SHALL berechtigten Benutzern erlauben, den tourweiten Gültigkeitsbeginn und das tourweite Gültigkeitsende mehrerer ausgewählter turnusbasierter Waste-Touren in einer atomaren Bulk-Aktion zu ändern.

#### Scenario: Benutzer setzt eine Datumsgrenze für mehrere Touren

- **GIVEN** mehrere ausgewählte Touren verwenden einen festen Turnus oder ein benutzerdefiniertes Abstandspreset
- **WHEN** ein Benutzer mit `waste-management.tours.manage` für `Gültig bis` ein Datum setzt und `Gültig ab` unverändert lässt
- **THEN** speichert das System das neue Gültigkeitsende für alle ausgewählten Touren atomar
- **AND** jeder vorhandene Gültigkeitsbeginn bleibt unverändert
- **AND** Einzeltermine, Datumsverschiebungen, Abholort-Zuordnungen und alle übrigen Tourfelder bleiben unverändert

#### Scenario: Benutzer entfernt eine Datumsgrenze explizit

- **GIVEN** die ausgewählten turnusbasierten Touren besitzen ein Gültigkeitsende
- **WHEN** der Benutzer für `Gültig bis` ausdrücklich `entfernen` auswählt
- **THEN** entfernt das System das Gültigkeitsende für alle ausgewählten Touren
- **AND** ein leeres Eingabefeld ohne die Operation `entfernen` löscht keinen vorhandenen Wert

#### Scenario: Ungültiger resultierender Zeitraum verhindert alle Änderungen

- **GIVEN** die gewählten Patch-Operationen würden bei mindestens einer ausgewählten Tour zu einem Gültigkeitsende vor dem Gültigkeitsbeginn führen
- **WHEN** der Benutzer die Bulk-Aktion bestätigt
- **THEN** lehnt das System den gesamten Request mit einem Validierungsfehler ab
- **AND** keine ausgewählte Tour wird geändert

#### Scenario: Nicht anwendbare Tour verhindert stilles Überspringen

- **GIVEN** die Auswahl enthält eine individuelle oder bedarfsabhängige Tour ohne turnusbasiertes Gültigkeitsfenster
- **WHEN** die Bulk-Aktion vorbereitet oder an den Server gesendet wird
- **THEN** weist die Oberfläche die nicht anwendbare Tour verständlich aus
- **AND** der Server lehnt einen dennoch gesendeten gemischten Request vollständig ab
- **AND** keine Tour wird stillschweigend übersprungen oder geändert

#### Scenario: Bulk-Änderung wird nachvollziehbar auditiert

- **WHEN** der Server eine Bulk-Änderung erfolgreich ausführt oder mit einem fachlichen beziehungsweise technischen Fehler beendet
- **THEN** erzeugt das System ein Audit-Ereignis mit Ergebnis, Batch-Ressource, betroffener Anzahl, Akteur und Instanzkontext
- **AND** das Audit-Ereignis enthält keine vollständigen Tour-Payloads
