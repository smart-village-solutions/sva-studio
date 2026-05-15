## ADDED Requirements

### Requirement: Instanzen fuehren einen expliziten zugewiesenen Modulsatz

Das System SHALL pro Instanz einen expliziten Satz zugewiesener Module persistieren und diesen Satz als kanonische Betriebsquelle fuer modulbezogene Freigaben und IAM-Basis verwenden. Die Zuweisung erfolgt ausschliesslich durch den Studio-Admin.

#### Scenario: Bestehende Instanz startet ohne impliziten Modulsatz

- **GIVEN** eine bestehende Instanz wird nach Einfuehrung des Modulvertrags gelesen
- **WHEN** fuer diese Instanz noch keine explizite Modulzuordnung durch den Studio-Admin gepflegt wurde
- **THEN** behandelt das System ihren Modulsatz als leer
- **AND** aktiviert keine Module implizit aus globaler Plugin-Registrierung, `featureFlags` oder Integrationsdaten

### Requirement: Modulzuweisung seedet die IAM-Basis in derselben Operation

Das System SHALL die Zuweisung eines Moduls zu einer Instanz als Studio-Admin-Mutation behandeln, die die fachliche Freigabe und das IAM-Baseline-Seeding fuer `Core + zugewiesene Module` in derselben Operation ausfuehrt.

#### Scenario: Modul wird einer Instanz zugewiesen

- **GIVEN** ein global bekanntes Modul ist einer Instanz noch nicht zugewiesen
- **WHEN** der Studio-Admin das Modul der Instanz zuweist
- **THEN** persistiert das System die Modulzuordnung fuer diese Instanz
- **AND** legt es fehlende modulbezogene Permissions idempotent an oder aktualisiert sie
- **AND** bringt es kanonische Systemrollen und `role_permissions` fuer `Core + zugewiesene Module` auf Sollstand
- **AND** ist das Modul nach erfolgreichem Abschluss fachlich sofort nutzbar

#### Scenario: Zuweisung eines nicht global registrierten Moduls wird abgelehnt

- **GIVEN** eine gueltige Instanz existiert
- **WHEN** der Studio-Admin ein Modul zuweist, das nicht in der globalen Plugin-Registrierung bekannt ist
- **THEN** lehnt das System die Operation mit einem Validation-Fehler ab
- **AND** wird keine Modulzuordnung persistiert
- **AND** wird kein IAM-Seeding ausgefuehrt

### Requirement: Instanz-Anlage-Flow enthaelt einen sichtbaren Abschnitt fuer den initialen Admin-Bootstrap

Das System SHALL im Instanz-Anlage-Flow nach erfolgreichem Instanz-Create einen eigenen sichtbaren Abschnitt fuer den initialen Admin-Bootstrap der Instanz bereitstellen. Der Abschnitt folgt dem Navigationsmodell der frueheren Flow-Abschnitte, ist aber erst nach erfolgreichem Create aktiv sinnvoll nutzbar.

#### Scenario: Abschnitt wird erst nach erfolgreichem Create aktiv

- **GIVEN** der Studio-Admin befindet sich im Instanz-Anlage-Flow
- **WHEN** die Instanz noch nicht erfolgreich angelegt wurde
- **THEN** ist der Abschnitt fuer den initialen Admin-Bootstrap sichtbar, aber noch nicht aktiv ausfuehrbar
- **AND** bleibt die eigentliche Bootstrap-Aktion blockiert

#### Scenario: Bootstrap-Abschnitt wird nach Create nutzbar

- **GIVEN** die Instanz wurde erfolgreich angelegt
- **WHEN** der Studio-Admin den naechsten Abschnitt des Flows aufruft
- **THEN** kann er dort optional Module fuer die Instanz auswaehlen
- **AND** kann er den initialen Admin-Bootstrap ueber genau einen Sammel-Button ausloesen

### Requirement: Initialer Admin-Bootstrap funktioniert auch ohne Modulauswahl

Das System SHALL den initialen Admin-Bootstrap auch dann zulaessen, wenn keine Module ausgewaehlt wurden. In diesem Fall muss mindestens die Core-bezogene Admin-Grundstruktur angelegt werden.

#### Scenario: Bootstrap ohne Module

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **AND** der Studio-Admin hat im Bootstrap-Abschnitt keine Module ausgewaehlt
- **WHEN** er den Sammel-Button ausloest
- **THEN** legt das System mindestens die Gruppe `Admins` und die Rolle `Core Admin` an
- **AND** ordnet es keine zusaetzlichen Module zu
- **AND** gilt der Bootstrap-Lauf bei Erfolg als abgeschlossen

### Requirement: Modulauswahl des Bootstrap-Abschnitts ist echte Instanzaktivierung

Das System SHALL die Modulauswahl im Bootstrap-Abschnitt als echte offizielle Instanz-Modulzuordnung behandeln und nicht nur als Hilfsparameter fuer die Erzeugung initialer Rollen.

#### Scenario: Ausgewaehlte Module werden der Instanz offiziell zugeordnet

- **GIVEN** die Instanz wurde erfolgreich angelegt
- **AND** der Studio-Admin waehlt im Bootstrap-Abschnitt ein oder mehrere Module aus
- **WHEN** er den Sammel-Button ausloest
- **THEN** werden diese Module der Instanz offiziell zugeordnet
- **AND** sind sie nach erfolgreicher Zuordnung fachlich als aktiv behandelt
- **AND** basiert die weitere Rollen- und Gruppeninitialisierung auf genau diesem offiziellen Modulsatz

