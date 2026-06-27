## MODIFIED Requirements
### Requirement: Instanz-Anlage-Flow enthaelt einen sichtbaren Abschnitt fuer den initialen Admin-Bootstrap

Das System SHALL den initialen Admin-Bootstrap nach erfolgreicher Instanzanlage
in einen separaten einmaligen Flow `Setup abschliessen` ueberfuehren. Dieser
Flow ist kein dauerhafter Bestandsmodus, sondern dient ausschliesslich dem
Abschluss der Inbetriebnahme.

#### Scenario: Setup-Abschluss ist eigener Folgeschritt nach dem Create

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **WHEN** der Studio-Admin den naechsten primaeren Schritt waehlt
- **THEN** fuehrt die UI in den separaten Flow `Setup abschliessen`
- **AND** bleibt dieser Flow klar von `Betrieb`, `Doctor` und
  `Einstellungen` getrennt

### Requirement: Instanz gilt erst nach erfolgreichem Bootstrap-Lauf als fertig

Das System SHALL eine Instanz erst dann als fachlich fertig eingerichtet
behandeln, wenn die Inbetriebnahme vollstaendig abgeschlossen ist. Vollstaendig
abgeschlossen bedeutet mindestens: die Instanz ist aktiv und die
Tenant-Admin-Struktur wurde initialisiert.

#### Scenario: Aktivierung allein beendet das Setup noch nicht

- **GIVEN** eine Instanz wurde angelegt und aktiviert
- **AND** die Tenant-Admin-Struktur wurde noch nicht initialisiert
- **WHEN** der Studio-Admin den Setup-Status betrachtet
- **THEN** gilt die Inbetriebnahme noch nicht als abgeschlossen
- **AND** weist der Flow auf den noch ausstehenden Schritt zur
  Tenant-Admin-Struktur hin

#### Scenario: Setup ist erst nach Aktivierung und Admin-Struktur abgeschlossen

- **GIVEN** eine Instanz wurde erfolgreich angelegt
- **WHEN** die Instanz aktiv ist
- **AND** die Tenant-Admin-Struktur erfolgreich initialisiert wurde
- **THEN** behandelt das System den Setup-Abschluss als fachlich fertig
- **AND** fuehrt die UI danach standardmaessig in die Bestandsverwaltung

### Requirement: Instanz-Detailseite zeigt Tenant-IAM-Betriebszustand getrennt von Provisioning-Readiness

Das System SHALL nach abgeschlossenem Setup die laufende Bestandsdiagnose von
der einmaligen Inbetriebnahme trennen. Provisioning-nahe Historie und
Reparaturpfade bleiben verfuegbar, sind fuer Bestandsinstanzen aber in einem
eigenen Diagnosemodus organisiert.

#### Scenario: Historie bleibt diagnostisch verfuegbar, aber nicht als Hauptmodus

- **WENN** eine Bestandsinstanz abgeschlossen eingerichtet ist
- **UND** ein Operator technische Laeufe oder Reconcile-Evidenz nachvollziehen
  moechte
- **DANN** findet er diese Historie im Diagnosekontext des Doctor-Modus
- **UND** wird Historie nicht als gleichrangiger Hauptmodus des Bestandsbetriebs
  praesentiert
