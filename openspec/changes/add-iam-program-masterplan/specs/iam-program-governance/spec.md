# IAM Program Governance Specification

## ADDED Requirements

### Requirement: Verbindliche Masterplan-Governance

Der Masterplan SHALL die IAM-Umsetzung über freigegebene Child-Changes steuern. Direkte Feature-Implementierung im Master-Change ist nicht zulässig.

#### Scenario: Child-Start nur mit Freigabe

- **WHEN** ein Child-Change in die Umsetzung überführt wird
- **THEN** ist dessen Proposal freigegeben
- **AND** dessen Taskliste enthält testbare Akzeptanzkriterien
- **AND** die Implementierung erfolgt nicht direkt im Master-Change

### Requirement: Verbindliche Programm-Leitplanken

Die folgenden Leitplanken SHALL verbindlich für alle IAM-Child-Changes gelten:

- Phase-1-Umfang: Auth + Session + RBAC-Basis inkl. Multi-Org-Context-Switch
- Kanonischer Scope: `instanceId`
- Instanzmodell: Eine Instanz kann mehrere Organisationen enthalten; Benutzerzuordnungen sind instanzgebunden und organisationsspezifisch
- Hierarchiemodell: beliebig tief
- Rollout: stufenweise per Feature-Flags
- `authorize`-Leistungsziel: P95 < 50 ms
- Cache-Invalidierung: Postgres NOTIFY mit TTL-/Recompute-Fallback
- Impersonation: Ticketpflicht + Vier-Augen-Freigabe + zeitliche Begrenzung
- Audit/Compliance: PII-minimiert, Exportformate CSV/JSON/SIEM

#### Scenario: Review eines Child-Changes gegen Leitplanken

- **WHEN** ein Child-Change zur Review gestellt wird
- **THEN** sind dessen Requirements und Tasks mit den Leitplanken kompatibel
- **AND** Abweichungen sind explizit dokumentiert und begründet

### Requirement: Konsistenter Beschlussstand

Die Masterplan-Entscheidungen SHALL im Dokument `decision-checklist.md` gepflegt und mit Proposal/Spec synchron gehalten werden.

#### Scenario: Entscheidungsänderung

- **WHEN** eine bereits bestätigte Leitplanke geändert wird
- **THEN** werden `decision-checklist.md`, Master-Proposal und Master-Spec gemeinsam aktualisiert
- **AND** die betroffenen Child-Changes werden auf Folgewirkungen geprüft

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
