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

### Requirement: Query-basierte Account- und Admin-Dateninvalidierung

Das System SHALL fuer wiederverwendete Account- und Admin-Daten in der React-App query-basierte Cache-Invalidierung statt rein lokaler Reload-Logik verwenden.

#### Scenario: Mutation veraendert sichtbare Daten in mehreren Admin-Views

- **WENN** eine Mutation Profil-, Nutzer-, Rollen- oder aehnliche Admin-Daten veraendert
- **DANN** invalidiert die Anwendung die betroffenen Query-Keys gezielt
- **UND** aktualisieren sich Listen-, Detail- oder Header-Ansichten ueber denselben Cache-Vertrag
- **UND** muessen Komponenten keine voneinander abweichenden Reload-Sonderpfade definieren

#### Scenario: Berechtigungs- oder Session-nahe Daten werden erneuert

- **WENN** der Host Berechtigungen oder Session-nahe Daten nachlaedt oder invalidiert
- **DANN** geschieht dies ueber denselben hostweiten Query-Client
- **UND** bleibt das Invalidierungsverhalten fuer `useAuth()`-nahe und adminrelevante States nachvollziehbar
