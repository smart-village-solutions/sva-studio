## ADDED Requirements

### Requirement: App-Einstellungen sind im App-Zweig der Studio-Seitenleiste erreichbar

Bei den mit #2180 verknüpften App-Einstellungs-Issues bezeichnet **Anwendungen → App** die Zwischenüberschrift **Anwendungen** und das Untermenü **App** in der Studio-Seitenleiste. Der Editor MUST am konkreten Unterpunkt erreichbar sein, den das jeweilige Issue nennt. Das Plugin `application-workspace` betreibt die Kachelseite für Links zu anderen Anwendungen. Die fachliche Zuständigkeit des jeweiligen Plugins gilt unabhängig vom gemeinsamen Ort in der Navigation.

#### Scenario: App-Einstellungen aus dem jeweiligen Menüpunkt öffnen

- **GIVEN** die benötigten Module sind aktiv und ein Mandantennutzer besitzt die erforderlichen Konfigurationsrechte
- **WHEN** der Nutzer in der Studio-Seitenleiste **Anwendungen → App** aufklappt
- **THEN** erreicht er querschnittliche Einstellungen am vorgesehenen Unterpunkt, beispielsweise **Allgemein** oder **Design**
- **AND** erreicht er modulspezifische Einstellungen unter **Module → [Modulname]**, beispielsweise **Module → Abfall**

### Requirement: App-Konfigurationsplugins verwenden den gemeinsamen Host-Vertrag

App-Konfigurationsplugins MUST den gemeinsamen hostgeführten Abgleich in `@sva/sva-mainserver` über öffentliche SDK-/Host-Verträge nutzen. Plugins MUST ihre fachlichen Felder und Validierungen verantworten; sie MUST NOT eigene GraphQL-, Credential-, Retry-, Merge- oder Readback-Verfahren für diese Konfiguration implementieren. Der Host MUST Plugin-Identität, Aktivierung, namespaced Actions und Feldzuständigkeit serverseitig validieren. Ein gemeinsamer Container MUST NOT pauschal sämtliche Nachfahren einem Plugin zuordnen.

#### Scenario: Allgemein und Design teilen ein Dokument

- **GIVEN** beide Plugins deklarieren getrennte Feldzuständigkeiten innerhalb `globalSettings`
- **WHEN** der Host ihre Beiträge verarbeitet
- **THEN** verwenden beide denselben Abgleich und dieselben Ergebniszustände
- **AND** erhält ein Plugin keine Änderungsrechte an den fremden Geschwisterpfaden

#### Scenario: Browser erklärt sich für einen fremden Pfad zuständig

- **WHEN** ein Request einen nicht serverseitig bestätigten Pfad oder ein fremdes Ziel deklariert
- **THEN** lehnt der Host den Vorgang vor dem Write ab
- **AND** ersetzt die Browserangabe keine Registry- oder Berechtigungsprüfung

#### Scenario: Plugin ist deaktiviert oder umgeht seine Fassade

- **WHEN** ein deaktiviertes Plugin direkt die Konfigurations-API aufruft oder Plugincode einen privaten Mainserver-Executor konsumieren will
- **THEN** verhindern die bestehenden Host- beziehungsweise Package-Boundaries den Zugriff
- **AND** erhält das Plugin weder Roh-Credentials noch einen alternativen Writer
