## ADDED Requirements

### Requirement: Seiten-URL kann den öffentlichen Kalender dauerhaft an eine Region binden

Das System SHALL eine formal gültige und öffentlich auswählbare `regionId` aus der Seiten-URL für die Lebensdauer der geladenen Web-App als unveränderlichen Regionskontext verwenden. Ohne diesen Parameter SHALL der bestehende regionsübergreifende Auswahlfluss unverändert bleiben.

#### Scenario: Regionsgebundene Auswahl beginnt beim Ort

- **WHEN** die öffentliche Web-App mit einer gültigen und bekannten `regionId` geöffnet wird
- **THEN** beginnt die sichtbare Standortauswahl direkt beim Ort
- **AND** bietet sie die Region weder als auswählbaren noch als bearbeitbaren Schritt an
- **AND** begrenzt sie Orte, Straßen und Hausnummern auf den Regionskontext

#### Scenario: Adresswechsel erhält die URL-Region

- **WHEN** eine regionsgebundene Auswahl abgeschlossen ist und die Adresse geändert wird
- **THEN** verwirft die App nur Ort, Straße und Hausnummer
- **AND** beginnt jede weitere Auswahl derselben Seite erneut beim Ort innerhalb derselben Region
- **AND** kann ein gespeicherter Standort die URL-Region nicht überschreiben

#### Scenario: Folgeaktionen verwenden die gebundene Region

- **WHEN** ein Standort innerhalb einer URL-Region vollständig aufgelöst ist
- **THEN** verwenden Kalenderansicht, PDF, iCal und E-Mail-Erinnerungen dieselbe regionsgebundene finale Auswahl

#### Scenario: Ungültige oder unbekannte Region bleibt fail-closed

- **WHEN** die Seiten-URL eine formal ungültige oder nicht öffentlich auswählbare `regionId` enthält
- **THEN** zeigt die App einen verständlichen Fehlerzustand
- **AND** fällt sie nicht auf eine ungefilterte Standortauswahl zurück
