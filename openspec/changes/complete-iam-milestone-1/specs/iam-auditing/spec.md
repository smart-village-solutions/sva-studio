## ADDED Requirements

### Requirement: Auditspur für Rechte-, Gruppen- und Lifecycle-Änderungen

Das System SHALL alle sicherheitsrelevanten Rechte- und Lifecycle-Änderungen revisionssicher protokollieren.

#### Scenario: Offboarding entzieht Rechte

- **WHEN** ein Account offboarded wird oder Rollen, Gruppen oder Delegationen entzogen werden
- **THEN** entsteht für jede sicherheitsrelevante Änderung ein auditierbares Ereignis mit Ergebnis, Scope und Korrelation
- **AND** Klartext-PII wird nicht in der Audit-Payload gespeichert

### Requirement: Exportfähige Nachweise für Audit und DSGVO

Das System SHALL exportierbare Nachweise für Compliance- und Betroffenenanfragen bereitstellen.

#### Scenario: Zeitraumsexport für Compliance-Prüfung

- **WHEN** ein berechtigter Prüfer einen definierten Zeitraum exportiert
- **THEN** stehen Auditdaten als CSV und JSON in feldäquivalenter Form bereit
- **AND** personenbezogene Exportbestandteile bleiben auf den zulässigen Umfang begrenzt

#### Scenario: DSGVO-Auskunft für einen Account

- **WHEN** eine berechtigte Auskunftsanfrage zu einem Account erzeugt wird
- **THEN** kann das System alle dem Nutzer zugeordneten personenbezogenen IAM-Daten in einem konsistenten Export bündeln
- **AND** die Erstellung des Exports selbst wird revisionssicher protokolliert

### Requirement: Erinnerungs- und Review-Nachweise

Das System SHALL periodische Reviews von Accounts, Rechten und relevanten Governance-Zuständen nachweisbar unterstützen.

#### Scenario: Regelmäßige Rechteprüfung wird fällig

- **WHEN** eine definierte Review-Frist für Accounts oder Berechtigungen erreicht ist
- **THEN** erzeugt das System einen nachvollziehbaren Reminder- oder Review-Nachweis
- **AND** überfällige Prüfungen bleiben für Administratoren sichtbar

### Requirement: Dokumentiertes Datenlöschkonzept mit Audit-Abgrenzung

Das System SHALL PII-Löschung, Archivierung und pseudonymisierte Audit-Aufbewahrung als getrennte Pfade spezifizieren.

#### Scenario: Account wird datenschutzkonform gelöscht

- **WHEN** ein Account final gelöscht oder anonymisiert wird
- **THEN** werden löschpflichtige personenbezogene Daten entfernt oder anonymisiert
- **AND** revisionsrelevante Auditnachweise bleiben nur in zulässiger pseudonymisierter Form erhalten
