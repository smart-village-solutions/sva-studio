## MODIFIED Requirements

### Requirement: Routen können aus mehreren Quellen zu einem gemeinsamen Route-Baum komponiert werden

Das System MUST Routen aus Core- und Plugin-Quellen zu einem gemeinsamen Route-Baum komponieren können.

#### Scenario: Plugin registriert zusätzliche Studio-Routen

- **WENN** ein Plugin über den SDK-Plugin-Vertrag Route-Definitionen bereitstellt
- **DANN** fügt der Studio-Kern diese Routen in den bestehenden Route-Baum ein
- **UND** Core-Routen und Plugin-Routen bleiben gemeinsam navigierbar

## ADDED Requirements

### Requirement: Plugins deklarieren ihre Routen über den SDK-Vertrag

Das System SHALL Plugin-Routen ausschließlich über den öffentlichen SDK-Vertrag entgegennehmen.

#### Scenario: News-Plugin registriert News-Routen

- **WENN** das News-Plugin geladen wird
- **DANN** registriert es mindestens die Routen `/plugins/news`, `/plugins/news/new` und `/plugins/news/$contentId`
- **UND** der Studio-Kern benötigt dafür keine plugin-spezifische Sonderlogik außerhalb des SDK-Vertrags

### Requirement: Der Studio-Kern wendet Guards auf Plugin-Routen an

Das System SHALL Plugin-Routen mit denselben Authentifizierungs- und Autorisierungs-Guards absichern wie fachlich gleichartige Core-Routen. Der Studio-Kern — nicht das Plugin — ist für die Guard-Anwendung verantwortlich.

#### Scenario: News-Listenroute erfordert content.read

- **WENN** ein Benutzer `/plugins/news` aufruft
- **DANN** wendet der Studio-Kern den Content-Guard an und prüft `content.read`
- **UND** bei fehlender Berechtigung wird der Zugriff verweigert

#### Scenario: News-Erstellungsroute erfordert content.create

- **WENN** ein Benutzer `/plugins/news/new` aufruft
- **DANN** wendet der Studio-Kern den Content-Guard an und prüft `content.create`

### Requirement: Fokus-Management bei Plugin-Routenwechseln

Das System SHALL bei Navigation zwischen Plugin-Routen den Fokus gemäß WCAG 2.4.3 und 2.4.7 korrekt verwalten.

#### Scenario: Fokus wird nach Navigation auf Hauptinhalt gesetzt

- **WENN** ein Nutzer zwischen Plugin-Routen navigiert (z. B. von Liste zu Editor)
- **DANN** MUST der Fokus auf das Hauptinhaltselement oder die Seitenüberschrift der Zielseite gesetzt werden
- **UND** der Seitenwechsel MUST für assistive Technologien angekündigt werden (z. B. via `document.title`-Update)
