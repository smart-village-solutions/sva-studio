# Change: IAM Governance-Workflows und Compliance-Flows

## Why

Für Enterprise- und Behördenkontext reichen reine Berechtigungsentscheidungen nicht aus. Benötigt werden nachvollziehbare Governance-Prozesse (Vier-Augen-Prinzip, Delegationen, Impersonation) sowie rechtskonforme Nachweise.

## Kontext

Child E schließt die IAM-Ausbaustufe ab und baut auf Child D auf. Fokus liegt auf kontrollierten Änderungsprozessen, revisionssicherer Nachvollziehbarkeit und Compliance-fähigen Nachweisen im instanzzentrierten Betriebsmodell.

## What Changes

- Permission-Change-Requests mit Approval-Flow
- Delegationen (temporäre Vertretungen) mit Gültigkeitsfenstern
- Sichere Impersonation mit starker Auditierbarkeit
- Legal-Text-Akzeptanzen und Compliance-Events
- Governance-Workflows instanzgebunden modellieren (`instanceId` als Primärscope)
- Keycloak-Identitätskontext (`sub`, Rollen/Groups) für Governance-Entscheidung und Audit-Korrelation verbindlich nutzen

### In Scope

- Workflow-Modelle für Rechteänderungen, Delegationen und Impersonation
- Vier-Augen- und Ticket-basierte Freigabeprozesse
- Unveränderbare Audit-Events und Exportfähigkeit (CSV/JSON/SIEM)
- Legal-Text-Versionierung und Akzeptanznachweise

### Out of Scope

- Ausbau externer IdP-Integrationen
- Fachmodulspezifische UI-Workflows außerhalb IAM-Kerns
- Erweiterte Analytics-/Reporting-Portale über den Compliance-Nachweis hinaus
- Keycloak-Härtung (MFA/Password-Policy/Lockout) bleibt gemäß Masterplan deferred

### Delivery-Slices

1. **Workflow Slice:** Request-/Approval-Modelle und Statusübergänge
2. **Security Slice:** Impersonation-Schutz, Vier-Augen, Laufzeitgrenzen
3. **Audit Slice:** immutable Events, Exportpfade, Nachweislogik
4. **Compliance Slice:** Legal-Text-Versionierung + Akzeptanzkette

## Impact

- Affected specs: `iam-auditing`, `iam-core`, `iam-access-control`
- Affected code: `packages/core`, `packages/data`, `apps/studio`
- Affected arc42 sections: `06-runtime-view`, `08-cross-cutting-concepts`, `11-risks-and-technical-debt`

## Dependencies

- Requires: `add-iam-abac-hierarchy-cache`

## Risiken und Gegenmaßnahmen

- **Missbrauch privilegierter Funktionen:** harte Rollenprüfung + zeitliche Begrenzung + vollständige Protokollierung
- **Unvollständige Nachweise:** verpflichtende Audit-Events pro Workflow-Schritt + Exporttests
- **Instanzübergreifende Seiteneffekte:** durchgängige `instanceId`-Enforcement-Tests

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte geklärt sein:

1. ✅ Vier-Augen-Regel und Ticketpflicht für kritische Änderungen verbindlich festgelegt
2. ✅ Impersonation-Richtlinie (Dauer, Sichtbarkeit, Abbruch) freigegeben
3. ✅ Audit-Retention und Exportanforderungen mit Legal/DSB abgestimmt
4. ✅ Instanzisolation als nicht verhandelbare Sicherheitsanforderung bestätigt

### Bestätigte Defaults (28.02.2026)

- Impersonation global hart gedeckelt auf 120 Minuten pro Sitzung
- Delegation global hart gedeckelt auf 30 Tage pro Delegationsfenster
- `support_admin`-Impersonation benötigt zusätzlichen Security-Approver
- Zulässige Ticket-States: `open`, `in_progress`, `approved_for_execution`
- Export-Pflichtfelder: `event_id`, `timestamp`, `instance_id`, `action`, `result`, `actor_pseudonym`, `target_ref`, `reason_code`, `request_id`, `trace_id`

## Akzeptanzkriterien (Change-Ebene)

- Rechteänderungen laufen über nachvollziehbare Approval-Workflows mit Statushistorie.
- Delegationen werden nur im gültigen Zeitraum und nur im Instanzkontext wirksam.
- Impersonation ist strikt begrenzt und vollständig auditierbar.
- Legal-Text-Akzeptanzen sind versioniert, nachweisbar und exportierbar.
- Missbrauchs- und Instanzgrenzen-Tests laufen stabil grün.

## Status

🟢 Ready for Approval (inhaltlich konkretisiert, Defaults bestätigt)
