## ADDED Requirements
### Requirement: Waste-Fraktionen besitzen eine direkte Erinnerungs-Konfiguration
Das System SHALL Abfallfraktionen direkt um eine Reminder-Konfiguration erweitern, statt dafür eine separate Settings-Entität zu verwenden.

#### Scenario: Benutzer pflegt Erinnerungen an einer Fraktion
- **WHEN** ein berechtigter Benutzer eine Abfallfraktion erstellt oder bearbeitet
- **THEN** kann er die Anzahl möglicher Erinnerungen direkt im Fraktionsdialog festlegen
- **AND** die Konfiguration wird zusammen mit den übrigen Fraktionsstammdaten persistiert

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
Das System SHALL pro Abfallfraktion die Ausprägungen `none`, `once` oder `twice` sowie pro aktiver Erinnerung eine maximale Vorlaufzeit von 1 bis 14 Tagen speichern.

#### Scenario: Fraktion erlaubt zwei Erinnerungen
- **WHEN** eine Fraktion auf `twice` konfiguriert wird
- **THEN** speichert das System zwei maximale Vorlaufzeiten im Bereich von 1 bis 14 Tagen
- **AND** es erzwingt keine Ordnungsregel zwischen beiden Werten

#### Scenario: Fraktion erlaubt keine Erinnerungen
- **WHEN** eine Fraktion auf `none` konfiguriert wird
- **THEN** behandelt das System beide Vorlaufzeiten als nicht gesetzt
- **AND** spätere Nutzeroberflächen dürfen für diese Fraktion keine Erinnerungsauswahl anbieten

### Requirement: Waste-Fraktionen schalten Erinnerungskanäle global frei
Das System SHALL pro Abfallfraktion globale Kanalfreigaben für Push, E-Mail und Kalender speichern.

#### Scenario: Fraktion aktiviert ausgewählte Kanäle
- **WHEN** ein berechtigter Benutzer für eine Fraktion Push und Kalender aktiviert, E-Mail aber deaktiviert lässt
- **THEN** persistiert das System genau diese globale Kanalfreigabe an der Fraktion
- **AND** die Freigabe gilt unabhängig davon, ob später eine oder zwei Erinnerungen genutzt werden

### Requirement: Host-Fassade normalisiert inkonsistente Reminder-Requests kanonisch
Das System SHALL nicht relevante Reminder-Felder serverseitig auf einen kanonischen Zustand normalisieren.

#### Scenario: Request enthält überzählige Werte für deaktivierte Erinnerungen
- **WHEN** ein Request für eine Fraktion `none` oder `once` setzt, aber zusätzliche Reminder-Werte mitschickt
- **THEN** verwirft die Host-Fassade nicht relevante Lead-Day-Werte
- **AND** deaktiviert bei `none` zusätzlich alle Kanalfreigaben
- **AND** persistiert nur den kanonischen, fachlich gültigen Zustand
