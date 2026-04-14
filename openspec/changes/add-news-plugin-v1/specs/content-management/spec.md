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
- **UND** News werden auf dem Mainserver gespeichert; das Studio speichert nur Audit-Log und Berechtigungen

### Requirement: Erstellungs- und Bearbeitungsansicht für Inhalte

Das System MUST eine Erstellungs- und eine Bearbeitungsansicht für Inhalte bereitstellen, die für registrierte Inhaltstypen plugin-spezifisch spezialisiert werden kann.

#### Scenario: News-Plugin rendert typspezifische Felder

- **WENN** ein Benutzer einen Inhalt vom Typ `news` anlegt oder bearbeitet
- **DANN** zeigt das System typspezifische News-Felder statt nur eines generischen Roh-JSON-Editors
- **UND** jedes Eingabefeld besitzt ein programmatisch verknüpftes Label
- **UND** Pflichtfelder sind als `required` gekennzeichnet
- **UND** die Speicherung erfolgt weiterhin über die kanonische Mainserver-Content-API

#### Scenario: Validierungsfehler werden feldbezogen angezeigt

- **WENN** ein Benutzer Pflichtfelder nicht ausfüllt oder ungültige Werte eingibt
- **DANN** zeigt das System feld-spezifische Validierungshinweise vor dem API-Call
- **UND** die Fehlermeldungen sind via `aria-describedby` mit dem jeweiligen Feld verknüpft

### Requirement: Inhalte können gelöscht werden

Das System MUST eine Löschfunktion für Inhalte bereitstellen, die über einen Bestätigungsdialog abgesichert ist.

#### Scenario: News-Eintrag wird nach Bestätigung gelöscht

- **WENN** ein Benutzer einen News-Eintrag löschen möchte
- **DANN** zeigt das System einen Bestätigungsdialog mit dem Titel des betroffenen Eintrags
- **UND** nach Bestätigung wird der Eintrag über die Mainserver-Content-API entfernt
- **UND** das System zeigt eine Erfolgsmeldung

#### Scenario: Lösch-Abbruch lässt den Eintrag unverändert

- **WENN** ein Benutzer den Bestätigungsdialog abbricht
- **DANN** bleibt der News-Eintrag unverändert erhalten

### Requirement: Serverseitige Payload-Validierung für Content-Typen

Das System MUST bei Create und Update das contentType-spezifische Payload-Schema serverseitig anwenden.

#### Scenario: Gültiger News-Payload wird akzeptiert

- **WENN** ein Client einen News-Eintrag mit gültigem Payload erstellt oder aktualisiert
- **DANN** speichert das System den Eintrag
- **UND** `body` wird vor Persistenz serverseitig mit einer Allowlist-basierten HTML-Sanitisierung bereinigt

#### Scenario: Ungültiger News-Payload wird abgelehnt

- **WENN** ein Client einen News-Eintrag mit ungültigem Payload sendet (z. B. fehlendes `teaser`, `externalUrl` mit `javascript:`-Protokoll)
- **DANN** antwortet das System mit HTTP 400
- **UND** der Eintrag wird nicht gespeichert

## ADDED Requirements

### Requirement: Plugin-spezifische Content-Ansichten können auf Core-Content aufsetzen

Das System SHALL plugin-spezifische Listen- und Editor-Ansichten bereitstellen können, die auf dem generischen Mainserver-Content-Backend aufsetzen.

#### Scenario: News-Liste zeigt nur News-Inhalte

- **WENN** ein Benutzer die News-Plugin-Ansicht öffnet
- **DANN** zeigt das System ausschließlich Inhalte mit `contentType = news`
- **UND** die Ansicht bleibt mit demselben Statusmodell und derselben Historie kompatibel wie die generische Inhaltsverwaltung

#### Scenario: Leere News-Liste zeigt Handlungsanleitung

- **WENN** die News-Liste keine Einträge enthält
- **DANN** zeigt das System einen leeren Zustand mit Erklärungstext und einem primären CTA zum Erstellen eines neuen News-Eintrags

#### Scenario: News wird über Mainserver-Content-API gespeichert

- **WENN** ein Benutzer im News-Plugin einen News-Eintrag speichert
- **DANN** verwendet das System die Mainserver-Content-API
- **UND** der gespeicherte Datensatz bleibt im Core-Modell lesbar

#### Scenario: Erfolgsfeedback nach Speichern

- **WENN** ein News-Eintrag erfolgreich erstellt oder aktualisiert wurde
- **DANN** zeigt das System eine Erfolgsmeldung über eine `role="status"` oder `aria-live="polite"` Region
- **UND** der Fokus bleibt am aktuellen Interaktionspunkt

#### Scenario: Fehlerfeedback bei fehlgeschlagenem API-Call

- **WENN** ein API-Call beim Speichern, Laden oder Löschen fehlschlägt
- **DANN** zeigt das System eine verständliche Fehlermeldung mit Wiederholungsmöglichkeit
- **UND** bereits eingegebene Daten bleiben erhalten

### Requirement: Plugin-Content-Ansichten sind barrierefrei gemäß WCAG 2.1 AA

Das System SHALL plugin-spezifische Content-Ansichten gemäß WCAG 2.1 Level AA barrierefrei gestalten, wie in `DEVELOPMENT_RULES.md` §4 und `docs/architecture/08-cross-cutting-concepts.md` vorgeschrieben.

#### Scenario: Alle Elemente sind per Tastatur bedienbar

- **WENN** ein Benutzer die News-Listen- oder Editor-Ansicht ausschließlich per Tastatur bedient
- **DANN** sind alle interaktiven Elemente (Buttons, Links, Formularfelder, Bestätigungsdialoge) erreichbar und bedienbar
- **UND** es entstehen keine Tastaturfallen
