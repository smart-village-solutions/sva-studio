## ADDED Requirements

### Requirement: Prod-nahes Parity-Gate vor mutierenden Remote-Rollouts

Das System SHALL vor mutierenden Remote-Rollouts fuer produktionsnahe Runtime-Profile einen prod-nahen Parity-Nachweis fuer das auszurollende Artefakt erbringen.

#### Scenario: Kandidat besteht produktionsnahen Root- und Tenant-Smoke

- **WHEN** ein Operator einen mutierenden Rollout fuer `studio` vorbereitet
- **THEN** prueft ein definierter Gate-Schritt das zugehoerige Artefakt in einem produktionsnahen Runtime-Kontext
- **AND** umfasst der Gate-Schritt mindestens einen Root-Smoke und einen Tenant-bezogenen Smoke
- **AND** wird der Remote-Rollout erst nach bestandenem Gate fortgesetzt

#### Scenario: Parity-Gate blockiert Drift vor dem Remote-Deploy

- **WHEN** der prod-nahe Gate-Schritt eine Abweichung bei Runtime-Flags, Host-Verhalten, Auth-Entry oder vergleichbaren driftrelevanten Vertragsflaechen erkennt
- **THEN** blockiert der Prozess den mutierenden Remote-Rollout
- **AND** benennt der Report die erkannte Driftklasse so, dass sie vor dem Remote-Debugging eingegrenzt werden kann

### Requirement: Deploy-Contract bewertet Registry und Auth aus Sicht von `APP_DB_USER`

Das System SHALL Registry-, Auth- und RLS-relevante Gesundheitsnachweise fuer produktionsnahe Runtime-Profile aus Sicht des laufenden App-Datenbankbenutzers bewerten.

#### Scenario: Superuser ist gruen, App-Principal jedoch durch RLS oder Grants blockiert

- **WHEN** ein Diagnose- oder Deploy-Nachweis fuer `studio` aus Sicht eines Superusers erfolgreich waere
- **AND** dieselbe fachliche Sicht fuer `APP_DB_USER` durch RLS, fehlende Grants oder unvollstaendige Registry-Daten eingeschraenkt ist
- **THEN** gilt der Deploy-Contract als nicht bestanden
- **AND** darf das Ergebnis nicht als fachlich gesund dargestellt werden

#### Scenario: Post-Deploy-Verifikation nutzt denselben Principal wie die laufende App

- **WHEN** ein mutierender Rollout erfolgreich abgeschlossen wurde
- **THEN** bewertet die nachgelagerte Verifikation Registry- und Auth-Readiness mit derselben DB-Perspektive wie die laufende App oder einer technisch gleichwertigen Abbildung
- **AND** meldet der Report Abweichungen getrennt von Superuser-only-Befunden

### Requirement: Kanonischer Reconcile-Pfad nach manuellen Runtime-Eingriffen

Das System SHALL nach manuellen Eingriffen in produktionsnahe Swarm-Stacks einen kanonischen Reconcile-Pfad zur Rueckfuehrung auf den dokumentierten Soll-Zustand bereitstellen.

#### Scenario: Incident-Recovery ueber Portainer oder Quantum endet mit kanonischem Reconcile

- **WHEN** ein Team fuer `studio` einen manuellen Portainer-, Quantum- oder vergleichbaren Live-Eingriff zur Incident-Recovery durchfuehrt
- **THEN** gilt dieser Eingriff nur als temporaere Wiederherstellung
- **AND** fuehrt der dokumentierte Betriebsweg anschliessend einen kanonischen Soll-/Ist-Abgleich mit dem regulaeren Rolloutpfad aus
- **AND** wird der Incident erst nach erfolgreicher Reconcile- und Verifikationsphase als abgeschlossen behandelt

### Requirement: Dokumentierte Vertragsgrenze zwischen lokalem Development und `studio`

Das System SHALL die Unterschiede zwischen lokaler Entwicklungsumgebung und dem produktionsnahen `studio`-Profil als verbindliche Vertragsgrenze dokumentieren.

#### Scenario: Lokale gruene Tests werden als begrenzter Nachweis eingeordnet

- **WHEN** ein Team lokale Unit-, Integrations- oder Dev-E2E-Tests fuer eine Rollout-Entscheidung betrachtet
- **THEN** stellt die Dokumentation klar, dass diese Laeufe nicht automatisch den Betriebsvertrag von `studio` beweisen
- **AND** benennt sie die wesentlichen Differenzen bei Host-Modell, Laufzeitprofil, Secrets, Ingress und produktionsnaher Auth- bzw. Registry-Integration
- **AND** verweist sie fuer die produktionsnahe Freigabe auf das definierte Parity-Gate und die Remote-Verifikation
