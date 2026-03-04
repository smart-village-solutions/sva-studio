# Design: Child E – Governance-Workflows und Compliance-Flows

## Kontext

Child E ergänzt die Autorisierung um kontrollierte Governance-Prozesse (Vier-Augen, Delegation, Impersonation) und revisionssichere Nachweise.

## Ziele

- Nachvollziehbare Request-/Approval-Workflows
- Sichere Delegation und zeitlich begrenzte Impersonation
- Unveränderbare Audit-Events für Compliance
- Strikte Instanzisolation in allen Governance-Aktionen

## Architekturentscheidungen

1. Workflow-Objekte als explizite State-Machines
2. Kritische Aktionen benötigen Ticketreferenz und Vier-Augen-Freigabe
3. Impersonation ist zeitlich begrenzt, sichtbar und abbrechbar
4. Jeder Workflow-Schritt erzeugt ein unveränderbares Audit-Event

## Workflow-Modelle

- Permission Change Request: `draft -> submitted -> approved|rejected -> applied`
- Delegation: `requested -> active -> expired|revoked`
- Impersonation: `requested -> approved -> active -> terminated|expired`

## Sicherheitsgrenzen

- `instanceId`-Enforcement für jede Aktion
- Kein Self-Approval bei kritischen Änderungen
- Harte Ablaufzeiten für Delegation/Impersonation

## Audit- und Compliance-Modell

- Immutable Event-Schema für Governance-Aktionen
- Exportpfade für CSV/JSON/SIEM
- Legal-Text-Versionierung inkl. Akzeptanzhistorie

## Operative Observability

- SDK Logger ist verpflichtend für Governance-Flows (`component: iam-governance`)
- Impersonation-Start/-Ende/-Timeout/-Abbruch werden strukturiert protokolliert
- Workflow-Events (beantragt/genehmigt/abgelehnt) werden mit Severity-Policy geloggt
- Dual-Write für sicherheitsrelevante Events: DB (`iam.activity_logs`) + OTEL-Pipeline
- `request_id` und `trace_id` werden in allen Governance-Operationen propagiert
- PII-Schutz: keine Klartext-E-Mails, Session-IDs oder Ticket-Inhalte in Logs

## Alternativen und Abwägung

- Soft-Governance ohne Ticketpflicht: verworfen wegen fehlender Nachweisqualität
- Nur technische Logs ohne Business-Event-Modell: verworfen wegen Compliance-Lücken

## Verifikation

- E2E-Tests für Approval-, Delegation- und Impersonation-Flows
- Missbrauchs-Negativtests (Self-Approval, Instanzgrenzen)
- Export-Tests für Nachweisvollständigkeit
