## ADDED Requirements

### Requirement: SSF erhält installationsweite Inhalte vor der Mandantenauswahl

Das System SHALL `GET /internal/plugins/ssf/v2/installation-content` für die technische SSF-Service-Identität ohne Tenant-Header bereitstellen. Die Antwort MUST dem Installationsschema entsprechen und ausschließlich installationsweite Inhalte enthalten.

#### Scenario: Service fragt Installationsinhalte vor dem Login ab

- **GIVEN** eine gültige SSF-Service-Identität ohne Tenant-Header
- **WHEN** der Installationsendpunkt abgerufen wird
- **THEN** liefert er Start-/Logintexte, Branding, Legal-Links und Installationsfeedback gemäß V2-Schema
- **AND** enthält die Antwort keine Daten eines Mandanten

### Requirement: SSF erhält tenantgebundene Runtime-Inhalte V2

Das System SHALL `GET /internal/plugins/ssf/v2/runtime-configuration` mit der bestehenden Service-Authentifizierung und geprüfter Tenant-Bindung bereitstellen. Die Antwort MUST dem Runtime-Schema entsprechen; `tenant.id` MUST dem gebundenen Request-Tenant entsprechen.

#### Scenario: Bereiter Tenant erhält die wirksame V2-Antwort

- **GIVEN** Service-Identität, Tenant und SSF-Readiness sind gültig
- **WHEN** SSF die V2-Runtime-Konfiguration abruft
- **THEN** enthält sie Mitarbeitendentexte, angebotene Gastsprachen, Feedbackfragen und wirksame Speicherregel dieses Tenants
- **AND** liefert sie keine Fremdtenantdaten

#### Scenario: Ungültige Konfiguration wird nicht ausgeliefert

- **GIVEN** ein Pflichtfeld fehlt oder die effektive Antwort verletzt das V2-Schema
- **WHEN** einer der V2-Endpunkte abgerufen wird
- **THEN** schlägt der Abruf ohne Teilantwort fehl

### Requirement: V2-Inhalte sind global vorgegeben und einzeln überschreibbar

Das System SHALL installationsweite Inhalte und eine globale Vorlage auf der Systemseite bearbeiten lassen. Für mandantenbezogene Inhalte SHALL die Mandantenseite Overrides pro Feld erlauben; ein zurückgesetzter Wert MUST wieder der aktuellen Vorlage folgen. Die vorhandenen System-/Tenant-Berechtigungen MUST gelten.

#### Scenario: Mandant setzt einen Text auf Vorlage zurück

- **GIVEN** ein Mandant hat einen Text überschrieben
- **WHEN** er für dieses Feld „Systemstandard verwenden“ speichert
- **THEN** wird nur dieser Override entfernt
- **AND** zeigt die Runtime-Antwort den aktuellen Vorlagenwert

### Requirement: Erste UI bearbeitet fünf feste Feedbackfragen ohne Datenverlust

Das System SHALL in der ersten UI ausschließlich die fünf vereinbarten Frage-IDs mit festen Typen, Skalen und Reihenfolge bearbeiten. Es MUST zusätzliche gespeicherte Fragen und andere nicht bearbeitbare V2-Felder bei einem UI-Speichervorgang erhalten.

#### Scenario: Unbekannte Frage ist gespeichert

- **GIVEN** ein Feedbackformular enthält zusätzlich eine von der UI nicht bearbeitete Frage
- **WHEN** ein Administrator einen bekannten Fragetext ändert und speichert
- **THEN** bleibt die zusätzliche Frage in der wirksamen Konfiguration erhalten

### Requirement: Speicherregel und Revision sind konsistent

Das System MUST bei deaktivierter Gesprächsspeicherung `mode=disabled`, `retentionHours=null` und `storageQuestionHtml=null` liefern. Jede V2-Antwort MUST eine Revision ihrer wirksamen Inhalte enthalten; der Speichermodus MUST bei jedem Abruf aktuell gelesen werden.

#### Scenario: Speicherung wird deaktiviert

- **GIVEN** die wirksame Speicherregel eines Mandanten wechselt zu `disabled`
- **WHEN** SSF die V2-Runtime-Konfiguration erneut liest
- **THEN** enthält sie keine aktive Speicherfrage oder Aufbewahrungsdauer
- **AND** unterscheidet sich ihre `configurationRevision` von der vorigen wirksamen Antwort

### Requirement: V1 bleibt während der Umstellung verfügbar

Das System MUST den vorhandenen V1-Endpunkt und seine Antwort unverändert weiter bedienen, bis SSF vollständig auf V2 umgestellt ist.

#### Scenario: V1-Verbraucher liest nach Einführung von V2

- **WHEN** ein berechtigter V1-Verbraucher den V1-Endpunkt abruft
- **THEN** erhält er weiterhin die V1-Vertragsantwort
