## MODIFIED Requirements

### Requirement: Inhalt ist ein erweiterbares Core-Element

Das System MUST `Inhalt` als kanonisches Core-Element modellieren, das über definierte SDK-Erweiterungspunkte und Plugin-Definitionen für spezielle Datentypen erweitert werden kann.

#### Scenario: SDK erweitert einen speziellen Inhaltstyp

- **WENN** für einen registrierten `contentType` eine SDK- oder Plugin-Erweiterung vorhanden ist
- **DANN** kann diese zusätzliche Validierung, UI-Bereiche, Tabelleninformationen oder Aktionen bereitstellen
- **UND** der Core-Vertrag des Inhalts bleibt unverändert gültig

#### Scenario: Plugin stellt spezialisierten Inhaltstyp News bereit

- **WENN** das News-Plugin im Studio registriert ist
- **DANN** registriert es den `contentType` `news`
- **UND** das System behandelt News weiterhin als regulären Core-Inhalt mit Core-Metadaten, Statusmodell und Historie

### Requirement: Erstellungs- und Bearbeitungsansicht für Inhalte

Das System MUST eine Erstellungs- und eine Bearbeitungsansicht für Inhalte bereitstellen, die für registrierte Inhaltstypen plugin-spezifisch spezialisiert werden kann.

#### Scenario: News-Plugin rendert typspezifische Felder

- **WENN** ein Benutzer einen Inhalt vom Typ `news` anlegt oder bearbeitet
- **DANN** zeigt das System typspezifische News-Felder statt nur eines generischen Roh-JSON-Editors
- **UND** die Speicherung erfolgt weiterhin über das kanonische Content-Modell

## ADDED Requirements

### Requirement: Plugin-spezifische Content-Ansichten können auf Core-Content aufsetzen

Das System SHALL plugin-spezifische Listen- und Editor-Ansichten bereitstellen können, die auf dem generischen Content-Backend aufsetzen.

#### Scenario: News-Liste zeigt nur News-Inhalte

- **WENN** ein Benutzer die News-Plugin-Ansicht öffnet
- **DANN** zeigt das System ausschließlich Inhalte mit `contentType = news`
- **UND** die Ansicht bleibt mit demselben Statusmodell und derselben Historie kompatibel wie die generische Inhaltsverwaltung

#### Scenario: News wird über Core-Content-API gespeichert

- **WENN** ein Benutzer im News-Plugin einen News-Eintrag speichert
- **DANN** verwendet das System dieselbe kanonische Content-API wie für generische Inhalte
- **UND** der gespeicherte Datensatz bleibt im Core-Modell lesbar
