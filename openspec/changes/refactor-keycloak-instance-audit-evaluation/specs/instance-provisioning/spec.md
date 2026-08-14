## ADDED Requirements

### Requirement: Operativer Keycloak-Instanz-Audit trennt Erhebung und Bewertung

Das System SHALL den read-only Keycloak-Instanz-Audit als getrennte Erhebungs-
und Bewertungsgrenzen ausführen. Die Erhebung SHALL den bestehenden Realm-,
Client-, Secret-, Rollen-, Serviceaccount- und Bootstrap-Zustand in unveränderter
`kcadm`-Reihenfolge erfassen. Die reine Bewertung SHALL daraus dieselben
vierzehn Check-IDs, Titel, Zusammenfassungen, Details und Fail-/Warn-/Skip-
Statuswerte wie der eingeführte Auditvertrag ableiten. Secret-Inhalte MUST aus
Ergebnissen, Fehlern, Logs und Testevidenz ausgeschlossen bleiben.

#### Scenario: Vollständiger Tenant-Zustand wird unverändert bewertet

- **WHEN** Realm, Login-Client, Tenant-Admin-Client, Secrets, Rollen und aktiver
  `system_admin`-Benutzer dem bestehenden Soll entsprechen
- **THEN** liefert der Audit dieselben vierzehn Befunde mit denselben IDs,
  Titeln, Zusammenfassungen, Details und Statuswerten wie zuvor
- **AND** enthalten die Ergebnisse keine Secret-Inhalte

#### Scenario: Fehlendes Realm beendet die Erhebung fail-closed

- **WHEN** das konfigurierte Tenant-Realm nicht gelesen werden kann
- **THEN** liefert der Audit ausschließlich den bestehenden Fehlerbefund
  `keycloak.realm.exists`
- **AND** führt er keine nachfolgenden Client-, Rollen- oder Secret-Leseaufrufe
  aus
- **AND** räumt er seine temporäre `kcadm`-Konfiguration auf

#### Scenario: Teilzustände behalten Fail-, Warn- und Skip-Semantik

- **WHEN** Login-URLs oder Secrets abweichen, Tenant-Admin-Flags oder Rollen
  fehlen, kein aktiver `system_admin`-Benutzer existiert oder optionale
  Mapper-/Bootstrap-Hinweise nicht bestätigt sind
- **THEN** bleiben alle bisherigen Fail-, Warn- und Skip-Entscheidungen
  unverändert
- **AND** führt der Audit keine Keycloak-Mutation und keinen Plattform-Fallback
  aus
