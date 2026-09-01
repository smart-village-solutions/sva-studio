## ADDED Requirements

### Requirement: Waste-Management konfiguriert Störungshinweise tenantbezogen

Das System SHALL für jede Waste-Tenant-Konfiguration zwei voneinander unabhängige Optionen für ortsbezogene und globale Störungshinweise bereitstellen und beide Werte außerhalb regulärer Waste-Fraktionen persistieren.

#### Scenario: Bestandsmandant besitzt noch keine Störungskonfiguration

- **GIVEN** die tenantbezogene Waste-Konfiguration wurde vor Einführung der Störungsoptionen angelegt oder enthält keine entsprechenden Werte
- **WHEN** das Studio die Waste-Einstellungen lädt
- **THEN** sind „Hinweise für meine Straße“ und „Hinweise für alle Straßen“ deaktiviert
- **AND** wird keine Option implizit für den Mandanten aktiviert

#### Scenario: Benutzer speichert beide Optionen unabhängig

- **WHEN** ein berechtigter Benutzer genau eine oder beide Störungsoptionen ändert und die Waste-Einstellungen speichert
- **THEN** persistiert das System beide Booleschen Werte explizit in der tenantbezogenen Waste-Konfiguration
- **AND** verändert es keine Zeile in `waste_fractions`
- **AND** zeigt ein erneutes Laden exakt die gespeicherte Kombination

#### Scenario: Benutzer bedient die Störungsoptionen zugänglich

- **WHEN** ein berechtigter Benutzer die Waste-Einstellungen per Tastatur oder assistiver Technologie bedient
- **THEN** besitzt jede Option eine eigene sichtbare übersetzte Beschriftung und einen Hilfetext
- **AND** kann jede Option unabhängig aktiviert und deaktiviert werden
- **AND** wird der Zustand nicht allein durch Farbe vermittelt

### Requirement: `wasteTypes` trennt reguläre Fraktionen von Störungstypen

Das System SHALL das vollständige Mainserver-Static-Content-Dokument `wasteTypes` deterministisch aus aktiven regulären Fraktionen und den zwei explizit aktivierten Störungsoptionen erzeugen. Reguläre Fraktionseinträge und Störungstypen SHALL getrennte typsichere Varianten besitzen.

#### Scenario: Beide Störungsoptionen sind deaktiviert

- **WHEN** der Builder aktive reguläre Fraktionen und die Konfiguration `false`/`false` erhält
- **THEN** enthält `wasteTypes` keinen Schlüssel, der mit `disruption_` beginnt
- **AND** bleibt die bestehende Ausgabe regulärer Fraktionen unverändert

#### Scenario: Nur Hinweise für meine Straße sind aktiviert

- **WHEN** ausschließlich die ortsbezogene Störungsoption aktiviert ist
- **THEN** enthält `wasteTypes` den exakt kleingeschriebenen Schlüssel `disruption_location`
- **AND** besitzt der Eintrag exakt das Label `Meine Straße` und `notification_kind: "disruption"`
- **AND** enthält das Dokument keinen Schlüssel `disruption_all_locations`

#### Scenario: Nur Hinweise für alle Straßen sind aktiviert

- **WHEN** ausschließlich die globale Störungsoption aktiviert ist
- **THEN** enthält `wasteTypes` den exakt kleingeschriebenen Schlüssel `disruption_all_locations`
- **AND** besitzt der Eintrag exakt das Label `Alle Straßen` und `notification_kind: "disruption"`
- **AND** enthält das Dokument keinen Schlüssel `disruption_location`

#### Scenario: Beide Störungsoptionen sind aktiviert

- **WHEN** beide Störungsoptionen aktiviert sind
- **THEN** enthält `wasteTypes` beide exakt kleingeschriebenen Störungsschlüssel mit ihrem jeweiligen Label
- **AND** durchlaufen die reservierten Schlüssel nicht die Großschreibungsnormalisierung regulärer Fraktionskürzel
- **AND** besitzen die Störungseinträge keine regulären Fraktionseigenschaften wie `id`, `short_label`, `color`, `selected_color`, `reminders` oder `container_size`

#### Scenario: Ausgabe und Hash werden wiederholt erzeugt

- **WHEN** der Builder dieselben Fraktionen und dieselbe Störungskonfiguration wiederholt erhält
- **THEN** sortiert und serialisiert er alle Einträge in derselben Reihenfolge
- **AND** erzeugt er denselben SHA-256-Hash
- **AND** zählt `fractionCount` ausschließlich aktive reguläre Fraktionen

#### Scenario: Reservierter Schlüssel kollidiert mit einer Fraktion

- **WHEN** ein normalisiertes aktives Fraktionskürzel einem reservierten Störungsschlüssel entspricht
- **THEN** überschreibt der Builder keinen Eintrag
- **AND** bricht er mit einem deterministischen Kollisionsfehler ab

### Requirement: Gespeicherte Störungsoptionen synchronisieren `wasteTypes` automatisch

Das System SHALL nach erfolgreicher Speicherung der Störungsoptionen denselben asynchronen `waste-management.sync-waste-types`-Job einreihen, der nach regulären Fraktionsmutationen verwendet wird.

#### Scenario: Störungsoptionen wurden erfolgreich gespeichert

- **WHEN** das System beide Werte persistiert und durch erneutes Lesen verifiziert hat
- **THEN** reiht es einen tenantgebundenen `waste-management.sync-waste-types`-Job ein
- **AND** lädt der Job aktive Fraktionen und die gespeicherte Störungskonfiguration
- **AND** schreibt er das daraus vollständig erzeugte Dokument über den bestehenden Mainserver-Static-Content-Pfad
- **AND** übernimmt er keine unbekannten vorhandenen Mainserver-Einträge

#### Scenario: Aktivierte Option wird deaktiviert

- **WHEN** ein Benutzer eine zuvor aktivierte Störungsoption deaktiviert und der nachfolgende Sync erfolgreich endet
- **THEN** fehlt der entsprechende `disruption_*`-Eintrag im vollständig ersetzten Mainserver-Dokument
- **AND** bleiben weiterhin aktivierte Störungstypen und reguläre Fraktionen erhalten

#### Scenario: Sync kann nach erfolgreicher Speicherung nicht gestartet oder beendet werden

- **WHEN** die Optionen lokal erfolgreich gespeichert wurden, aber der Sync-Job nicht eingereiht werden kann oder fehlerhaft endet
- **THEN** bleibt die tenantbezogene Einstellung gespeichert
- **AND** zeigt die UI eine Warnung mit einer erneuten Synchronisierungsaktion
- **AND** behauptet sie keinen erfolgreichen Mainserver-Abgleich
