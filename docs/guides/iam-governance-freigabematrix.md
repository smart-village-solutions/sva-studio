# IAM Governance Freigabematrix

## Grundregeln

- Kritische Aktionen folgen dem Vier-Augen-Prinzip.
- `requester != approver` ist verpflichtend.
- Freigaben gelten nur im aktiven `instanceId`-Scope.
- Ticketpflicht mit zulässigen States:
  `open`, `in_progress`, `approved_for_execution`.

## Matrix (v1)

| Aktion | Requester | Approver | Zusatz-Gate |
| --- | --- | --- | --- |
| Kritische Rechteänderung (Rolle vergeben/entziehen) | IAM Admin / Security Admin | IAM Approver | Kein Self-Approval |
| Rollenänderung mit privilegierten Permissions (`*admin*`, `*security*`, `*iam*`) | IAM Admin | IAM Approver | Ticketpflicht |
| Delegation (privilegierte Rolle) | Delegator / IAM Admin | IAM Approver | Max. 30 Tage |
| Impersonation (Standard) | Support / IAM Admin | IAM Approver | Max. 120 Minuten |
| Impersonation (`support_admin`) | Support Admin | IAM Approver + Security Approver | Zwei unabhängige Freigaben |
| Legal-Text-Akzeptanz-Widerruf | Betroffener Benutzer / Compliance Admin | Compliance Approver | Auditpflicht |

## Reason-Codes bei Verstoß

- `DENY_SELF_APPROVAL`
- `DENY_TICKET_REQUIRED`
- `DENY_TICKET_STATE_INVALID`
- `DENY_INSTANCE_SCOPE_MISMATCH`
- `DENY_IMPERSONATION_DURATION_EXCEEDED`
- `DENY_DELEGATION_DURATION_EXCEEDED`
