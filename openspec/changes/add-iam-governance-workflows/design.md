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

## Verbindliche Defaults (beschlossen am 28.02.2026)

### Kritische Rechteänderungen (approval-pflichtig)

Als kritisch gelten mindestens:

- Vergabe/Entzug von Rollen mit privilegierten Permissions (`*admin*`, `*security*`, `*iam*`)
- Änderungen an Rollendefinitionen, die Schreib-/Delete-Rechte auf IAM-Objekte erweitern
- Aktivierung, Verlängerung oder Scope-Erweiterung von Impersonation
- Delegationen für privilegierte Rollen

### Freigabematrix v1

- Antragsteller (`requester`) darf niemals eigene kritische Änderung freigeben (`no self-approval`)
- Es sind zwei unterschiedliche Identitäten erforderlich: `requester != approver`
- `approver` benötigt Governance-Approval-Berechtigung im selben `instanceId`-Scope
- Für Impersonation von `support_admin` ist zusätzlich Security-Approver erforderlich

### Ticket-Policy v1

- Jede kritische Aktion benötigt `ticket_id`, `ticket_system`, `ticket_state`
- Erlaubte Ticket-States: `open`, `in_progress`, `approved_for_execution`
- Aktionen mit Ticket-States außerhalb dieser Liste werden abgewiesen
- Ticket-Metadaten werden nie als Klartext-Inhalt geloggt, nur referenziert

### Zeitlimits v1

- Impersonation: max. 120 Minuten pro Sitzung, keine harte Überschreitung
- Delegation: max. 30 Tage pro Delegationsfenster
- Werte sind instanzkonfigurierbar, aber nur innerhalb globaler Obergrenzen
- Verlängerungen erzeugen neue Workflow-Aktion mit eigener Genehmigung

### Export-Vertrag v1

- Exporte (CSV/JSON/SIEM) enthalten Pflichtfelder:
  `event_id`, `timestamp`, `instance_id`, `action`, `result`, `actor_pseudonym`, `target_ref`, `reason_code`, `request_id`, `trace_id`
- Formate sind feldäquivalent (kein Informationsverlust zwischen CSV/JSON/SIEM)

### Legal-Text-Akzeptanzmodell v1

- Nachweis beinhaltet `legal_text_id`, `legal_text_version`, `locale`, `accepted_at`, `actor_pseudonym`, `instance_id`
- Neue Version erfordert erneute Akzeptanz vor geschützter Aktion
- Widerruf wird als separates Audit-Event gespeichert und exportiert

### Reason-Code-Katalog v1 (Governance)

- `DENY_SELF_APPROVAL`
- `DENY_TICKET_REQUIRED`
- `DENY_TICKET_STATE_INVALID`
- `DENY_INSTANCE_SCOPE_MISMATCH`
- `DENY_IMPERSONATION_DURATION_EXCEEDED`
- `DENY_DELEGATION_DURATION_EXCEEDED`

## Keycloak Integration Constraints

### Scope und Abgrenzung

- Keycloak ist Identity- und Session-Quelle; Governance-Logik bleibt im IAM-Core
- Keine Keycloak-Härtung in Child E (siehe deferred Punkte im Masterplan)
- Child E fokussiert auf Integrationssicherheit und Nachweisfähigkeit

### Verbindliche Integrationsregeln

- Governance-Entscheidungen nutzen stabile Keycloak-Claims (`sub`, Rollen/Groups) als Actor-Referenz
- Jeder Governance-Schritt korreliert App-`request_id`/`trace_id` mit Keycloak-Subject
- Impersonation wird als app-seitiger Governance-Workflow mit strikter Ticket-/Approval-Policy geführt
- Beendete/abgelaufene Impersonation darf keinen wirksamen Acting-As-Kontext mehr erzeugen
- Entzogene Rechte müssen spätestens bei nächster Token-/Session-Validierung wirksam werden

### Audit-Anforderungen an die Keycloak-Integration

- Audit-Events speichern pseudonymisierte Subject-Referenzen statt Klartext-PII
- Exporte müssen die Korrelation zwischen Governance-Aktion und Keycloak-Identität nachvollziehbar machen

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
