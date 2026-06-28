## ADDED Requirements
### Requirement: Waste-Fraktionen besitzen eine direkte Erinnerungs-Konfiguration
Das System SHALL Abfallfraktionen direkt um eine Reminder-Konfiguration erweitern, statt dafür eine separate Settings-Entität zu verwenden.

#### Scenario: Benutzer pflegt Erinnerungen an einer Fraktion
- **WHEN** ein berechtigter Benutzer eine Abfallfraktion erstellt oder bearbeitet
- **THEN** kann er die Anzahl möglicher Erinnerungen direkt im Fraktionsdialog festlegen
- **AND** die Konfiguration wird zusammen mit den übrigen Fraktionsstammdaten persistiert

### Requirement: Waste-Fraktionen persistieren Reminder-Konfigurationen im kanalbezogenen JSON-Schema
Das System SHALL die Reminder-Konfiguration einer Abfallfraktion im fachlich führenden JSON-Schema mit `channels` und optionalen kanalbezogenen `slots` persistieren.

#### Scenario: Fraktion speichert einen kanalbezogenen Reminder-Block
- **WHEN** eine Fraktion mindestens einen aktivierten Reminder-Channel besitzt
- **THEN** persistiert das System für jeden aktivierten Channel einen eigenen Konfigurationsblock
- **AND** jeder Block enthält eine `slots`-Liste mit stabilen `id`, `max_lead_days` und `default_lead_days`
- **AND** deaktivierte Channels werden nicht als eigener Slot-Block persistiert

### Requirement: Die Reminder-Konfiguration erscheint nur im Fraktionsdialog als vierter Block
Das System SHALL die Reminder-Konfiguration im Create-/Edit-Dialog der Abfallfraktion als eigenen vierten Block darstellen und die Fraktionen-Tabelle dafür nicht erweitern.

#### Scenario: Listenansicht bleibt unverändert
- **WHEN** ein Benutzer die Fraktionen-Tabelle in der Listenansicht öffnet
- **THEN** zeigt die Tabelle keine zusätzliche Reminder-Spalte, kein Reminder-Badge und keine gesonderte Tabellenaktion für diese Konfiguration

#### Scenario: Create- oder Edit-Ansicht zeigt den Reminder-Block
- **WHEN** ein Benutzer die Fraktions-Erstellung oder -Bearbeitung öffnet
- **THEN** erscheint die Reminder-Konfiguration als eigener vierter Block innerhalb der Formularansicht
- **AND** der Block bündelt Auswahl der Erinnerungsanzahl, Lead-Day-Dropdowns und globale Kanal-Switches

### Requirement: Waste-Fraktionen steuern Anzahl und maximale Vorlaufzeiten von Erinnerungen
Das System SHALL pro Abfallfraktion die Ausprägungen `none`, `once` oder `twice` sowie pro aktivem Channel je Slot eine maximale Vorlaufzeit von 1 bis 14 Tagen und einen Default-Wert speichern.

#### Scenario: Fraktion erlaubt zwei Erinnerungen
- **WHEN** eine Fraktion auf `twice` konfiguriert wird
- **THEN** speichert das System pro aktivem Channel zwei Slots mit `max_lead_days` im Bereich von 1 bis 14 Tagen
- **AND** jeder Slot enthält zusätzlich einen `default_lead_days`-Wert im Bereich von 1 bis 14 Tagen
- **AND** es erzwingt keine Ordnungsregel zwischen beiden Werten

#### Scenario: Fraktion erlaubt keine Erinnerungen
- **WHEN** eine Fraktion auf `none` konfiguriert wird
- **THEN** behandelt das System alle kanalbezogenen Slot-Listen als nicht gesetzt
- **AND** spätere Nutzeroberflächen dürfen für diese Fraktion keine Erinnerungsauswahl anbieten

### Requirement: Waste-Fraktionen schalten Erinnerungskanäle global frei
Das System SHALL pro Abfallfraktion globale Kanalfreigaben für Push, E-Mail und Kalender speichern.

#### Scenario: Fraktion aktiviert ausgewählte Kanäle
- **WHEN** ein berechtigter Benutzer für eine Fraktion Push und Kalender aktiviert, E-Mail aber deaktiviert lässt
- **THEN** persistiert das System genau diese globale Kanalfreigabe an der Fraktion
- **AND** die Freigabe gilt unabhängig davon, ob später eine oder zwei Erinnerungen genutzt werden
- **AND** nur für Push und Kalender werden kanalbezogene Slot-Blöcke persistiert

### Requirement: Slot-IDs bleiben über Migrationen und Folgeänderungen stabil
Das System SHALL Reminder-Slots mit persistent stabilen IDs führen, damit gespeicherte nutzerbezogene Geräteeinstellungen gültig bleiben.

#### Scenario: Bestandsdaten werden in das neue Modell überführt
- **WHEN** bestehende Fraktionen aus dem flachen Reminder-Modell in das neue JSON-Schema migriert werden
- **THEN** erzeugt das System deterministische Slot-IDs aus Fraktions-ID, Channel und Slotposition
- **AND** diese IDs bleiben bei späteren Reads und Writes unverändert erhalten
- **AND** spätere Clients dürfen sich auf diese IDs als stabilen Persistenzanker verlassen

### Requirement: Host-Fassade normalisiert inkonsistente Reminder-Requests kanonisch
Das System SHALL nicht relevante Reminder-Felder serverseitig auf einen kanonischen Zustand normalisieren.

#### Scenario: Request enthält überzählige Werte für deaktivierte Erinnerungen
- **WHEN** ein Request für eine Fraktion `none` oder `once` setzt, aber zusätzliche kanalbezogene Slots oder Lead-Day-Werte mitschickt
- **THEN** verwirft die Host-Fassade nicht relevante Slot-Einträge
- **AND** deaktiviert bei `none` zusätzlich alle Kanalfreigaben
- **AND** persistiert nur den kanonischen, fachlich gültigen Zustand

### Requirement: Die neue Reminder-Konfiguration wird aus Bestandsfeldern backfilled
Das System SHALL bestehende Reminder-Daten aus dem bisherigen flachen Spaltenmodell in die neue JSONB-Source-of-Truth überführen.

#### Scenario: Flache Reminder-Felder werden in `reminder_config` migriert
- **WHEN** das Waste-Schema mit dem neuen Reminder-Modell initialisiert oder aktualisiert wird
- **THEN** backfilled das System vorhandene Werte aus `reminder_count`, `first_reminder_max_lead_days`, `second_reminder_max_lead_days` und `reminder_channel_*`
- **AND** die kanalbezogenen Slot-Listen werden für aktivierte Channels aus dem bisherigen Ein- oder Zwei-Slot-Modell aufgebaut
- **AND** `default_lead_days` wird für migrierte Bestandswerte deterministisch gesetzt
