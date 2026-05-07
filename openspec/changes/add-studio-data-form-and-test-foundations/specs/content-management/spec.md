## ADDED Requirements

### Requirement: Standardisierte Query- und Formularmuster fuer Content-Editoren

Das System SHALL fuer host- und pluginseitige Content-Editoren denselben Query- und Formular-Stack wie in den uebrigen Studio-Admin-Views verwenden.

#### Scenario: Content-Editor laedt Detaildaten und Referenzdaten

- **WENN** ein Content-Editor Detaildaten, Lookup-Daten oder Referenzlisten laedt
- **DANN** verwendet er fuer wiederverwendeten clientseitigen Server-State `@tanstack/react-query`
- **UND** verwendet fuer Formularzustand `react-hook-form`
- **UND** bindet `zod`-Validierung ueber `@hookform/resolvers` an dieselbe Formularinstanz an

#### Scenario: Content-Mutation aktualisiert Liste und Detailansicht

- **WENN** ein Inhalt erstellt, bearbeitet oder anderweitig mutiert wird
- **DANN** invalidiert der Host oder das Plugin die betroffenen Listen-, Detail- und verwandten Referenz-Queries ueber den gemeinsamen Query-Client
- **UND** bleibt die Aktualisierung der Oberflaeche nicht an pluginlokale Reload-Sonderpfade gebunden
- **UND** ist der Erfolgspfad fuer Host und Plugins konsistent nachvollziehbar
