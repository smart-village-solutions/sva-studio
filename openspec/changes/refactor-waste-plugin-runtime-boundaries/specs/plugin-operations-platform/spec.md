## ADDED Requirements

### Requirement: Waste-Jobs verwenden den bestehenden deklarativen Ladevertrag

Das System SHALL Waste-Jobhandler über Manifest, Runtimeanforderung und kanonischen Snapshot laden. Allgemeine Jobloader SHALL keine Waste-ID-Sonderregistrierung oder konkrete Waste-Jobtypen zur Bestimmung von Abbruchfähigkeit oder Ausführungslane enthalten. Der Host SHALL privilegierte Fähigkeiten weiterhin selbst freigeben und validieren.

#### Scenario: Waste-Jobbeitrag wird geladen

- **GIVEN** ein hostvalidiertes Waste-Manifest deklariert seinen Job-Entry und die nötige Runtimeanforderung
- **WHEN** der Host Workspace- oder installierte Jobbeiträge registriert
- **THEN** lädt er den deklarativen Entry über den bestehenden Loader
- **AND** Handlerabdeckung, Ownership und benötigte Ausführungsmetadaten sind vollständig validiert

#### Scenario: Beitrag fehlt oder ist unzulässig

- **WHEN** Waste fehlt oder sein deklarierter Entry, Runtimevertrag oder Handler unvollständig ist
- **THEN** gibt es bei fehlendem Plugin keine Waste-Registrierung
- **AND** ein unvollständiger deklarierter Beitrag scheitert vor Veröffentlichung ohne Waste-Fallback
- **AND** unbekannte oder nicht vom Host freigegebene Privilegierung wird abgewiesen

### Requirement: Fachliche Start- und Artefaktanforderungen schwächen keine Host-Prüfung

Das System SHALL fachliche Start-/Downloadanforderungen aus validierten Beiträgen oder bestehenden Fachhandlern beziehen, ohne Waste-spezifische Branches in allgemeinen Endpunkten. Actor-/Tenantbindung, Permissions, Lifecycle, CSRF bei Mutationen, Artefaktablauf und Integrität SHALL erhalten bleiben.

#### Scenario: Generischer Start würde Fachprüfung umgehen

- **GIVEN** ein Waste-Job darf nur über seinen geprüften Fachpfad gestartet werden
- **WHEN** ein Aufruf den generischen Startpfad nutzt
- **THEN** weist der Host ihn anhand der validierten Startanforderung ab
- **AND** es erfolgt weder Enqueue noch Fachmutation

#### Scenario: Exportberechtigung oder Artefaktbindung fehlt

- **WHEN** ein Akteur ohne nötige Exportberechtigung, mit fremdem Tenant/Actor oder abgelaufenem beziehungsweise beschädigtem Artefakt einen Download anfordert
- **THEN** verweigert der Host den Zugriff nach dem bestehenden Fehlervertrag
- **AND** der Besitz der Job-ID oder allgemeiner Monitoring-Rechte ersetzt keine fachliche Exportberechtigung

#### Scenario: Verschobene Fachausführung bleibt atomar und idempotent

- **WHEN** ein Import, Jahreswechsel oder Provisionierungsjob fehlschlägt, wiederholt oder konkurrierend beansprucht wird
- **THEN** bleiben bisherige Transaktions-, Rollback-, Idempotenz-, Claim- und Retryverträge wirksam
- **AND** echte PostgreSQL-Tests belegen die geänderten Schreib-/Claim-Grenzen
- **AND** Abbruchfähigkeit und privilegierte Lane werden durch Host-Contracttests abgesichert
