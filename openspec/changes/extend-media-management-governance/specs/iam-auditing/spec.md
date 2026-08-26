## ADDED Requirements

### Requirement: Audit für redaktionelle Medien-Governance

Das System SHALL Änderungen an lokalisierten globalen Medienmetadaten und an der Medienorganisation revisionssicher und instanzbezogen auditieren.

#### Scenario: Lokalisierte Metadaten werden geändert

- **WHEN** ein berechtigter Benutzer sprachbezogene globale Asset-Metadaten anlegt, ändert oder entfernt
- **THEN** erzeugt das System ein unveränderbares Audit-Ereignis mit Aktion, Ergebnis, Instanz, pseudonymisiertem Actor, Zielreferenz und betroffenen Sprachcodes
- **AND** das Ereignis enthält keine Dateiinhalte, Klartext-PII oder unnötigen Metadatenwerte

#### Scenario: Medienorganisation wird geändert

- **WHEN** Ordner, Tags, Kategorien oder ihre Asset-Zuordnungen angelegt, geändert, verschoben oder entfernt werden
- **THEN** erzeugt das System ein unveränderbares Audit-Ereignis mit Änderungsart, Ergebnis, Instanz und Zielreferenz
- **AND** instanzfremde Taxonomie- oder Asset-Daten werden nicht offengelegt

### Requirement: Audit für Schutzentscheidungen im Medienlebenszyklus

Das System SHALL Duplikat-, Malware-, Replace- und Quota-Warnschwellen-Entscheidungen revisionssicher und redigiert auditieren.

#### Scenario: Duplikatentscheidung wird getroffen

- **WHEN** ein Hash-Treffer erkannt und Wiederverwendung, bestätigte Duplikatanlage oder Abbruch entschieden wird
- **THEN** erzeugt das System ein unveränderbares Audit-Ereignis mit Entscheidung, Ergebnis, Instanz und erlaubter Zielreferenz
- **AND** rohe Inhalts-Hashes, nicht sichtbare Treffer und instanzfremde Asset-Daten werden nicht gespeichert

#### Scenario: Malware-Prüfung beeinflusst die Freigabe

- **WHEN** ein Malware-Scan die Freigabe eines Uploads oder einer Replace-Version erlaubt oder verhindert
- **THEN** erzeugt das System ein unveränderbares Audit-Ereignis mit normierter Ergebnis- und Reason-Code-Klasse
- **AND** Scanner-Interna, Storage-Keys, Secrets und sensitive Dateidetails werden nicht gespeichert

#### Scenario: Replace wechselt oder verwirft eine Originalversion

- **WHEN** eine neue Originalversion aktiviert oder wegen eines Fehlers nicht freigegeben wird
- **THEN** erzeugt das System ein unveränderbares Audit-Ereignis mit Replace-Phase, Ergebnis und stabiler Asset-Zielreferenz
- **AND** Request- und Trace-Korrelation erlauben die Zuordnung zu Processing-Ereignissen
- **AND** technische Storage-Artefakte werden nicht offengelegt

#### Scenario: Quota-Warnschwelle wird verwaltet

- **WHEN** eine instanzbezogene Quota-Warnschwelle angelegt, geändert, erreicht oder entfernt wird
- **THEN** erzeugt das System ein unveränderbares Audit-Ereignis mit Aktion, Ergebnis, Instanz und Warnstufe
- **AND** das Ereignis bleibt über den bestehenden Governance-Exportvertrag exportierbar
