## ADDED Requirements
### Requirement: Sichtbarer Runtime-Health-Indikator in der Shell
Die Layout-Shell SHALL auf allen Studioseiten am unteren Ende eine dauerhaft sichtbare Runtime-Health-Anzeige für zentrale Plattformabhängigkeiten bereitstellen.

#### Scenario: Health-Indikator wird auf regulären Studioseiten angezeigt
- **WHEN** ein Benutzer eine reguläre Studioseite öffnet
- **THEN** zeigt die Shell am Ende der Seite eine kompakte Health-Anzeige
- **AND** die Anzeige ist nicht auf Admin-Unterseiten beschränkt
- **AND** die Anzeige ist in allen Environments sichtbar

#### Scenario: Mehrere Dienstzustände werden verständlich dargestellt
- **WHEN** der Runtime-Healthcheck Zustände für Datenbank, Redis, Keycloak oder weitere relevante Dienste liefert
- **THEN** zeigt die Shell jeden Dienst mit Label und Statuszustand an
- **AND** Zustände wie `ready`, `degraded`, `not_ready` und `unknown` sind visuell unterscheidbar

#### Scenario: Health-Abfrage schlägt fehl
- **WHEN** die Shell den Runtime-Health-Status nicht laden kann
- **THEN** bleibt die restliche Shell nutzbar
- **AND** die Health-Anzeige wechselt in einen sichtbaren Fehler- oder `unknown`-Zustand
- **AND** der Benutzer erhält keinen leeren oder irreführend grünen Zustand

#### Scenario: Anzeige bleibt zugänglich und mobil nutzbar
- **WHEN** die Shell auf kleinen oder großen Viewports gerendert wird
- **THEN** bleibt die Health-Anzeige lesbar und erreichbar
- **AND** Screenreader können Dienstname und Status semantisch erfassen
- **AND** die Anzeige verursacht kein horizontales Layout-Breaking
