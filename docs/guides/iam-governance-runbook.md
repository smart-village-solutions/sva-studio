# IAM Governance Runbook

## Zweck

Dieses Runbook beschreibt den operativen Umgang mit Governance-Workflows
(Rechteänderungen, Delegationen, Impersonation, Legal-Akzeptanzen) inklusive
Missbrauchs- und Incident-Fällen.

## Trigger für Incident-Bearbeitung

- Wiederholte Denials mit `DENY_SELF_APPROVAL`
- Wiederholte Denials mit `DENY_TICKET_REQUIRED` oder `DENY_TICKET_STATE_INVALID`
- Impersonation-Sessions mit ungewöhnlicher Dauer oder häufigem Abbruch
- Instanzgrenzen-Verletzungen (`DENY_INSTANCE_SCOPE_MISMATCH`)

## Standardablauf (Triage)

1. Betroffene `instance_id` und Zeitfenster eingrenzen.
2. Governance-Events exportieren (`/iam/governance/compliance/export`).
3. Korrelationskette prüfen: `request_id`, `trace_id`, `event_id`.
4. Ticketbezug prüfen (`ticket_id`, `ticket_state`).
5. Bei Missbrauchsverdacht aktive Impersonation/Delegation sofort terminieren.

## Sofortmaßnahmen

- Impersonation beenden (`end_impersonation`) und Sessionstatus verifizieren.
- Delegation widerrufen (`revoke_delegation`) und Folgezugriffe prüfen.
- Offene Permission-Change-Requests mit hohem Risiko auf `rejected` setzen.
- Bei systemischem Fehler: Governance-Endpunkte temporär read-only schalten.

## Nachweisführung

- Exportformat: primär JSON, bei Audits zusätzlich CSV/SIEM.
- Pflichtfelder in Nachweisen:
  `event_id`, `timestamp`, `instance_id`, `action`, `result`, `actor_pseudonym`,
  `target_ref`, `reason_code`, `request_id`, `trace_id`.
- Keine Klartext-PII in Incident-Reports aufnehmen.

## Eskalation

- Security: bei bestätigtem Missbrauch oder Ticket-Manipulation.
- DSB/Legal: bei Compliance-relevanten Abweichungen.
- Plattform: bei DB-/RLS-/Observability-Ausfällen.
