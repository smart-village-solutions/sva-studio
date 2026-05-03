## ADDED Requirements
### Requirement: Modulbezogene Access-Control verwendet dieselbe Vertragsfamilie wie Runtime und Host

Das System SHALL modulbezogene Permission- und Rollenentscheidungen auf einer gemeinsamen Vertragsfamilie aufbauen, die fuer Host, Runtime und IAM-Seeding konsistent ist.

#### Scenario: Modulbezogene Autorisierung driftet nicht von Runtime-Seeding weg

- **WHEN** ein Modul fuer eine Instanz zugewiesen ist und modulbezogene Permissions ausgewertet werden
- **THEN** basieren Runtime-Seeding, Snapshot-Basis und Autorisierungsentscheidung auf derselben Vertragsfamilie
- **AND** existiert keine separate manuelle Runtime-Definition mit abweichenden Rollen- oder Permission-Listen

#### Scenario: Vertragsaenderungen sind in allen Ebenen konsistent sichtbar

- **WHEN** sich ein kanonischer Modul-IAM-Vertrag aendert
- **THEN** werden Build-Time-Host-Verhalten, Runtime-Seeding und modulbezogene Access-Control konsistent aus derselben Quelle oder derselben daraus erzeugten Vertragsfamilie abgeleitet
- **AND** koennen Aenderungen nicht nur in einer Ebene wirksam werden, waehrend andere Ebenen alte Vertragsdaten behalten
