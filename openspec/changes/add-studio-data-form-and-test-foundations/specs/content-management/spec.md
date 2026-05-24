## ADDED Requirements

### Requirement: Standardisierte Formularmuster fuer Content-Editoren

Das System SHALL fuer host- und pluginseitige Content-Editoren denselben verbindlichen Formular-Stack wie in den uebrigen Studio-Admin-Views verwenden.

#### Scenario: Content-Editor verwendet denselben Formularstandard

- **WENN** ein Content-Editor neu erstellt oder grundlegend ueberarbeitet wird
- **DANN** verwendet er fuer Formularzustand `react-hook-form`
- **UND** bindet `zod`-Validierung ueber `@hookform/resolvers` an dieselbe Formularinstanz an
