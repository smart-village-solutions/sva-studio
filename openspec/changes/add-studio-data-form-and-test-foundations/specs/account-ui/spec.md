## ADDED Requirements

### Requirement: Einheitlicher Formular-Stack fuer Account- und Admin-Views

Das System SHALL fuer Account- und Admin-Views `react-hook-form` in Kombination mit `zod`-basierten Resolvern als Standard fuer Form-State, Feldbindung, Submit-Status und Validierungsabbildung verwenden.

#### Scenario: Profil- oder Admin-Formular wird neu erstellt oder ueberarbeitet

- **WENN** ein Formular in `/account`, `/admin/users`, `/admin/roles` oder verwandten Admin-Views implementiert oder grundlegend ueberarbeitet wird
- **DANN** verwendet es `react-hook-form` fuer Form-State und Submit-Orchestrierung
- **UND** verwendet `@hookform/resolvers` mit einem `zod`-Schema fuer die Formularvalidierung
- **UND** fuehrt keine parallele formularweite Eigenorchestrierung fuer dieselben Aufgaben ein

#### Scenario: Formular zeigt Feld- und Gesamtfehler konsistent an

- **WENN** ein Account- oder Admin-Formular Validierungs- oder Submit-Fehler verarbeitet
- **DANN** werden feldspezifische Fehler aus dem Resolver in die Studio-Form-Primitiven gemappt
- **UND** bleibt eine Error-Summary am Formularanfang moeglich
- **UND** bleiben Fokusfuehrung, `aria-invalid` und `aria-describedby` konsistent mit den bestehenden Accessibility-Anforderungen
