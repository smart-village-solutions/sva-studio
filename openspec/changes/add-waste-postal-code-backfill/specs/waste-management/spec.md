## ADDED Requirements

### Requirement: Waste-Management ergänzt fehlende Stadt-Postleitzahlen kontrolliert

Das System MUST berechtigten Administratoren erlauben, fehlende Postleitzahlen von Waste-Städten als kontrollierte Systemfunktion automatisch zu ergänzen.

#### Scenario: Administrator startet die Anreicherung

- **WHEN** ein Benutzer mit `waste-management.master-data.manage` die Aktion unter „Datentools → Erweiterte Systemfunktionen“ startet
- **THEN** führt das System die Anreicherung als mandantenisolierten Hintergrundjob aus
- **AND** zeigt das Studio den laufenden Prozess und sein aggregiertes Ergebnis nachvollziehbar an

#### Scenario: Stadt besitzt einen plausiblen Treffer

- **WHEN** eine Stadt noch keine Postleitzahl besitzt und die hostgeführte Ermittlung eine konsistente deutsche fünfstellige Postleitzahl mit passendem Ortsbezug liefert
- **THEN** ergänzt das System ausschließlich die Postleitzahl dieser Stadt
- **AND** bleiben Name, Region und alle übrigen Fachdaten unverändert

#### Scenario: Treffer bleibt unsicher

- **WHEN** die Ermittlung keinen Treffer, eine ungültige Postleitzahl, einen abweichenden Orts- oder Länderkontext oder widersprüchliche Postleitzahlen liefert
- **THEN** verändert das System die Stadt nicht
- **AND** zählt das Job-Ergebnis den offenen oder mehrdeutigen Fall nachvollziehbar

#### Scenario: Vorhandene Postleitzahl wird geschützt

- **WHEN** eine Stadt bereits vor dem Lauf oder durch eine parallele Pflege eine Postleitzahl besitzt
- **THEN** überschreibt der Anreicherungsjob diesen Wert nicht
- **AND** ein wiederholter Lauf bleibt idempotent

#### Scenario: Geocoding ist nicht verfügbar

- **WHEN** die tenantbezogene Geocoding-Konfiguration fehlt, deaktiviert ist oder der Provider kontrolliert fehlschlägt
- **THEN** erfindet oder persistiert das System keine Postleitzahl
- **AND** der Job endet mit einem nachvollziehbaren Fehler- oder Teilergebnis ohne Secrets oder vollständige Adressanfragen offenzulegen

### Requirement: Waste-PLZ-Anreicherung respektiert Providergrenzen

Das System MUST die automatische Waste-PLZ-Anreicherung innerhalb der konfigurierten Geocoding-Grenzen ausführen.

#### Scenario: Viele Städte benötigen eine Ermittlung

- **WHEN** der Job mehrere Städte über den externen Provider prüft
- **THEN** verarbeitet er die Anfragen mit begrenzter Parallelität und entsprechend dem konfigurierten Minutenlimit
- **AND** meldet er den Fortschritt über den zentralen Jobvertrag statt über eine Browser-Schleife

#### Scenario: Das Anfragebudget ist ausgeschöpft

- **WHEN** die Anreicherung das für den Provider konfigurierte Anfragebudget erreicht
- **THEN** beendet sie weitere Provideranfragen kontrolliert und behält bereits bestätigte Aktualisierungen
- **AND** weist das Ergebnis den Verbrauch und die noch nicht verarbeiteten Städte transparent aus
