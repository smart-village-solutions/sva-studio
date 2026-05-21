## ADDED Requirements

### Requirement: Account- und Admin-Views konkretisieren den Formularstandard fuer ihren Bereich

Das System SHALL fuer Account- und Admin-Views den repo-weiten Formularstandard mit `react-hook-form` und `zod`-basierten Resolvern bereichsspezifisch auf Form-State, Feldbindung, Submit-Status, Fehlerdarstellung und Accessibility anwenden.

#### Scenario: Profil- oder Admin-Formular wird neu erstellt oder ueberarbeitet

- **WENN** ein Formular in `/account`, `/admin/users`, `/admin/roles` oder verwandten Admin-Views neu implementiert oder grundlegend ueberarbeitet wird
- **DANN** verwendet es `react-hook-form` fuer Form-State und Submit-Orchestrierung
- **UND** verwendet `@hookform/resolvers` mit einem `zod`-Schema fuer die Formularvalidierung
- **UND** fuehrt keine parallele formularweite Eigenorchestrierung fuer dieselben Aufgaben ein

#### Scenario: `/account` uebernimmt den Formularstandard fuer seinen Bereich

- **WENN** ein neuer oder grundlegend ueberarbeiteter `/account`-Flow umgesetzt wird
- **DANN** verwendet er denselben Formularstandard fuer Form-State, Validierung und Fehlerdarstellung wie andere Account- und Admin-Views
- **UND** bleiben Referenzscope und Rollout-Governance im uebergeordneten Foundation-Change geregelt

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

- **WENN** ein Account- oder Admin-Flow nur eine sehr kleine Interaktion ohne eigenstaendige Formularorchestrierung abbildet oder technisch begruendet als Spezialfall dokumentiert ist
- **DANN** darf er vom Default-Standard abweichen
- **UND** muss die Ausnahme im Review nachvollziehbar dokumentiert sein
