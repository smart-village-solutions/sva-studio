# Change: IAM-Programm-Masterplan für mehrstufige Umsetzung

## Why

Das IAM-Vorhaben ist fachlich und technisch zu groß für ein einzelnes Proposal. Ein monolithischer Change erhöht Risiko, Review-Last und Umsetzungsunsicherheit. Daher wird ein steuernder Master-Plan benötigt, der das Gesamtziel verbindlich beschreibt und in umsetzbare Child-Changes zerlegt.

## What Changes

- Etabliert einen **Master-Change** als Programmrahmen für IAM.
- Definiert verbindliche Phasen, Abhängigkeiten und Exit-Kriterien.
- Zerlegt das Vorhaben in eigenständige Child-Changes mit klaren Schnittstellen.
- Verankert Governance-Regeln: Implementierung nur über freigegebene Child-Changes.

### Verbindlich festgelegte Programmentscheidungen

- Phase 1 umfasst **Auth + Session + RBAC-Basis inkl. Multi-Org-Context-Switch**.
- Kanonischer Mandanten-Scope ist `instanceId`.
- Pro Instanz sind mehrere Organisationen möglich; Benutzerzuordnungen erfolgen innerhalb der Instanz zu einer oder mehreren Organisationen.
- Organisationsmodell unterstützt **beliebig tiefe Hierarchien** (UI kann initial 3 Ebenen optimieren).
- Rollout erfolgt **stufenweise per Feature-Flags** (kein Big-Bang).
- Performance-Ziel für `POST /iam/authorize`: **P95 < 50 ms**.
- Cache-Invalidierung startet mit **Postgres NOTIFY** plus TTL-/Recompute-Fallback.
- Impersonation ist nur mit **Ticketpflicht**, **Vier-Augen-Freigabe** und **zeitlicher Begrenzung** erlaubt.
- Audit-Logs werden PII-minimiert/pseudonymisiert geführt; Nachweise via CSV/JSON/SIEM.
- Audit-Retention beträgt **24 Monate** (konfigurierbar, bestätigt 26.02.2026).
- **PII-Pseudonymisierung:** Klartext-PII (E-Mail, IP-Adresse, User-Agent) werden in Audit-Logs durch pseudonymisierte Referenzen ersetzt. Re-Identifikation ist nur durch autorisiertes Personal mit dokumentiertem Grund zulässig.
- **Encryption at Rest:** Sensible IAM-Daten (Accounts, Credentials, Audit-Logs) werden verschlüsselt gespeichert, wo dies sinnvoll und notwendig ist.
- **Operative Observability:** Alle IAM-Server-Module nutzen den **SDK Logger** (`@sva/sdk`) gemäß ADR-006. Kein `console.log` in IAM-Code. Audit-Events werden dual emittiert (DB + OTEL-Pipeline). Korrelations-IDs (`request_id`, `trace_id`) werden in allen IAM-API-Flows propagiert.
- **Logging-Pflichtfelder:** `workspace_id` (= `instanceId`), `component`, `environment`, `level` in jedem operativen Log-Eintrag.
- Keycloak-seitige Konfigurationen (MFA, Passwortrichtlinien, Session-Timeouts, Rate-Limiting, Brute-Force-Detection) werden **nach Abschluss der IAM-Kernentwicklung** in einem separaten Härtungs-Change adressiert (nicht im aktuellen Program-Scope).

### Programmstruktur (Child-Changes)

1. `setup-iam-identity-auth` (bestehend, als Child A weiterführen)
   - Fokus: OIDC, Token-Handling, Session-Lifecycle, Identity-Basis
2. `add-iam-core-data-layer`
   - Fokus: `iam`-Schema, Migrationen, RLS-Baseline, Seeds (7 Personas), Encryption at Rest
3. `add-iam-authorization-rbac-v1`
   - Fokus: `GET /iam/me/permissions`, `POST /iam/authorize`, RBAC + Org-Scoping
4. `add-iam-abac-hierarchy-cache`
   - Fokus: ABAC, Vererbung (Org/Geo), Cache-Invalidierung, Performance < 50 ms
5. `add-iam-governance-workflows`
   - Fokus: Permission-Change-Requests, Delegation, Impersonation, Legal Acceptances, Audit-Hardening
6. `add-iam-data-subject-rights`
   - Fokus: DSGVO-Betroffenenrechte (Art. 15–21), Löschkonzepte, Datenportabilität, Legal Hold

## Impact

- Affected specs: `iam-core`, `iam-organizations`, `iam-access-control`, `iam-auditing`, `iam-data-subject-rights` (über Child-Changes konkretisiert)
- Affected code: `packages/auth`, `packages/core`, `packages/data`, `packages/sdk`, `apps/studio`
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
  - `11-risks-and-technical-debt`
  - `logging-architecture` (IAM-spezifische Logger-Konfiguration, Dual-Write, Korrelation)
- Affected docs: `docs/development/observability-best-practices.md`, `docs/architecture/decisions/ADR-006-logging-pipeline-strategy.md`

## Governance / Guardrails

- Der Master-Change enthält **keine direkte Feature-Implementierung**.
- Jede Umsetzung erfolgt ausschließlich über Child-Changes mit eigenen Spec-Deltas und Tasks.
- Jeder Child-Change muss **vor Review-Freigabe** ein eigenes `design.md` enthalten (Architekturentscheidungen, Alternativen-Abwägung, Datenflüsse).
- Child-Changes werden in definierter Reihenfolge umgesetzt, außer eine explizite Entkopplung wurde in deren Design dokumentiert.
- Der Beschlussstand wird in `decision-checklist.md` gepflegt und ist für Child-Starts bindend.
- Specs werden in der Projektsprache (Deutsch) verfasst; Abweichungen erfordern eine dokumentierte Begründung.
- Alle IAM-Server-Module verwenden `createSdkLogger({ component: 'iam-<modul>' })` gemäß ADR-006 und Observability Best Practices. `console.log`/`console.error` ist in IAM-Code nicht zulässig.
- Sicherheitsrelevante Audit-Events werden dual emittiert: DB (`iam.activity_logs`) **und** OTEL-Pipeline (SDK Logger) für Echtzeit-Monitoring und Alerting.
- Alle IAM-API-Endpunkte propagieren `X-Request-Id` und OTEL-Trace-Context für request-übergreifende Korrelation.

## Success Criteria

- Für jede Phase existiert ein eigenständiger, reviewbarer Child-Change.
- Abhängigkeiten und Reihenfolge sind transparent und stabil.
- Sicherheits-, Performance- und Compliance-Ziele sind pro Child-Change testbar hinterlegt.

## Status

� Freigegeben (26.02.2026) – Alle Must-Entscheidungen getroffen, Child A und B startbereit