### Requirement: Instanz gilt erst nach erfolgreichem Bootstrap-Lauf als fertig

Das System SHALL eine im neuen Flow angelegte Instanz erst dann als fachlich `fertig` behandeln, wenn der initiale Admin-Bootstrap mindestens einmal erfolgreich ausgefuehrt wurde.

#### Scenario: Create allein macht die Instanz noch nicht fertig

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **AND** der Bootstrap-Abschnitt wurde noch nicht erfolgreich abgeschlossen
- **WHEN** der Studio-Admin den Flow oder den Instanzstatus betrachtet
- **THEN** behandelt das System die Instanz noch nicht als `fertig`
- **AND** weist der Flow auf den noch ausstehenden Bootstrap-Schritt hin

#### Scenario: Erfolgreicher Bootstrap markiert den Flow als fertig

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **WHEN** der Sammel-Button fuer den initialen Admin-Bootstrap mindestens einmal erfolgreich durchlaeuft
- **THEN** behandelt das System die Instanz im neuen Flow als `fertig`
- **AND** darf der Abschlussstatus unabhaengig davon erreicht werden, ob Module ausgewaehlt wurden oder nicht

### Requirement: Bootstrap-Aktion darf bereits erfolgreiche Modulzuordnung bei Folgefehlern erhalten

Das System SHALL die Bootstrap-Aktion aus Usersicht als einen zusammenhaengenden Schritt anbieten, darf aber bereits erfolgreich persistierte Modulzuordnungen bei spaeteren Fehlern im Rollen- oder Gruppenaufbau erhalten.

#### Scenario: Modulzuordnung bleibt trotz nachgelagertem Rollenfehler bestehen

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **AND** der Studio-Admin hat im Bootstrap-Abschnitt Module ausgewaehlt
- **WHEN** der Sammel-Button die Modulzuordnung erfolgreich persistiert
- **AND** ein nachgelagerter Schritt beim Anlegen, Ueberschreiben oder Verknuepfen von Rollen und Gruppen fehlschlaegt
- **THEN** duerfen die bereits erfolgreich zugeordneten Module bestehen bleiben
- **AND** meldet das System den Bootstrap-Lauf insgesamt als unvollstaendig oder fehlgeschlagen zurueck
- **AND** bietet es einen spaeteren erneuten Bootstrap-Versuch an

#### Scenario: IAM-Seeding schlaegt waehrend Modulzuweisung fehl

- **GIVEN** ein global bekanntes Modul ist einer Instanz noch nicht zugewiesen
- **WHEN** der Studio-Admin das Modul zuweist
- **AND** der IAM-Baseline-Seeding-Schritt schlaegt mit einem Fehler fehl
- **THEN** rollt das System die Modulzuordnung fuer diese Instanz zurueck
- **AND** persistiert keine Teilzuordnung
- **AND** wird der Fehler dem Studio-Admin mit Diagnosekontext zurueckgemeldet
- **AND** startet ein erneuter Zuweisungsversuch die Operation idempotent von vorn

### Requirement: Modulentzug entfernt modulbezogene IAM-Basis hart

Das System SHALL den Entzug eines Moduls von einer Instanz als Studio-Admin-Mutation behandeln, die modulbezogene Rechte und Rollenzuordnungen hart entfernt. Die Mutation erfordert ein explizites `confirmation`-Feld im Request; der Server lehnt den Entzug ohne dieses Feld mit einem eigenen Fehlercode ab.

#### Scenario: Modul wird einer Instanz entzogen

- **GIVEN** ein Modul ist einer Instanz zugewiesen
- **WHEN** der Studio-Admin den Entzug mit expliziter Bestaetigung (`confirmation: "REVOKE"`) ausfuehrt
- **THEN** entfernt das System die Modulzuordnung fuer diese Instanz
- **AND** entfernt es die modulbezogenen Permissions hart
- **AND** entfernt es modulbezogene `role_permissions` und systemische Rollenerweiterungen hart
- **AND** bleibt die Core-IAM-Basis der Instanz unveraendert erhalten

#### Scenario: Gleichzeitige Zuweisung und Entzug desselben Moduls

- **GIVEN** ein Modul ist einer Instanz zugewiesen
- **WHEN** zwei nebenlaeuifge Operationen gleichzeitig ausgefuehrt werden: Operation A entzieht das Modul, Operation B weist es erneut zu
- **THEN** laesst das System genau eine Operation atomar gewinnen
- **AND** der finale Modulsatz der Instanz ist entweder vollstaendig zugewiesen oder vollstaendig entzogen – kein Zwischenzustand wird persistiert
- **AND** die unterlegene Operation schlaegt mit einem deterministischen Conflict-Fehler fehl

### Requirement: Instanz-Cockpit diagnostiziert IAM-Basis zugewiesener Module

Das System SHALL fuer jede Instanz einen expliziten Betriebsbefund ueber die Vollstaendigkeit der IAM-Basis fuer `Core + zugewiesene Module` ableiten und dem Studio-Admin als direkte Diagnose auf der Instanz-Detailseite verfuegbar machen.

#### Scenario: Zugewiesene Module haben unvollstaendige IAM-Basis

- **GIVEN** eine Instanz hat zugewiesene Module
- **AND** mindestens eine erwartete Permission, Systemrolle oder `role_permission` fuer `Core + zugewiesene Module` fehlt
- **WHEN** der Studio-Admin die Instanzdetailansicht laedt
- **THEN** zeigt das Cockpit einen degradierten Befund fuer die IAM-Basis zugewiesener Module
- **AND** enthaelt der Befund eine direkte Reparaturaktion zum Neu-Seeden
