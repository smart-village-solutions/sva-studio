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
