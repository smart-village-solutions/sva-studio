## ADDED Requirements
### Requirement: Medienmanagement-Architektur in arc42 dokumentieren

Das System SHALL die Architekturwirkung des Medienmanagements in den betroffenen arc42-Abschnitten nachvollziehbar dokumentieren.

#### Scenario: Externe Medieninfrastruktur ist im Systemkontext beschrieben

- **WHEN** Medienmanagement einen Objektspeicher, CDN- oder geschützte Auslieferungspfade einführt
- **THEN** beschreiben die arc42-Abschnitte für Kontext, Deployment und Querschnitt die externen Systeme, Vertrauensgrenzen und Laufzeitverantwortlichkeiten
- **AND** sie duplizieren keine fachlichen Laufzeitregeln aus den Capability-Spezifikationen

#### Scenario: Medienbausteine sind in der Baustein- und Laufzeitsicht verortet

- **WHEN** die Medien-Capability umgesetzt wird
- **THEN** dokumentiert die arc42-Bausteinsicht die hostseitigen Medienbausteine, Schnittstellen und Abhängigkeiten zu Content, IAM und Audit
- **AND** die Laufzeitsicht beschreibt Upload, Variantenableitung, Verwendungsnachweis und kontrollierte Auslieferung auf Architektur-Ebene

#### Scenario: Querschnittliche Medienregeln referenzieren die fachlichen Specs

- **WHEN** Mandantentrennung, Löschschutz, geschützte Auslieferung oder Audit im Architekturkapitel behandelt werden
- **THEN** verweisen die Dokumentationsabschnitte auf `media-management`, `content-management`, `iam-access-control` und `iam-auditing`
- **AND** die Laufzeitregeln bleiben in diesen fachlichen Spezifikationen führend

#### Scenario: ADR für Package- und Storage-Entscheidungen ist verlinkt

- **WHEN** die Umsetzung startet
- **THEN** dokumentiert ADR-037 Package-Zuschnitt, Storage-/Processing-Vertrag und Bezug zum Plugin-SDK-Vertrag aus ADR-034
- **AND** `docs/architecture/09-architecture-decisions.md` referenziert diese Entscheidung
