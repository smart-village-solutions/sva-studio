# Tasks: add-iam-governance-workflows

## 1. Workflow-Modelle

- [ ] 1.1 `permission_change_requests` modellieren
- [ ] 1.2 `delegations` inkl. Validitätslogik modellieren
- [ ] 1.3 Impersonation-Sitzungen inkl. Ablaufmodell definieren
- [ ] 1.4 Statusmodell und erlaubte Transitionen je Workflow dokumentieren

## 2. Umsetzungslogik

- [ ] 2.1 Approval-Flow (Vier-Augen) implementieren
- [ ] 2.2 Delegationsauflösung in Permission-Berechnung integrieren
- [ ] 2.3 Impersonation mit Sicherheitsgrenzen und Sichtbarkeit implementieren
- [ ] 2.4 Instanzgrenzen in allen Governance-Operationen erzwingen (`instanceId`)
- [ ] 2.5 Ticketpflicht und Ablaufzeit-Prüfung für kritische Governance-Aktionen erzwingen

## 3. Audit & Compliance

- [ ] 3.1 Unveränderbare Audit-Events je Workflow-Aktion schreiben
- [ ] 3.2 Legal-Text-Versionierung und Akzeptanznachweise integrieren
- [ ] 3.3 Export-/Nachweisfähigkeit für Compliance sicherstellen
- [ ] 3.4 Exportpfade (CSV/JSON/SIEM) auf Vollständigkeit und Konsistenz prüfen

## 4. Tests

- [ ] 4.1 Negativtests für Missbrauchsszenarien ergänzen
- [ ] 4.2 Integrationstests für End-to-End Governance-Flows ergänzen
- [ ] 4.3 Regressionstests für bestehende Authorize-Pfade ergänzen
- [ ] 4.4 Isolationstests: keine Workflow-Wirkung über Instanzgrenzen hinweg

## 5. Verifikation & Dokumentation

- [ ] 5.1 Governance-Runbook für Incident-/Missbrauchsfälle ergänzen
- [ ] 5.2 Freigabematrix (wer darf was genehmigen) dokumentieren
- [ ] 5.3 arc42-Referenzen in betroffenen Child-Dokumenten final gegenprüfen

## 6. Architektur-Dokumentation (Review-Befund)

- [x] 6.1 `design.md` für Child E erstellt (Workflow-State-Machines, Impersonation-Sequenz, Audit-Event-Schema, Legal-Text-Versionierung)

## 7. Operative Observability (Logging-Review 26.02.2026)

- [ ] 7.1 SDK Logger für Governance-Modul einsetzen: `createSdkLogger({ component: 'iam-governance' })`
- [ ] 7.2 Impersonation-Events granular loggen (jeweils `warn`-Level):
  - `impersonate_start`: `{ operation, ticket_id, actor_pseudonym, target_pseudonym, max_duration_s, request_id }`
  - `impersonate_end`: `{ operation, ticket_id, duration_s, request_id }`
  - `impersonate_timeout`: `{ operation, ticket_id, duration_s, request_id }`
  - `impersonate_abort`: `{ operation, ticket_id, reason, actor_pseudonym, request_id }`
- [ ] 7.3 Governance-Workflow-Events loggen:
  - `info`: Approval beantragt, genehmigt, abgelehnt
  - `warn`: Delegation erstellt/abgelaufen
  - `error`: Missbrauchsversuch (z.B. Impersonation ohne Ticket)
- [ ] 7.4 Dual-Write für alle Governance-Audit-Events: DB (`iam.activity_logs`) + OTEL-Pipeline (SDK Logger)
- [ ] 7.5 Korrelations-IDs in allen Governance-Operationen propagieren (`request_id`, `trace_id`)
- [ ] 7.6 PII-Schutz in Governance-Logs validieren: keine Klartext-E-Mails, Session-IDs oder Ticket-Inhalte
