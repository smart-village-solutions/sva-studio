## ADDED Requirements

### Requirement: Gemeinsame Vorlagenverwaltung zeigt Studio- und Keycloak-Stand

Das Studio SHALL die bestehenden Einladungsvorlagen erhalten und eine getrennte
Bestätigungsvorlage anbieten. Öffnen SHALL den aktuellen Keycloak-Stand mit dem
persistierten Studio-Stand vergleichen. Die UI SHALL Speichern und Synchronisierung
getrennt benennen sowie ausdrücklich Übernahme oder Übertragung anbieten.

#### Scenario: Externe Änderungen übernehmen

- **WHEN** eine berechtigte Person den angezeigten Keycloak-Stand ausdrücklich übernimmt
- **THEN** wird nur ein verlustfrei darstellbarer Stand als neue Studio-Revision gespeichert
- **AND** werden keine Keycloak-Texte geschrieben

#### Scenario: Studio-Stand übertragen

- **WHEN** eine berechtigte Person die Übertragung ausdrücklich bestätigt
- **THEN** wird nur bei unveränderten Vergleichssnapshots übertragen
- **AND** erscheint Synchronisierung erst nach erfolgreichem Readback

#### Scenario: Speicher- oder Synchronisierungsfehler

- **WHEN** die Synchronisierung scheitert oder ein Konflikt erkannt wird
- **THEN** bleiben gespeicherter Studio-Stand und ungespeicherter Entwurf erhalten
- **AND** zeigt die UI die fehlende Synchronisierung beziehungsweise den Konflikt

#### Scenario: Einladungsversand ist blockiert

- **WHEN** eine Einladung wegen Vorlagenabweichung nicht versendet wird
- **THEN** erklärt die Verwaltung den Grund und verlinkt zur Einladungsvorlage samt Keycloak-Abgleich

### Requirement: Allgemeine Bestätigungsvorlage ist im Studio bearbeitbar

Die Templates-Seite SHALL Einladung und Bestätigung jeweils als allgemeine Vorlage
anbieten. Der Bestätigungseditor SHALL die verwendete Quelle und nicht synchronisierte
Instanzen anzeigen. An der Instanz SHALL der Reset ausdrücklich die aktuelle allgemeine
Vorlage wiederherstellen. Ein globaler Reset SHALL eigene Instanz-Overrides erhalten.

#### Scenario: Allgemeine Bestätigung speichern

- **WHEN** ein berechtigter Plattformadministrator den Standard bearbeitet
- **THEN** speichert der Editor mit der zuletzt gelesenen allgemeinen Revision
- **AND** bleiben fehlgeschlagene Abgleiche sichtbar, ohne den gespeicherten Text zu verlieren

#### Scenario: Globaler Revisionskonflikt

- **WHEN** die allgemeine Vorlage zwischenzeitlich geändert wurde
- **THEN** lädt der Editor den aktuellen Vergleichsstand und erhält den lokalen Entwurf
