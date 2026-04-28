## ADDED Requirements
### Requirement: Audit für Medien-Governance und Upload-Schutz

Das System SHALL Governance- und Betriebsentscheidungen im Medienmanagement revisionssicher und redigiert auditieren.

#### Scenario: Upload-Schutz wird protokolliert

- **WHEN** Duplikaterkennung, Malware-Scan oder rollen-/instanzbezogene Upload-Limits einen Upload beeinflussen
- **THEN** erzeugt das System ein Audit-Event mit Entscheidung, Zielobjekt, Scope und Ergebnis
- **AND** Scanner-Interna, Storage-Secrets und PII werden nicht offengelegt

#### Scenario: Erweiterte Metadaten und Taxonomie werden protokolliert

- **WHEN** Lizenz-/Copyright-Pflichtfelder, mehrsprachige Metadaten, Ordner, Tags oder Kategorien geändert werden
- **THEN** erzeugt das System ein Audit-Event mit Änderungsart, Zielobjekt und Ergebnis
- **AND** das Event bleibt exportierbar und unveränderbar

#### Scenario: Replace-Entscheidung wird protokolliert

- **WHEN** ein Asset durch ein neues Original ersetzt wird
- **THEN** erzeugt das System ein Audit-Event mit Replace-Ergebnis und redigiertem Usage-Impact
- **AND** technische Storage-Artefakte werden nicht offengelegt
