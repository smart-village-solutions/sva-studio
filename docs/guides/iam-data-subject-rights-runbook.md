# IAM Data Subject Rights Runbook

## Zweck

Dieses Runbook beschreibt den operativen Betrieb der DSGVO-Betroffenenrechte (Art. 15-21) im IAM-Kontext: Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch sowie Legal-Hold-Steuerung.

## Relevante Endpunkte

- Self-Service Export: `GET /iam/me/data-export?format={json|csv|xml}`
- Self-Service Export-Status (async): `GET /iam/me/data-export/status?jobId=<uuid>`
- Self-Service Anfrage: `POST /iam/me/data-subject-rights/requests`
- Self-Service Berichtigung: `POST /iam/me/profile`
- Optional-Processing-Gate: `POST /iam/me/optional-processing/execute`
- Admin Export: `GET /iam/admin/data-subject-rights/export`
- Admin Export-Status: `GET /iam/admin/data-subject-rights/export/status?jobId=<uuid>`
- Legal Hold setzen: `POST /iam/admin/data-subject-rights/legal-holds/apply`
- Legal Hold aufheben: `POST /iam/admin/data-subject-rights/legal-holds/release`
- Wartungslauf (SLA/Eskalation/Finalisierung): `POST /iam/admin/data-subject-rights/maintenance`

## Standardablauf Löschung (Art. 17)

1. Benutzer stellt Löschantrag über `POST /iam/me/data-subject-rights/requests` mit `type=deletion`.
2. System setzt Sperrung und Soft-Delete (`is_blocked`, `soft_deleted_at`) innerhalb der 48h-SLA.
3. `delete_after` wird aus der konfigurierten Retention (`IAM_DSR_DELETE_RETENTION_HOURS`) berechnet.
4. Wartungslauf finalisiert berechtigte Datensätze (keine aktiven Legal Holds):
   - Rollen- und Organisationszuordnungen werden gelöscht.
   - Audit-Referenzen werden pseudonymisiert.
   - Account-PII wird anonymisiert und als endgültig gelöscht markiert (`permanently_deleted_at`).

## SLA und Eskalation

- SLA-Definition: `requestAcceptedAt -> softDeletedAt` <= 48 Stunden.
- Wartungslauf eskaliert überfällige Löschanfragen automatisch (`status=escalated`).
- Eskalationen werden als Audit-Event (`dsr_deletion_sla_escalated`) protokolliert.

## Legal Hold

- Bei aktivem Hold wird die finale Löschung blockiert (`status=blocked_legal_hold`).
- Holds werden ausschließlich über Admin-Endpunkte erstellt/aufgehoben.
- Jede Hold-Änderung ist revisionssicher im Audit-Log dokumentiert.

## Art.-19-Nachweis

- Bei Berichtigung/Löschung/Einschränkung werden Empfängerklassen als Nachweisdatensätze angelegt.
- Wartungslauf dokumentiert Zustellung bzw. begründeten Entfall in `data_subject_recipient_notifications`.

## Backup-Retention und Restore-Sanitization

- Punktuelle Löschung in unveränderlichen Backups ist nicht vorgesehen.
- Compliance erfolgt über:
  - definierte Backup-Retention,
  - Restore-Sanitization nach Wiederherstellung.
- Restore-Sanitization Pflichtschritte:
  1. DSR-Wartungslauf unmittelbar nach Restore starten.
  2. Soft-Deleted Datensätze mit abgelaufener Frist finalisieren.
  3. Audit-Pseudonymisierung prüfen (`subject_pseudonym` vorhanden).
  4. Ergebnis im Incident- bzw. Restore-Protokoll festhalten.

## Monitoring-Checks

- Anzahl offener DSR-Anfragen (`status in accepted|processing`) pro Instanz
- Anzahl SLA-Eskalationen pro Zeitraum
- Anzahl blockierter Löschungen durch Legal Hold
- Anzahl fehlgeschlagener Exportjobs (`status=failed`)

## Eskalation

- Security/Legal: bei Legal-Hold-Konflikten oder unerwarteter Datenpersistenz
- DSB: bei SLA-Verstößen oder unvollständigen Nachweisen
- Plattform: bei DB-/Migrations-/Wartungslauf-Fehlern
