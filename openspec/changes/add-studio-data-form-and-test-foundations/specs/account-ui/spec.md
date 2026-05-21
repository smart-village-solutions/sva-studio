## ADDED Requirements

### Requirement: Einheitlicher Formular-Stack fuer Account- und Admin-Views

Das System SHALL fuer Account- und Admin-Views `react-hook-form` in Kombination mit `zod`-basierten Resolvern als verbindlichen Default-Standard fuer Form-State, Feldbindung, Submit-Status und Validierungsabbildung verwenden.

#### Scenario: Profil- oder Admin-Formular wird neu erstellt oder ueberarbeitet

- **WENN** ein Formular in `/account`, `/admin/users`, `/admin/roles` oder verwandten Admin-Views neu implementiert oder grundlegend ueberarbeitet wird
- **DANN** verwendet es `react-hook-form` fuer Form-State und Submit-Orchestrierung
- **UND** verwendet `@hookform/resolvers` mit einem `zod`-Schema fuer die Formularvalidierung
- **UND** fuehrt keine parallele formularweite Eigenorchestrierung fuer dieselben Aufgaben ein

#### Scenario: `/account` faellt unter den Default-Standard ohne Referenzrolle in diesem Change

- **WENN** ein neuer oder grundlegend ueberarbeiteter `/account`-Flow umgesetzt wird
- **DANN** gilt derselbe verbindliche Default-Standard wie fuer Admin-Views
- **UND** folgt daraus nicht automatisch, dass `/account` in diesem Change eine initiale Referenzimplementierung ist

#### Scenario: Formular zeigt Feld- und Gesamtfehler konsistent an

- **WENN** ein Account- oder Admin-Formular Validierungs- oder Submit-Fehler verarbeitet
- **DANN** werden feldspezifische Fehler aus dem Resolver in die Studio-Form-Primitiven gemappt
- **UND** bleibt eine Error-Summary am Formularanfang moeglich
- **UND** bleiben Fokusfuehrung, `aria-invalid` und `aria-describedby` konsistent mit den bestehenden Accessibility-Anforderungen

#### Scenario: Bestehender stabiler Admin-Flow bleibt ausserhalb einer Ueberarbeitung

- **WENN** ein bestehender Account- oder Admin-Flow nur redaktionell oder minimal angepasst wird
- **DANN** erzwingt diese Foundation keine isolierte RHF-Migration
- **UND** bleibt eine spaetere Konsolidierung zulaessig, solange keine zweite konkurrierende Formular-Foundation fuer denselben Flow eingefuehrt wird

#### Scenario: Ausdruecklich zulaessige Ausnahme wird dokumentiert

- **WENN** ein Account- oder Admin-Flow ausschliesslich lokale Logik ohne HTTP-Bezug enthaelt oder technisch begruendet als Spezialfall dokumentiert ist
- **DANN** darf er vom Default-Standard abweichen
- **UND** muss die Ausnahme im Review nachvollziehbar dokumentiert sein
