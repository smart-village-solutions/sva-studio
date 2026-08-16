## ADDED Requirements

### Requirement: Waste-PDF-Branding verwendet den gemeinsamen Medienpicker

Das System SHALL im Waste-Ausgabe-Tab für die optionale PDF-Branding-Grafik den gemeinsamen Studio-Medienpicker verwenden und ausschließlich eine dauerhafte öffentliche Medien-URL in der Waste-Konfiguration speichern.

#### Scenario: Öffentliches Medium aus der Mediathek auswählen

- **WHEN** ein zur Medienauswahl berechtigter Benutzer `Medium hinzufügen` aktiviert
- **AND** ein öffentliches Bild aus der Mediathek auswählt
- **THEN** zeigt der Ausgabe-Tab eine Vorschau des ausgewählten Bildes
- **AND** speichert beim Speichern der PDF-Inhalte dessen dauerhafte öffentliche URL als Branding-Grafik

#### Scenario: Neues öffentliches Medium hochladen

- **WHEN** ein zusätzlich zu `media.read` und `media.reference.manage` mit `media.create` berechtigter Benutzer ein Bild hochlädt
- **THEN** legt das System das Medium als öffentliches Bild an
- **AND** übernimmt dessen dauerhafte öffentliche URL als Branding-Grafik

#### Scenario: Upload-Berechtigung fehlt

- **WHEN** ein Benutzer Medien auswählen, aber keine Medien erstellen darf
- **THEN** bleibt die Auswahl aus der öffentlichen Mediathek verfügbar
- **AND** bietet der Medienpicker keinen erreichbaren Upload-Pfad an

#### Scenario: Manuelle URL verwenden

- **WHEN** ein berechtigter Benutzer im Medienpicker eine manuelle URL eingibt
- **THEN** akzeptiert das System nur eine persistierbare HTTPS-URL ohne Zugangsdaten oder flüchtige Signaturparameter
- **AND** speichert diese URL ohne Medienreferenz als Branding-Grafik

#### Scenario: Branding-Grafik entfernen

- **WHEN** ein berechtigter Benutzer die aktuell dargestellte Branding-Grafik entfernt und die PDF-Inhalte speichert
- **THEN** entfernt das System die Branding-URL aus der Waste-Konfiguration
- **AND** das öffentliche Waste-PDF wird weiterhin ohne Branding-Grafik erzeugt
