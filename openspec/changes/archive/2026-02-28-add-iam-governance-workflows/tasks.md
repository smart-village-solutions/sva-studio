# Tasks: add-iam-governance-workflows

## 1. Workflow-Modelle

- [x] 1.1 `permission_change_requests` modellieren
- [x] 1.2 `delegations` inkl. Validitätslogik modellieren
- [x] 1.3 Impersonation-Sitzungen inkl. Ablaufmodell definieren
- [x] 1.4 Statusmodell und erlaubte Transitionen je Workflow dokumentieren
- [x] 1.5 Kritische Rechteänderungen als prüfbare Regelmenge modellieren (inkl. Versionierung)

## 2. Umsetzungslogik

- [x] 2.1 Approval-Flow (Vier-Augen) implementieren
- [x] 2.2 Delegationsauflösung in Permission-Berechnung integrieren
- [x] 2.3 Impersonation mit Sicherheitsgrenzen und Sichtbarkeit implementieren
- [x] 2.4 Instanzgrenzen in allen Governance-Operationen erzwingen (`instanceId`)
- [x] 2.5 Ticketpflicht und Ablaufzeit-Prüfung für kritische Governance-Aktionen erzwingen
- [x] 2.6 Self-Approval-Sperre und getrennte Identitäten (`requester != approver`) erzwingen
- [x] 2.7 Harte Obergrenzen für Delegation/Impersonation inkl. Instanzkonfiguration umsetzen

## 3. Audit & Compliance

- [x] 3.1 Unveränderbare Audit-Events je Workflow-Aktion schreiben
- [x] 3.2 Legal-Text-Versionierung und Akzeptanznachweise integrieren
- [x] 3.3 Export-/Nachweisfähigkeit für Compliance sicherstellen
- [x] 3.4 Exportpfade (CSV/JSON/SIEM) auf Vollständigkeit und Konsistenz prüfen
- [x] 3.5 Einheitlichen Exportvertrag mit Pflichtfeldern (`event_id`, `timestamp`, `instance_id`, `reason_code`, Korrelations-IDs) implementieren
- [x] 3.6 Governance-Reason-Codes standardisieren und in Audit-Events erzwingen

## 4. Tests

- [x] 4.1 Negativtests für Missbrauchsszenarien ergänzen
- [x] 4.2 Integrationstests für End-to-End Governance-Flows ergänzen
- [x] 4.3 Regressionstests für bestehende Authorize-Pfade ergänzen
- [x] 4.4 Isolationstests: keine Workflow-Wirkung über Instanzgrenzen hinweg

## 5. Verifikation & Dokumentation

- [x] 5.1 Governance-Runbook für Incident-/Missbrauchsfälle ergänzen
- [x] 5.2 Freigabematrix (wer darf was genehmigen) dokumentieren
- [x] 5.3 arc42-Referenzen in betroffenen Child-Dokumenten final gegenprüfen
- [x] 5.4 Entscheidungsprotokoll finalisieren: Freigabematrix, Zeitlimits, Ticket-Policy als freigegebene Defaults markieren

## 6. Architektur-Dokumentation (Review-Befund)

- [x] 6.1 `design.md` für Child E erstellt (Workflow-State-Machines, Impersonation-Sequenz, Audit-Event-Schema, Legal-Text-Versionierung)

## 7. Operative Observability (Logging-Review 26.02.2026)

- [x] 7.1 SDK Logger für Governance-Modul einsetzen: `createSdkLogger({ component: 'iam-governance' })`
- [x] 7.2 Impersonation-Events granular loggen (jeweils `warn`-Level):
  - `impersonate_start`: `{ operation, ticket_id, actor_pseudonym, target_pseudonym, max_duration_s, request_id }`
  - `impersonate_end`: `{ operation, ticket_id, duration_s, request_id }`
  - `impersonate_timeout`: `{ operation, ticket_id, duration_s, request_id }`
  - `impersonate_abort`: `{ operation, ticket_id, reason, actor_pseudonym, request_id }`
- [x] 7.3 Governance-Workflow-Events loggen:
  - `info`: Approval beantragt, genehmigt, abgelehnt
  - `warn`: Delegation erstellt/abgelaufen
  - `error`: Missbrauchsversuch (z.B. Impersonation ohne Ticket)
- [x] 7.4 Dual-Write für alle Governance-Audit-Events: DB (`iam.activity_logs`) + OTEL-Pipeline (SDK Logger)
- [x] 7.5 Korrelations-IDs in allen Governance-Operationen propagieren (`request_id`, `trace_id`)
- [x] 7.6 PII-Schutz in Governance-Logs validieren: keine Klartext-E-Mails, Session-IDs oder Ticket-Inhalte

## 8. Keycloak-Integration

- [x] 8.1 Claim-Mapping für Governance-Actor (`sub`, Rollen/Groups) verbindlich implementieren und dokumentieren
- [x] 8.2 Governance-Audit mit Keycloak-Subject-Korrelation (`request_id`, `trace_id`, subject-ref) absichern
- [x] 8.3 Ablauf/Abbruch von Impersonation gegen Session-/Token-Validierung testen (keine Restwirkung)
- [x] 8.4 Rechteeinschränkungen nach Approval/Revocation bei nächster Validierung wirksam prüfen
